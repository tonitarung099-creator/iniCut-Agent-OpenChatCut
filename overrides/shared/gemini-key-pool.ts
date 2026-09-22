/**
 * MiniCut Gemini API key pool.
 *
 * Users can paste one key or up to 100 keys in the normal Gemini API Key field.
 * Multiple keys are separated by comma, semicolon, or whitespace. Values are
 * never exposed to the renderer; selection happens server-side.
 */
const MAX_GEMINI_KEYS = 100;
let cursor = 0;

export function parseGeminiApiKeys(raw: string, max = MAX_GEMINI_KEYS): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of String(raw ?? '').split(/[\s,;]+/g)) {
    const key = part.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
    if (out.length >= Math.max(1, Math.min(MAX_GEMINI_KEYS, max))) break;
  }
  return out;
}

export function firstGeminiApiKey(raw: string): string {
  return parseGeminiApiKeys(raw, 1)[0] ?? '';
}

export function geminiApiKeySequence(raw: string): string[] {
  const keys = parseGeminiApiKeys(raw);
  if (keys.length === 0) return [];
  const start = cursor % keys.length;
  // Advance once per logical request, not once per retry. A caller can then
  // walk the returned sequence without concurrent requests stealing its next
  // failover key.
  cursor = (cursor + 1) % Number.MAX_SAFE_INTEGER;
  return [...keys.slice(start), ...keys.slice(0, start)];
}

export function nextGeminiApiKey(raw: string): string {
  return geminiApiKeySequence(raw)[0] ?? '';
}

export function geminiApiKeyCount(raw: string): number {
  return parseGeminiApiKeys(raw).length;
}
