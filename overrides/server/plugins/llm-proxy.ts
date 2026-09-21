import type { IncomingMessage } from 'node:http';
import type { Plugin } from 'vite';
import { getKey, type KeyName } from '../keystore.ts';
import {
  requireLlmProvider,
  llmProviderPreset,
  protocolForProvider,
  type LlmProvider,
} from '../../shared/llm-providers.ts';
import { resolveLlmProviderConfig } from '../llm-config.ts';
import { xaiOauthAccessToken } from '../xai-oauth-session.ts';
import { proxyMiddleware } from '../proxy.ts';
import { nextGeminiApiKey } from '../../shared/gemini-key-pool.ts';

function keyReader(name: string): string {
  return getKey(name as KeyName);
}

export function llmProviderForRequest(req?: IncomingMessage): LlmProvider {
  const requested = req?.headers['x-openchatcut-provider'];
  return requireLlmProvider(requested === undefined ? getKey('LLM_PROVIDER') : requested);
}

export function llmTarget(req?: IncomingMessage): string {
  return resolveLlmProviderConfig(llmProviderForRequest(req), keyReader).baseUrl;
}

export function llmHeaders(req?: IncomingMessage): Record<string, string> {
  const config = resolveLlmProviderConfig(llmProviderForRequest(req), keyReader);
  if (config.provider === 'xai-oauth') {
    // OAuth requests only trust the active in-memory session. API-key accounts
    // use the separate xai provider and LLM_XAI_API_KEY slot.
    const token = xaiOauthAccessToken();
    return token ? { authorization: `Bearer ${token}` } : {};
  }
  if (!config.apiKey) return {};
  const protocol = protocolForProvider(config.provider);
  if (protocol === 'anthropic') return { 'x-api-key': config.apiKey, 'anthropic-version': '2023-06-01' };
  if (protocol === 'google') {
    const key = nextGeminiApiKey(config.apiKey);
    return key ? { 'x-goog-api-key': key } : {};
  }
  return { authorization: `Bearer ${config.apiKey}` };
}

export function llmErrorMessage(status: number, req?: IncomingMessage): string {
  const provider = llmProviderForRequest(req);
  const label = llmProviderPreset(provider).label;
  if (provider === 'xai-oauth' && (status === 401 || status === 403)) {
    return status === 403
      ? 'xAI menolak akses API dari sesi langganan ini. Gunakan paket yang mendukung API atau masukkan API Key pada Pengaturan → Model Agent → xAI Grok.'
      : 'Sesi langganan xAI sudah tidak berlaku. Jalankan grok login di terminal, lalu impor ulang sesi pada Pengaturan → Model Agent → xAI Grok.';
  }
  if (status === 401 || status === 403) {
    return `Autentikasi ${label} gagal. Periksa API Key di Pengaturan → Model Agent.`;
  }
  if (status === 402 || status === 429) {
    return `Kuota ${label} habis atau permintaan terlalu sering. Periksa kuota lalu coba lagi.`;
  }
  if (status === 404) {
    return `Endpoint atau model ${label} tidak ditemukan. Periksa Base URL dan nama model.`;
  }
  if (status >= 500) {
    return `Layanan ${label} sementara tidak tersedia (HTTP ${status}). Coba lagi nanti atau ganti model.`;
  }
  return `Permintaan ${label} gagal (HTTP ${status}). Periksa konfigurasi koneksi di Pengaturan → Model Agent.`;
}

/** One dynamic proxy implementation shared by Vite dev and Electron production. */
export function llmProxyPlugin(): Plugin {
  return {
    name: 'openchatcut-llm-proxy',
    configureServer(server) {
      server.middlewares.use('/llm', (req, res, next) => {
        try {
          llmProviderForRequest(req);
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { message: 'Unsupported LLM provider' } }));
          return;
        }
        next();
      });
      server.middlewares.use('/llm', proxyMiddleware({
        target: llmTarget,
        headers: llmHeaders,
        forceJsonContentType: true,
        errorMessage: llmErrorMessage,
      }));
    },
  };
}
