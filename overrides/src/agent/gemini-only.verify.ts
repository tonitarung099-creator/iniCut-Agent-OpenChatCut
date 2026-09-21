import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AGENT_VENDOR_PAGES_WITH_VISION } from '../components/settings/settingsAgentProviders';
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
assert.match(modelSelection, /preset\.id === 'gemini'/);
assert.match(modelSelection, /return \[\.\.\.apiModelChoices\]/);

const execution = readFileSync('server/agent-runs/execution-input.ts', 'utf8');
assert.match(execution, /effectiveProvider = 'gemini'/);
assert.match(execution, /backend = 'api'/);

const proxy = readFileSync('server/plugins/llm-proxy.ts', 'utf8');
assert.match(proxy, /return 'gemini';/);

const settingsPane = readFileSync('src/components/settings/settingsVendorPane.tsx', 'utf8');
assert.match(settingsPane, /LLM_GEMINI_API_KEY/);
assert.match(settingsPane, /satu key per baris/);
assert.match(settingsPane, /rows=\{6\}/);

console.log('MiniCut Gemini-only Agent checks passed');
