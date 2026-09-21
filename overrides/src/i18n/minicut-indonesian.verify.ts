import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EN } from './dict/en';
import { ALL_LOCALES, getLocale, localizedCatalogText, t, tData } from './locale';
import { ASR_MODELS } from '../../shared/asr-models';
import { SOUND_EFFECTS } from '../audio/soundLibrary';
import { SHORTCUT_CATALOG, SHORTCUT_GROUPS } from '../shortcuts/catalog';
import { modelPackInstallGuidance } from '../../shared/model-packs/catalog';

const CJK = /[\u3400-\u9FFF\uF900-\uFAFF]/;
const PLACEHOLDER = 'Teks antarmuka belum diterjemahkan';

function assertIndonesianVisible(value: string, label: string): void {
  assert.equal(CJK.test(value), false, `CJK leaked into visible UI: ${label} -> ${value}`);
  assert.notEqual(value, PLACEHOLDER, `Untranslated placeholder remains in core UI: ${label}`);
}

assert.deepEqual(ALL_LOCALES, ['id']);
assert.equal(getLocale(), 'id');

for (const key of Object.keys(EN)) {
  const visible = t(key);
  assert.equal(CJK.test(visible), false, `CJK leaked from i18n key: ${key}`);
}

// Core surfaces that MiniCut users encounter frequently must be translated,
// not merely hidden behind the safe placeholder.
for (const key of [
  '我的素材', '资源库', '文字稿', '音效', '搜索音效', '音效分组',
  '设置', '默认模型', '转写语言', '本地模型', '界面',
  '导出设置', '成片', '保存到', '导出目录',
  '时间线', '播放', '暂停', '字幕样式', '手动添加字幕',
  '选择模型', '测试连接', '保存', '取消', '删除',
]) {
  assertIndonesianVisible(t(key), key);
}

for (const model of ASR_MODELS) {
  assertIndonesianVisible(model.sizeLabel, `ASR ${model.id} size`);
  assertIndonesianVisible(model.language, `ASR ${model.id} language`);
  assertIndonesianVisible(model.note, `ASR ${model.id} note`);
}

for (const sound of SOUND_EFFECTS) {
  assertIndonesianVisible(tData(sound.name), `sound name ${sound.id}`);
  assertIndonesianVisible(sound.desc, `sound description ${sound.id}`);
}

for (const group of SHORTCUT_GROUPS) {
  assertIndonesianVisible(
    localizedCatalogText(group.label, group.labelZh),
    `shortcut group ${group.id}`,
  );
}
for (const action of SHORTCUT_CATALOG) {
  assertIndonesianVisible(
    localizedCatalogText(action.label, action.labelZh),
    `shortcut ${action.id}`,
  );
}

const installGuidance = modelPackInstallGuidance([{ id: 'rhythm-lite' }]);
assertIndonesianVisible(installGuidance, 'model-pack install guidance');

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
