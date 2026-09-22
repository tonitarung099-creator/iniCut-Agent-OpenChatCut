import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AGENT_VENDOR_PAGES_WITH_VISION } from '../components/settings/settingsAgentProviders';
import { SETTINGS_CATEGORIES } from '../components/settings/settingsSchema';
import { parseGeminiApiKeys } from '../../shared/gemini-key-pool';

assert.equal(AGENT_VENDOR_PAGES_WITH_VISION.length, 1, 'MiniCut must expose exactly one Agent provider');
assert.equal(AGENT_VENDOR_PAGES_WITH_VISION[0]?.key, 'llm/gemini');
assert.equal(AGENT_VENDOR_PAGES_WITH_VISION[0]?.vendor, 'gemini');

const multiline = [
  'key-a',
  'key-b',
  '',
  'key-c',
  'key-b',
].join('\n');
assert.deepEqual(parseGeminiApiKeys(multiline), ['key-a', 'key-b', 'key-c']);

const many = Array.from({ length: 120 }, (_, index) => `key-${index}`).join('\n');
assert.equal(parseGeminiApiKeys(many).length, 100, 'Gemini key pool must cap at 100');

const modelSelection = readFileSync('src/agent/model-selection.ts', 'utf8');
assert.match(modelSelection, /candidate\.id === 'gemini'/);
assert.match(modelSelection, /provider: 'gemini'/);
assert.match(modelSelection, /const choices: readonly AgentModelChoice\[\] = choice \? \[choice\] : \[\]/);
assert.match(modelSelection, /Gemini-only by design/);

const execution = readFileSync('server/agent-runs/execution-input.ts', 'utf8');
assert.match(execution, /effectiveProvider = 'gemini'/);
assert.match(execution, /backend = 'api'/);

const proxy = readFileSync('server/plugins/llm-proxy.ts', 'utf8');
assert.match(proxy, /return 'gemini';/);

const settingsPane = readFileSync('src/components/settings/settingsVendorPane.tsx', 'utf8');
assert.match(settingsPane, /LLM_GEMINI_API_KEY/);
assert.match(settingsPane, /GeminiKeyManager/);
assert.match(settingsPane, /\/api\/keys\/gemini-pool\/add/);
assert.match(settingsPane, /Tambah \{count\} Key/);
assert.match(settingsPane, /Hapus Semua/);

const settingsVendors = SETTINGS_CATEGORIES
  .flatMap((category) => category.groups)
  .flatMap((group) => group.vendors)
  .map((page) => page.vendor);
for (const removedAi of [
  'anthropic', 'openai', 'xai', 'kimi', 'qwen', 'glm', 'deepseek',
  'stepfun', 'byteplus', 'minimax', 'xiaomi', 'mistral', 'openrouter',
  'ofox', 'orcarouter', 'ollama', 'lmstudio',
]) {
  assert.equal(
    settingsVendors.includes(removedAi as never),
    false,
    `non-Gemini AI provider must not appear in MiniCut settings: ${removedAi}`,
  );
}
assert.equal(
  SETTINGS_CATEGORIES.some((category) => category.key === 'generation'),
  false,
  'the multi-provider AI generation category must be removed from MiniCut settings',
);

console.log('MiniCut Gemini-only Agent checks passed');
