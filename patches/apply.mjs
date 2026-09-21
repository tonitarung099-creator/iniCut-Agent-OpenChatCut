import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const overlayRoot = resolve(here, '..');
const sourceRoot = resolve(process.argv[2] ?? join(overlayRoot, 'upstream'));

if (!existsSync(join(sourceRoot, 'package.json'))) {
  throw new Error(`OpenChatCut source not found at ${sourceRoot}`);
}

function read(rel) {
  return readFileSync(join(sourceRoot, rel), 'utf8');
}

function write(rel, value) {
  const target = join(sourceRoot, rel);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, value);
}

function replaceRequired(rel, from, to) {
  const before = read(rel);
  if (!before.includes(from)) {
    throw new Error(`Patch anchor not found: ${rel} -> ${from.slice(0, 90)}`);
  }
  write(rel, before.replace(from, to));
}

function copyOverrides() {
  cpSync(join(overlayRoot, 'overrides'), sourceRoot, {
    recursive: true,
    force: true,
  });
}

copyOverrides();

// ---- Product + Windows portable packaging ---------------------------------
{
  const pkgPath = 'package.json';
  const pkg = JSON.parse(read(pkgPath));
  pkg.name = 'minicut-agent';
  pkg.description = 'Editor video portable dengan AI Agent dan antarmuka Bahasa Indonesia.';
  const win = pkg.scripts?.['desktop:dist:win'];
  if (typeof win !== 'string') throw new Error('desktop:dist:win script not found');
  pkg.scripts['desktop:dist:win'] = win
    .replace("'--win','nsis'", "'--win','portable'")
    .replace('"--win","nsis"', '"--win","portable"');
  if (pkg.scripts['desktop:dist:win'] === win) {
    throw new Error('Could not switch Windows desktop target from nsis to portable');
  }
  write(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
}

replaceRequired(
  'config/electron-builder.config.mjs',
  "appId: 'dev.openchatcut.app',",
  "appId: 'id.minicut.agent',",
);
replaceRequired(
  'config/electron-builder.config.mjs',
  "productName: 'OpenChatCut',",
  "productName: 'MiniCut',",
);
replaceRequired(
  'config/electron-builder.config.mjs',
  "artifactName: '${productName}-${version}-${arch}.${ext}',",
  "artifactName: 'MiniCut-Portable-${version}-${arch}.${ext}',",
);
replaceRequired(
  'config/electron-builder.config.mjs',
  "owner: '0xsline',",
  "owner: 'tonitarung099-creator',",
);
replaceRequired(
  'config/electron-builder.config.mjs',
  "repo: 'OpenChatCut',",
  "repo: 'iniCut-Agent-OpenChatCut',",
);
replaceRequired(
  'config/electron-builder.config.mjs',
  "target: ['nsis'],",
  "target: ['portable'],",
);

// ---- Portable storage ------------------------------------------------------
// Set portable paths in bootstrap BEFORE app-main and server modules load.
// This keeps the runtime profile, keystore, projects, media, Codex/Copilot
// homes, Electron userData and cache beside the executable.
{
  const rel = 'desktop/bootstrap.ts';
  let s = read(rel);
  s = s.replace(
    "import { app, dialog } from 'electron';\nimport { RUNTIME_ASSET_ADVICE } from './runtime-preflight.ts';",
    "import { app, dialog } from 'electron';\nimport { mkdirSync } from 'node:fs';\nimport { dirname, join } from 'node:path';\nimport { RUNTIME_ASSET_ADVICE } from './runtime-preflight.ts';",
  );
  const anchor = "// Remotion renders export frames inside this process (main + headless tabs).";
  if (!s.includes(anchor)) throw new Error('desktop/bootstrap.ts portable anchor not found');
  const portable = `
const portableRoot = process.env.PORTABLE_EXECUTABLE_DIR?.trim() || dirname(process.execPath);
const portableData = join(portableRoot, 'data');
const portableHome = join(portableData, 'home');
const portableRuntime = join(portableData, 'runtime');
const electronData = join(portableData, 'electron');
const electronCache = join(portableData, 'cache');
for (const dir of [portableData, portableHome, portableRuntime, electronData, electronCache]) {
  mkdirSync(dir, { recursive: true });
}
process.env.MINICUT_PORTABLE = '1';
process.env.OPENCHATCUT_DATA_DIR = portableRuntime;
process.env.HOME = portableHome;
process.env.USERPROFILE = portableHome;
app.setPath('userData', electronData);
app.setPath('cache', electronCache);

`;
  s = s.replace(anchor, portable + anchor);
  s = s
    .replace("dialog.showErrorBox('OpenChatCut 启动失败 / failed to start'", "dialog.showErrorBox('MiniCut gagal dijalankan'")
    .replace("'无法加载程序主体 / could not load the application bundle:'", "'Komponen utama aplikasi tidak dapat dimuat:'");
  write(rel, s);
}

// Portable packages should not try to run an installer-style self updater.
replaceRequired(
  'desktop/update-service.ts',
  "  return context.platform === 'win32' || context.platform === 'linux';",
  "  return false; // MiniCut portable: update by replacing the portable build.",
);

// ---- Indonesian desktop dialogs ------------------------------------------
{
  const rel = 'desktop/main.ts';
  let s = read(rel);
  const replacements = new Map([
    ["title: '选择素材保存目录'", "title: 'Pilih folder penyimpanan media'"],
    ["title: '选择导出目录'", "title: 'Pilih folder ekspor'"],
    ["throw new Error('所选导出目录不可用')", "throw new Error('Folder ekspor yang dipilih tidak dapat digunakan')"],
    ["title: '选择导出文件'", "title: 'Pilih file ekspor'"],
    ["throw new Error('导出文件名无效')", "throw new Error('Nama file ekspor tidak valid')"],
    ["title: '文字稿'", "title: 'Transkrip'"],
  ]);
  for (const [from, to] of replacements) s = s.split(from).join(to);
  write(rel, s);
}

// ---- Gemini as MiniCut's primary agent provider ---------------------------
replaceRequired(
  'shared/llm-providers.ts',
  "export const DEFAULT_LLM_PROVIDER: LlmProvider = 'anthropic';",
  "export const DEFAULT_LLM_PROVIDER: LlmProvider = 'gemini';",
);
{
  const rel = '.env.example';
  let s = read(rel);
  s = s.replace('LLM_PROVIDER=anthropic', 'LLM_PROVIDER=gemini');
  write(rel, s);
}

// ---- Remove multilingual switching from the visible UI --------------------
{
  const rel = 'src/components/TopBar.tsx';
  let s = read(rel);
  if (!s.includes('<LocaleToggle />')) throw new Error('Locale toggle call not found');
  s = s.replace('<LocaleToggle />', '');
  write(rel, s);
}

// A few upstream schema strings are rendered directly instead of going through t().
{
  const files = [
    'src/components/settings/settingsSchema.ts',
    'src/components/settings/settingsMediaProviders.ts',
  ];
  const direct = new Map([
    ["title: 'AI 生成'", "title: 'Generasi AI'"],
    ["'默认 https://generativelanguage.googleapis.com'", "'Bawaan https://generativelanguage.googleapis.com'"],
    ["'配音模型'", "'Model sulih suara'"],
  ]);
  for (const rel of files) {
    let s = read(rel);
    for (const [from, to] of direct) s = s.split(from).join(to);
    write(rel, s);
  }
}

console.log('MiniCut overlay applied successfully.');
