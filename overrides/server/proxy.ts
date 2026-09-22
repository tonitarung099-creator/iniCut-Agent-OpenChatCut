// Shared streaming proxy for Vite dev and the Electron embedded server.
// `target()` and `headers()` are evaluated for every request, so settings saved
// through the keystore take effect immediately without exposing keys to browser JS.
import { request as httpRequest, type IncomingMessage, type ServerResponse } from 'node:http';
import { request as httpsRequest } from 'node:https';
import type { Agent as HttpAgent, ClientRequest } from 'node:http';
import { outboundHttpAgent } from './outbound-proxy.ts';

type Middleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => unknown;

// Optional outbound proxy (Clash etc.) for providers blocked by the network.
// node:https does not read HTTPS_PROXY by itself, so we attach a CONNECT
// tunnel agent. The unified resolver (server/outbound-proxy.ts) prefers the
// user-configured PROXY_URL keystore entry and falls back to the standard
// HTTPS_PROXY/HTTP_PROXY environment variables; disabled for plain-http
// targets and when no proxy is configured.
function outboundProxyAgent(): HttpAgent | null {
  return outboundHttpAgent() ?? null;
}

const HOP_BY_HOP = new Set(['host', 'connection', 'keep-alive', 'proxy-authorization', 'proxy-connection', 'transfer-encoding', 'upgrade', 'te', 'trailer']);

// Browser-only headers that must never reach upstream. Cookies are shared across
// every localhost port, so a large accumulated cookie jar on a dev machine would
// otherwise be forwarded verbatim and rejected by provider gateways (431/400).
const NEVER_FORWARD: Record<string, true> = {
  'x-openchatcut-provider': true,
  cookie: true,
};

export interface ProxyRoute {
  /** Target API prefix, evaluated per request. */
  target: (req: IncomingMessage) => string;
  /** Outbound headers, evaluated per attempt. Retry-aware routes may rotate credentials here. */
  headers: (req: IncomingMessage) => Record<string, string>;
  /** Normalize generic relay responses so provider SDKs can parse JSON. */
  forceJsonContentType?: boolean;
  /** Replace upstream error bodies with one actionable message. */
  errorMessage?: (status: number, req: IncomingMessage) => string;
  /** Optional replay-safe retry count. Values <=1 preserve the streaming fast path. */
  retryAttempts?: (req: IncomingMessage) => number;
  /** HTTP statuses that may be retried with freshly evaluated headers. */
  retryStatuses?: readonly number[];
}

const MAX_REPLAY_BODY_BYTES = 64 * 1024 * 1024;

