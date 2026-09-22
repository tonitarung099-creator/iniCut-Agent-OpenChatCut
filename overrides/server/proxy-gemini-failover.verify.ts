import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import { proxyMiddleware } from './proxy';

async function listen(server: Server): Promise<number> {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('server did not expose a TCP port');
  return address.port;
}

async function close(server: Server): Promise<void> {
  server.close();
  await once(server, 'close');
}

const seenKeys: string[] = [];
const seenBodies: string[] = [];

const upstream = createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const body = Buffer.concat(chunks).toString('utf8');
  seenBodies.push(body);
  seenKeys.push(String(req.headers['x-goog-api-key'] ?? ''));

  if (req.headers['x-goog-api-key'] === 'key-one') {
    res.writeHead(429, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { message: 'quota exhausted' } }));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true, echoed: JSON.parse(body) }));
});

const upstreamPort = await listen(upstream);
let headerCall = 0;
const keys = ['key-one', 'key-two'];
const middleware = proxyMiddleware({
  target: () => `http://127.0.0.1:${upstreamPort}`,
  headers: () => ({ 'x-goog-api-key': keys[Math.min(headerCall++, keys.length - 1)]! }),
  retryAttempts: () => 2,
  retryStatuses: [401, 403, 429],
  forceJsonContentType: true,
  errorMessage: (status) => `upstream ${status}`,
});

const proxy = createServer((req, res) => {
  void middleware(req, res, () => undefined);
});
const proxyPort = await listen(proxy);

try {
  const payload = { contents: [{ role: 'user', parts: [{ text: 'potong video' }] }] };
  const response = await fetch(`http://127.0.0.1:${proxyPort}/models/gemini-3.8-flash:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  assert.equal(response.status, 200);
  const result = await response.json() as { ok?: boolean; echoed?: unknown };
  assert.equal(result.ok, true);
  assert.deepEqual(result.echoed, payload);
  assert.deepEqual(seenKeys, ['key-one', 'key-two']);
  assert.equal(seenBodies.length, 2);
  assert.equal(seenBodies[0], seenBodies[1], 'retried request body must be byte-identical');
  assert.equal(seenBodies[0], JSON.stringify(payload));
} finally {
  await close(proxy);
  await close(upstream);
}

console.log('MiniCut Gemini proxy failover replay checks passed');
