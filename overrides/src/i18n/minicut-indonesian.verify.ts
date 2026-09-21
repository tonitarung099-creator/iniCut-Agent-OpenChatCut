import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EN } from './dict/en';
import { ALL_LOCALES, getLocale, t } from './locale';

const CJK = /[\u3400-\u9FFF\uF900-\uFAFF]/;

assert.deepEqual(ALL_LOCALES, ['id']);
assert.equal(getLocale(), 'id');

for (const key of Object.keys(EN)) {
  const visible = t(key);
  assert.equal(CJK.test(visible), false, `CJK leaked from i18n key: ${key}`);
}

const index = readFileSync('index.html', 'utf8');
assert.match(index, /<html lang="id">/);
assert.match(index, /<title>MiniCut<\/title>/);
assert.doesNotMatch(index, /<title>OpenChatCut<\/title>/);

for (const path of [
  'src/components/settings/settingsAgentProviders.ts',
  'desktop/runtime-preflight.ts',
  'server/mobile-upload-service.ts',
  'server/plugins/llm-proxy.ts',
]) {
  const source = readFileSync(path, 'utf8');
  assert.equal(CJK.test(source), false, `Foreign CJK text remains in visible MiniCut source: ${path}`);
}

console.log('MiniCut Indonesian-only UI checks passed');