export function proxyMiddleware(route: ProxyRoute): Middleware {
  return (req, res) => {
    let target: URL;
    try {
      target = new URL(route.target(req));
      if (target.protocol !== 'http:' && target.protocol !== 'https:') {
        throw new Error('unsupported proxy protocol');
      }
    } catch {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'proxy target is not a valid URL' }));
      return;
    }

    const buildHeaders = (): Record<string, string | string[]> => {
      const headers: Record<string, string | string[]> = {};
      for (const [k, v] of Object.entries(req.headers)) {
        if (!HOP_BY_HOP.has(k.toLowerCase()) && !NEVER_FORWARD[k.toLowerCase()] && v !== undefined) {
          headers[k] = v;
        }
      }
      headers.host = target.host;
      for (const [k, v] of Object.entries(route.headers(req))) if (v) headers[k] = v;
      return headers;
    };

    const basePath = target.pathname.replace(/\/$/, '');
    const rawUrl = req.url ?? '/';
    const queryAt = rawUrl.indexOf('?');
    const requestPath = queryAt === -1 ? rawUrl : rawUrl.slice(0, queryAt);
    const search = new URLSearchParams(target.search);
    if (queryAt !== -1) {
      for (const [name, value] of new URLSearchParams(rawUrl.slice(queryAt + 1))) {
        search.append(name, value);
      }
    }
    const query = search.size > 0 ? `?${search.toString()}` : '';
    const doRequest = target.protocol === 'http:' ? httpRequest : httpsRequest;
    const agent = target.protocol === 'https:' ? outboundProxyAgent() : null;

    const requestOptions = (headers: Record<string, string | string[]>) => ({
      host: target.hostname,
      port: target.port || (target.protocol === 'http:' ? 80 : 443),
      method: req.method,
      path: basePath + requestPath + query,
      headers,
      ...(agent ? { agent } : {}),
    });

    const writeFinalResponse = (upRes: IncomingMessage): void => {
      const status = upRes.statusCode ?? 502;
      if (status >= 400 && route.errorMessage) {
        const chunks: Buffer[] = [];
        upRes.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        upRes.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8').slice(0, 2000);
          console.warn(`[proxy] upstream ${status} for ${target.host}${basePath}${requestPath} · ${body}`);
          if (res.writableEnded || res.destroyed) return;
          res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
          res.end(JSON.stringify({ error: { message: route.errorMessage!(status, req) } }));
        });
        return;
      }

      const outHeaders: Record<string, string | string[]> = {};
      for (const [k, v] of Object.entries(upRes.headers)) {
        if (!HOP_BY_HOP.has(k.toLowerCase()) && v !== undefined) outHeaders[k] = v;
      }
      if (route.forceJsonContentType) {
        const ct = String(outHeaders['content-type'] ?? '');
        if (!ct.includes('application/json') && !ct.includes('text/event-stream')) {
          outHeaders['content-type'] = 'application/json';
        }
      }
      res.writeHead(status, outHeaders);
      upRes.pipe(res);
    };

    const sendSingleStreamingRequest = (): void => {
      const upstream = doRequest(requestOptions(buildHeaders()), writeFinalResponse);
      upstream.on('error', (err) => {
        if (!res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `upstream request failed: ${err.message}` }));
        } else if (!res.writableEnded) {
          res.end();
        }
      });
      res.on('close', () => upstream.destroy());
      req.pipe(upstream);
    };

    const requestedAttempts = Math.max(1, Math.min(100, Math.floor(route.retryAttempts?.(req) ?? 1)));
    const retryStatuses = new Set(route.retryStatuses ?? []);
    const method = (req.method ?? 'GET').toUpperCase();
    const bodyless = method === 'GET' || method === 'HEAD';
    const declaredLengthRaw = req.headers['content-length'];
    const declaredLength = typeof declaredLengthRaw === 'string' ? Number(declaredLengthRaw) : Number.NaN;
    const replayableBody = bodyless
      || (Number.isSafeInteger(declaredLength) && declaredLength >= 0 && declaredLength <= MAX_REPLAY_BODY_BYTES);

    if (requestedAttempts <= 1 || retryStatuses.size === 0 || !replayableBody) {
      sendSingleStreamingRequest();
      return;
    }

    const chunks: Buffer[] = [];
    let total = 0;
    let bodyRejected = false;
    req.on('data', (chunk) => {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      total += buf.length;
      if (total > MAX_REPLAY_BODY_BYTES) {
        bodyRejected = true;
        return;
      }
      chunks.push(buf);
    });
    req.on('error', (err) => {
      if (!res.headersSent) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `proxy request body failed: ${err.message}` }));
      }
    });
    req.on('end', () => {
      if (bodyRejected) {
        if (!res.headersSent) {
          res.writeHead(413, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'proxy request body too large for credential retry' }));
        }
        return;
      }

      const body = Buffer.concat(chunks);
      let activeUpstream: ClientRequest | null = null;
      let finished = false;

      const failTransport = (err: Error): void => {
        if (finished || res.writableEnded || res.destroyed) return;
        finished = true;
        if (!res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `upstream request failed: ${err.message}` }));
        } else if (!res.writableEnded) {
          res.end();
        }
      };

      const sendAttempt = (attempt: number): void => {
        if (finished || res.writableEnded || res.destroyed) return;
        activeUpstream = doRequest(requestOptions(buildHeaders()), (upRes) => {
          const status = upRes.statusCode ?? 502;
          const shouldRetry = attempt < requestedAttempts && retryStatuses.has(status);
          if (!shouldRetry) {
            finished = true;
            writeFinalResponse(upRes);
            return;
          }

          // Drain the failed response before reusing the local request body with
          // a newly evaluated credential. No upstream body is exposed to the UI.
          upRes.resume();
          upRes.once('end', () => sendAttempt(attempt + 1));
        });
        activeUpstream.on('error', failTransport);
        activeUpstream.end(body);
      };

      res.on('close', () => {
        finished = true;
        activeUpstream?.destroy();
      });
      sendAttempt(1);
    });
  };
}

