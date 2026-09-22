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
    .replace("'--win','nsis'", "'--win','--dir'")
    .replace('"--win","nsis"', '"--win","--dir"');
  if (pkg.scripts['desktop:dist:win'] === win) {
    throw new Error('Could not switch Windows desktop build from installer to unpacked portable folder');
  }
  if (!pkg.scripts['desktop:dist:win'].includes("'--dir'")
      && !pkg.scripts['desktop:dist:win'].includes('"--dir"')) {
    throw new Error('Windows desktop build is not configured for --dir portable-folder output');
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
// MiniCut Windows distribution is built with electron-builder --dir. The
// upstream win.target remains untouched because --dir bypasses installer
// targets entirely and emits an unpacked application directory.

// ---- Portable storage ------------------------------------------------------
// Set portable paths in bootstrap BEFORE app-main and server modules load.
// This keeps the runtime profile, keystore, projects, media, Codex/Copilot
// homes, Electron userData and cache beside the executable.
{
  const rel = 'desktop/bootstrap.ts';
  let s = read(rel);
  s = s.replace(
    "import { app, dialog } from 'electron';",
    "import { app, dialog } from 'electron';\nimport { mkdirSync } from 'node:fs';\nimport { dirname, join } from 'node:path';",
  );
  if (!s.includes("import { mkdirSync } from 'node:fs';") || !s.includes("import { dirname, join } from 'node:path';")) {
    throw new Error('desktop/bootstrap.ts portable imports were not applied');
  }
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

// Portable-folder builds should not try to run an installer-style self updater.
replaceRequired(
  'desktop/update-service.ts',
  "  return context.platform === 'win32' || context.platform === 'linux';",
  "  return false; // MiniCut portable folder: update by replacing the app folder.",
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
    ["title: '选择允许 Agent 访问的素材文件夹'", "title: 'Pilih folder media yang boleh diakses Agent'"],
    ["title: 'OpenChatCut'", "title: 'MiniCut'"],
    ["dialog.showErrorBox('OpenChatCut 启动失败 / failed to start', detail)", "dialog.showErrorBox('MiniCut gagal dijalankan', detail)"],
  ]);
  for (const [from, to] of replacements) s = s.split(from).join(to);

  const bootPattern = /async function boot\(\): Promise<void> \{\r?\n  await app\.whenReady\(\);/;
  if (!bootPattern.test(s)) throw new Error('desktop/main.ts boot anchor not found');
  s = s.replace(
    bootPattern,
    (match) => match + "\n  // MiniCut uses in-app controls; remove Electron's default native menu so it cannot leak another UI language.\n  Menu.setApplicationMenu(null);",
  );
  write(rel, s);
}

// ---- Gemini as MiniCut's primary agent provider ---------------------------
{
  const rel = 'shared/llm-providers.ts';
  let source = read(rel);
  const anthropic = "export const DEFAULT_LLM_PROVIDER: LlmProvider = 'anthropic';";
  const gemini = "export const DEFAULT_LLM_PROVIDER: LlmProvider = 'gemini';";
  if (source.includes(anthropic)) source = source.replace(anthropic, gemini);
  else if (!source.includes(gemini)) throw new Error('shared/llm-providers.ts default provider anchor not found');
  write(rel, source);
}
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


// ---- Manual editor parity for Gemini --------------------------------------
{
  const rel = 'src/agent/tools.ts';
  let source = read(rel);

  const importPattern = /import \{\r?\n  AGENT_RUNTIME_TOOL_NAMES,\r?\n  AGENT_RUNTIME_TOOL_SCHEMAS,\r?\n\} from '\.\/tools\/schemas\/agent-runtime-tools';/;
  if (!importPattern.test(source)) throw new Error('src/agent/tools.ts manual-parity import anchor not found');
  source = source.replace(
    importPattern,
    (match) => match + "\nimport { MANUAL_EDITOR_TOOL_NAMES, MANUAL_EDITOR_TOOL_SCHEMAS } from './tools/schemas/manual-editor-tools';",
  );

  const schemaPattern = /export const TOOL_SCHEMAS: AgentToolSchema\[\] = \[\r?\n  \.\.\.CORE_TOOL_SCHEMAS,/;
  if (!schemaPattern.test(source)) throw new Error('src/agent/tools.ts manual-parity schema anchor not found');
  source = source.replace(
    schemaPattern,
    (match) => match + "\n  ...MANUAL_EDITOR_TOOL_SCHEMAS,",
  );

  const executorPattern = /  \[AGENT_RUNTIME_TOOL_NAMES, async \(\) => \(\r?\n    await import\('\.\/tools\/agent-runtime-tools'\)\r?\n  \)\.execAgentRuntimeTool\],/;
  if (!executorPattern.test(source)) throw new Error('src/agent/tools.ts manual-parity executor anchor not found');
  source = source.replace(
    executorPattern,
    (match) => match + "\n  [MANUAL_EDITOR_TOOL_NAMES, async () => (\n    await import('./tools/manual-editor-tools')\n  ).execManualEditorTool],",
  );

  write(rel, source);
}

// ---- Indonesian Agent runtime messages ------------------------------------
{
  const patches = new Map([
    ["src/agent/tools/core-tools.ts", new Map([
      ["传 category 或用 search_templates 精确找", "Isi category atau gunakan search_templates untuk mencari dengan tepat"],
    ])],
    ["src/agent/tools/reframe-tools.ts", new Map([
      ["auto_reframe: 视频加载失败 (${src})", "auto_reframe: gagal memuat video (${src})"],
      ["auto_reframe 需要浏览器环境(视频像素采样),当前无 DOM,无法运行。", "auto_reframe memerlukan lingkungan browser untuk sampling piksel video; DOM tidak tersedia sehingga fitur tidak dapat dijalankan."],
      ["找不到视频 clip ${args.itemId ?? '(缺 itemId)'}", "Klip video tidak ditemukan: ${args.itemId ?? '(itemId tidak ada)'}"],
      ["clip ${item.id} 没有可采样的视频源(src 缺失)", "Klip ${item.id} tidak memiliki sumber video yang dapat disampling (src tidak ada)"],
      ["auto_reframe: 未能从 clip ${item.id} 采到任何帧(视频可能不可读)", "auto_reframe: tidak dapat mengambil frame dari klip ${item.id} (video mungkin tidak dapat dibaca)"],
      ["基于人像/人脸几何生成焦点（无需像素采样）。", "Titik fokus dibuat dari geometri subjek/wajah tanpa sampling piksel."],
      ["画布与源画幅接近，裁切倍率≈1；关键帧已写入，换竖屏画布后更明显。", "Rasio kanvas mendekati sumber sehingga pembesaran potong ≈1; keyframe sudah ditulis dan akan lebih terlihat pada kanvas vertikal."],
      ["reframe 关键帧已写入；用 view_timeline_frames 自检裁切是否跟主体。", "Keyframe reframe sudah ditulis; gunakan view_timeline_frames untuk memeriksa apakah crop mengikuti subjek."],
      ["auto_reframe 失败", "auto_reframe gagal"],
    ])],
    ["src/agent/tools/isolate-voice-tools.ts", new Map([
      ["缺少素材 id", "ID media belum diberikan"],
      ["找不到素材 ${query}", "Media tidak ditemukan: ${query}"],
      ["素材前缀 ${query} 不唯一", "Prefix media ${query} tidak unik"],
      ["找不到 clip ${args.itemId ?? '(缺 itemId)'}", "Klip tidak ditemukan: ${args.itemId ?? '(itemId tidak ada)'}"],
      ["isolate_voice 只适用于 video/audio，当前 kind=${item.kind}", "isolate_voice hanya berlaku untuk video/audio; jenis saat ini=${item.kind}"],
      ["本来就没有人声隔离", "Belum ada isolasi suara untuk dihapus"],
      ["sourceAssetId 必须是 video/audio，当前 kind=${sourceAsset.kind}", "sourceAssetId harus berupa video/audio; jenis saat ini=${sourceAsset.kind}"],
      ["sourceAssetId 与目标片段来源不匹配", "sourceAssetId tidak cocok dengan sumber klip target"],
      ["denoisedAssetId 必须是 audio，当前 kind=${denoisedAsset.kind}", "denoisedAssetId harus berupa audio; jenis saat ini=${denoisedAsset.kind}"],
      ["denoisedAssetId 不能与源素材相同", "denoisedAssetId tidak boleh sama dengan media sumber"],
      ["已挂载媒体池中的分离音频；源素材与共享素材均未修改。", "Audio hasil pemisahan dari pustaka media sudah dipasang; media sumber dan media bersama tidak diubah."],
      ["unknown action ${action}（用 apply、attach 或 clear）", "Aksi tidak dikenal ${action} (gunakan apply, attach, atau clear)"],
      ["isolate_voice 需要 /media/uploads 源文件（请先 finalize/上传到媒体池）。blob: 占位预览尚不可隔离。", "isolate_voice memerlukan file sumber /media/uploads (finalisasi/unggah ke pustaka media terlebih dahulu). Preview blob belum dapat diisolasi."],
      ["源素材在隔离期间已变化；派生结果已丢弃，未修改时间线。", "Media sumber berubah selama proses isolasi; hasil turunan dibuang dan linimasa tidak diubah."],
      ["isolate_voice 请求失败", "Permintaan isolate_voice gagal"],
      ["本机 ffmpeg 不可用；可外部降噪后重新导入，或安装 ffmpeg。", "FFmpeg lokal tidak tersedia; lakukan denoise di luar lalu impor kembali, atau pasang FFmpeg."],
      ["确认 dev server 已挂载 /api/isolate-voice，且源文件在 /media/uploads。", "Pastikan dev server menyediakan /api/isolate-voice dan file sumber berada di /media/uploads."],
    ])],
    ["src/agent/tools/loudness-tools.ts", new Map([
      ["timeline 上没有音频 clip", "Tidak ada klip audio pada linimasa"],
      ["源素材已变化，请重试", "Media sumber berubah; coba lagi"],
      ["解码失败: ${e instanceof Error ? e.message : String(e)}", "Gagal dekode: ${e instanceof Error ? e.message : String(e)}"],
    ])],
    ["src/agent/tools/silence-tools.ts", new Map([
      ["VAD 静音删除未启用（设置 → 本地模型 → 本地转写 → 删除静音（本地 VAD））；为避免把音乐、噪声或低声讲话当静音，未执行删除。请告知用户在该开关启用后重试。", "Penghapusan hening VAD belum diaktifkan (Pengaturan → Model lokal → Transkripsi lokal → Hapus bagian hening/VAD lokal). Agar musik, noise, atau ucapan pelan tidak salah dianggap hening, tidak ada bagian yang dihapus. Aktifkan opsi tersebut lalu coba lagi."],
      ["分析失败: ${e instanceof Error ? e.message : String(e)}", "Analisis gagal: ${e instanceof Error ? e.message : String(e)}"],
      ["删除静音", "Hapus bagian hening"],
      ["未发现可删的死气段(阈值内没有足够长的静音)", "Tidak ditemukan bagian hening yang cukup panjang untuk dihapus pada ambang saat ini"],
    ])],
    ["src/agent/tools/stock-tools.ts", new Map([
      ["该地址不可下载（${err}），请换一个可直接访问的素材地址", "Alamat ini tidak dapat diunduh (${err}); gunakan alamat media yang dapat diakses langsung"],
      ["本批次已超过 75s 时间窗口，该地址未开始下载；请再次调用，每次最多传 3 个地址", "Batch melewati jendela waktu 75 detik dan alamat ini belum mulai diunduh; panggil lagi dengan maksimal 3 alamat per batch"],
      ["无法从 URL 识别媒体类型，请传 type: video|image|audio|gif|svg|motion-graphic", "Jenis media tidak dapat dikenali dari URL; isi type: video|image|audio|gif|svg|motion-graphic"],
      ["无法连接到 ${url}", "Tidak dapat terhubung ke ${url}"],
      ["素材库搜索失败 (${res.status})", "Pencarian pustaka media gagal (${res.status})"],
      ["未配置音频素材库 API key（FREESOUND_API_KEY），可改用内置音效库或 download_media / push_asset 直接导入 URL", "API Key pustaka audio (FREESOUND_API_KEY) belum diatur; gunakan pustaka efek suara bawaan atau download_media / push_asset untuk mengimpor URL langsung"],
      ["未配置素材搜索凭据（PEXELS_API_KEY / PIXABAY_API_KEY / UNSPLASH_ACCESS_KEY / FIRECRAWL_API_KEY），可改用 download_media / push_asset 直接导入 URL", "Kredensial pencarian media belum diatur (PEXELS_API_KEY / PIXABAY_API_KEY / UNSPLASH_ACCESS_KEY / FIRECRAWL_API_KEY); gunakan download_media / push_asset untuk mengimpor URL langsung"],
    ])],
    ["src/agent/tools/timeline-tools.ts", new Map([
      ["unknown ratio ${a.ratio}（可选 ${ASPECT_PRESETS.map((p) => p.label).join('/')}）", "Rasio tidak dikenal ${a.ratio} (pilihan: ${ASPECT_PRESETS.map((p) => p.label).join('/')})"],
      ["update 需要 name / ratio / width+height / fit / hidden 至少一项", "Update memerlukan setidaknya satu dari name / ratio / width+height / fit / hidden"],
      ["至少保留一条序列、被嵌套实例引用或未找到的已跳过", "Setidaknya satu urutan harus tetap ada; urutan yang direferensikan sebagai nested instance atau tidak ditemukan dilewati"],
      ["unknown action ${args.action}（可选 list/create/duplicate/switch/update/delete/insert）", "Aksi tidak dikenal ${args.action} (pilihan: list/create/duplicate/switch/update/delete/insert)"],
    ])],
    ["src/agent/tools/captions-sources.ts", new Map([
      ["variantKind \"${vKind}\" 不支持(仅 translation)", "variantKind \"${vKind}\" tidak didukung (hanya translation)"],
      ["variant 需要 languageCode(翻译目标语言)", "Variant memerlukan languageCode (bahasa tujuan terjemahan)"],
      ["item ${itemId.slice(0, 8)} 上没有 \"${vLang}\" 翻译变体 — 先 manage_transcript translation_ensure", "Item ${itemId.slice(0, 8)} tidak memiliki varian terjemahan \"${vLang}\" — jalankan manage_transcript translation_ensure terlebih dahulu"],
      ["auto-stack 里 sources 自上而下按列表序渲染(第一个在最上);per-source 摆位/样式用 positions / source_update。", "Pada auto-stack, sources dirender mengikuti urutan daftar dari atas ke bawah (item pertama paling atas); gunakan positions / source_update untuk posisi/gaya per sumber."],
      ["cleared — 回到单源 sourceItemId", "Dibersihkan — kembali ke sourceItemId tunggal"],
      ["auto-stack:列表第一个渲染在最上。", "auto-stack: item pertama dalam daftar dirender paling atas."],
    ])],
    ["src/agent/tools/script-tools.ts", new Map([
      ["轨道「${ref}」不存在", "Trek \"${ref}\" tidak ada"],
      ["timelineMd is required（传回完整编辑后的 timeline.md）", "timelineMd wajib diisi (kirim kembali seluruh timeline.md yang sudah diedit)"],
    ])],
    ["src/agent/tools/search-tools.ts", new Map([
      ["工程 ${hit.projectId} 第 ${Number.isFinite(messageIndex) ? messageIndex + 1 : '?'} 条消息", "Proyek ${hit.projectId}, pesan ke-${Number.isFinite(messageIndex) ? messageIndex + 1 : '?'}"],
      ["工程 ${hit.projectId} 的字幕", "Subtitel proyek ${hit.projectId}"],
      ["工程 ${hit.projectId} 的转写文本", "Transkrip proyek ${hit.projectId}"],
      ["命中按相关度降序；传 projectId 可缩小范围。", "Hasil diurutkan berdasarkan relevansi; isi projectId untuk mempersempit cakupan."],
      ["无命中。尝试换关键词或 ≥3 字词（中文 2 字词已支持）。", "Tidak ada hasil. Coba kata kunci lain atau istilah yang lebih spesifik."],
    ])],
    ["src/agent/tools/renderSnapshotMedia.ts", new Map([
      ["当前环境不支持素材预览上传", "Lingkungan saat ini tidak mendukung unggahan pratinjau media"],
    ])],
    ["src/agent/tools/skill-tools.ts", new Map([
      ["当前未选创作模式。", "Belum ada mode kreatif yang dipilih."],
      ["该技能定义已被删除,模式仍挂着旧 id;可 activate 换一个或传空串清除。", "Definisi skill ini sudah dihapus tetapi mode masih menyimpan ID lama; aktifkan skill lain atau kirim string kosong untuk menghapusnya."],
      ["已清除创作模式。", "Mode kreatif sudah dibersihkan."],
      ["已切换;下一条消息会先按需加载该技能正文。", "Mode sudah diganti; pesan berikutnya akan memuat isi skill sesuai kebutuhan."],
      ["自定义技能已保存到用户技能目录，可直接编辑 ~/.openchatcut/skills/<slug>/SKILL.md", "Skill kustom sudah disimpan ke folder skill pengguna dan dapat diedit langsung di ~/.openchatcut/skills/<slug>/SKILL.md"],
    ])],
    ["src/agent/tools/highlight-tool.ts", new Map([
      ["模型输出里没有 JSON 数组", "Output model tidak berisi array JSON"],
      ["精彩片段 ${cleaned.length + 1}", "Sorotan ${cleaned.length + 1}"],
      ["片段 ${candidates.length + 1}", "Klip ${candidates.length + 1}"],
      ["当前时间线没有已转写的视频/音频片段;请先用 transcribe_track 转写,再智能切片。", "Linimasa saat ini tidak memiliki klip video/audio yang sudah ditranskripsi; jalankan transcribe_track terlebih dahulu sebelum membuat potongan cerdas."],
      ["unknown ratio ${ratio}(可选 ${ASPECT_PRESETS.map((p) => p.label).join('/')})", "Rasio tidak dikenal ${ratio} (pilihan: ${ASPECT_PRESETS.map((p) => p.label).join('/')})"],
      ["转写内容不足以选出高光片段：模型与启发式都没有候选。请确认该片段的转写完整（可用 read_transcript 查看），或换一段口播内容更丰富的片段后再试。", "Isi transkrip belum cukup untuk memilih sorotan: model dan heuristik tidak menemukan kandidat. Pastikan transkrip lengkap dengan read_transcript, atau gunakan bagian dengan isi ucapan yang lebih kaya."],
    ])],
    ["src/agent/tools/beat-tools.ts", new Map([
      ["未检出稳定节拍(低可信度守门):素材可能是语音/环境声,或节奏不稳。", "Beat stabil tidak terdeteksi (kepercayaan rendah); media mungkin berupa ucapan/ambience atau ritmenya tidak stabil."],
      ["beats 只列前 ${MAX_LISTED} 个,总数见 beatCount", "Daftar beats hanya menampilkan ${MAX_LISTED} pertama; jumlah total ada di beatCount"],
      ["节拍标记", "Penanda beat"],
    ])],
    ["src/agent/tools/schemas/skill-exec-tools.ts", new Map([
      ["在本机执行已安装技能目录内的脚本（白名单命令：bash/sh/node/npm/npx/python3/python/uv/uvx/ffmpeg/ffprobe/mkdir/cp/chmod），工作目录锁定在技能目录。用于运行技能自带的确定性脚本（如 render.mjs、check-deps.sh），云沙箱无法访问本机技能文件。超时默认 60s、上限 120s；输出最多 512KB。", "Jalankan skrip dari folder skill terpasang di komputer lokal (perintah yang diizinkan: bash/sh/node/npm/npx/python3/python/uv/uvx/ffmpeg/ffprobe/mkdir/cp/chmod). Folder kerja dikunci ke folder skill. Gunakan untuk skrip deterministik bawaan skill seperti render.mjs atau check-deps.sh. Sandbox cloud tidak dapat mengakses file skill lokal. Timeout bawaan 60 detik, maksimal 120 detik; output maksimal 512 KB."],
      ["技能 slug（load_skill 返回的 skill 字段）", "Slug skill (field skill yang dikembalikan load_skill)"],
      ["命令（首个词必须是白名单内可执行文件），如 bash scripts/check-deps.sh 或 node scripts/render.mjs", "Perintah (kata pertama harus executable yang diizinkan), misalnya bash scripts/check-deps.sh atau node scripts/render.mjs"],
      ["可选：超时毫秒，默认 60000，上限 120000", "Opsional: timeout dalam milidetik, bawaan 60000, maksimal 120000"],
    ])],
    ["src/agent/tools/music-intelligence-tools.ts", new Map([
      ["音乐卡点切分", "Potong mengikuti beat musik"],
      ["按音乐卡点插入图片", "Sisipkan gambar mengikuti beat musik"],
    ])],
    ["src/agent/tools/markers-tools.ts", new Map([
      ["transcriptSegments \"${spec}\" 无法解析——用 read_script 输出的 [sN] 编号,如 \"3\"、\"3-5\" 或 \"2,4-6\"", "transcriptSegments \"${spec}\" tidak dapat diurai — gunakan nomor [sN] dari read_script, misalnya \"3\", \"3-5\", atau \"2,4-6\""],
      ["transcriptTrack \"${trackFilter}\" 不存在或该轨无内容", "transcriptTrack \"${trackFilter}\" tidak ada atau trek tersebut kosong"],
      ["找不到同时包含段 ${sns.join(',')} 的转写区域——先 read_script 核对 [sN] 编号${trackFilter ? '' : ',或传 transcriptTrack 缩小范围'}", "Tidak ditemukan area transkrip yang memuat semua segmen ${sns.join(',')} — periksa nomor [sN] dengan read_script${trackFilter ? '' : ', atau isi transcriptTrack untuk mempersempit cakupan'}"],
      ["段 ${sns.join(',')} 在多个转写区域出现(${candidates.map((c) => `${c.track}:${c.itemId.slice(0, 8)}`).join(' / ')})——传 transcriptTrack 消歧,或直接给 fromFrame", "Segmen ${sns.join(',')} muncul di beberapa area transkrip (${candidates.map((c) => `${c.track}:${c.itemId.slice(0, 8)}`).join(' / ')}) — isi transcriptTrack untuk memilih yang tepat, atau berikan fromFrame"],
      ["转写区域对应的 clip ${cand.itemId} 已无当前转写,请重新 read_script", "Klip ${cand.itemId} pada area transkrip tidak lagi memiliki transkrip saat ini; jalankan read_script lagi"],
      ["段 ${sns.join(',')} 的词已被删除或不在播放范围内,无法定位帧——read_script 核对后重试", "Kata pada segmen ${sns.join(',')} sudah dihapus atau berada di luar rentang pemutaran sehingga frame tidak dapat ditentukan — periksa dengan read_script lalu coba lagi"],
    ])],
    ["src/agent/tools/placement-tools.ts", new Map([
      ["没有找到图形类 clip ${requested}（可用类型：motion-graphic/text/solid）", "Klip grafis tidak ditemukan: ${requested} (jenis yang tersedia: motion-graphic/text/solid)"],
      ["时间线上没有可摆放的叠加图形（motion-graphic/text/solid）。", "Tidak ada grafis overlay pada linimasa yang dapat ditempatkan (motion-graphic/text/solid)."],
      ["${item.name}（轨道已隐藏或锁定）", "${item.name} (trek disembunyikan atau dikunci)"],
      ["${item.name}（下方无视频素材）", "${item.name} (tidak ada media video di bawahnya)"],
      ["${item.name}（视频素材不在媒体池）", "${item.name} (media video tidak ada di pustaka media)"],
      ["${item.name}（几何不可用）", "${item.name} (data geometri tidak tersedia)"],
      ["${item.name}（与视频无时间重叠）", "${item.name} (tidak tumpang tindih waktunya dengan video)"],
      ["${item.name}（安全区不足以容纳）", "${item.name} (area aman tidak cukup untuk menampung elemen)"],
      ["已将 ${placed.length} 个图形移动到安全区（避开人脸/主体）。", "${placed.length} grafis dipindahkan ke area aman agar tidak menutupi wajah/subjek."],
      ["没有图形被移动；", "Tidak ada grafis yang dipindahkan; "],
      ["跳过：${skipped.join('；')}", "Dilewati: ${skipped.join('; ')}"],
      ["安全区均已可用。", "semua area aman sudah sesuai."],
    ])],
    ["src/agent/tools/caption-avoidance-tools.ts", new Map([
      ["检测到字幕遮挡，但没有可用的安全位置，未调整", "Subtitel terdeteksi menutupi subjek, tetapi tidak ada posisi aman yang tersedia; tidak diubah"],
      ["有效字幕位置由不可修改的布局策略控制，未调整", "Posisi subtitel dikendalikan oleh kebijakan layout yang tidak dapat diubah; tidak diubah"],
      ["整体字幕", "Subtitel keseluruhan"],
      ["字幕槽「${source.slotId}」", "Slot subtitel \"${source.slotId}\""],
      ["字幕条「${source.sourceId}」", "Bar subtitel \"${source.sourceId}\""],
      ["${label}已避开人脸", "${label} sudah dipindahkan agar tidak menutupi wajah"],
      ["字幕显示期间没有找到可见的视频画面，未修改字幕布局", "Tidak ditemukan gambar video yang terlihat selama subtitel tampil; layout subtitel tidak diubah"],
      ["可见视频画面的几何分析不可用，未修改字幕布局", "Analisis geometri untuk gambar video yang terlihat tidak tersedia; layout subtitel tidak diubah"],
      ["已自动避让 ${total} 处字幕布局（按可见画面与字幕时段分析人像/人脸）。", "${total} posisi subtitel otomatis disesuaikan berdasarkan wajah/subjek pada gambar dan rentang waktu subtitel."],
      ["检测到 ${blocked} 处字幕遮挡，但有效位置由不可修改的布局策略控制，未作修改。", "Terdeteksi ${blocked} subtitel menutupi subjek, tetapi posisi efektif dikendalikan kebijakan layout yang tidak dapat diubah; tidak ada perubahan."],
      ["未检测到字幕遮挡人脸，布局无需调整。", "Tidak terdeteksi subtitel menutupi wajah; layout tidak perlu diubah."],
    ])],
  ]);
  for (const [rel, replacements] of patches) {
    let source = read(rel);
    for (const [from, to] of replacements) {
      if (!source.includes(from)) throw new Error(`Agent runtime translation anchor not found: ${rel} -> ${from.slice(0, 80)}`);
      source = source.split(from).join(to);
    }
    write(rel, source);
  }
}

// ---- More Indonesian Agent runtime messages -------------------------------
{
  const patches = new Map([
    ["src/agent/tools/captions-actions.ts", new Map([
      ["layout 移动整块字幕,参数例:{\"preset\":\"bottom-center\"}(3×3 锚点/top/bottom/center)或 {\"offsetXRatio\":0.1,\"offsetYRatio\":-0.05} 微调;要把多条字幕分开摆(如英文上/中文下)用 action=positions,不是 layout", "layout memindahkan seluruh blok subtitel. Contoh: {\"preset\":\"bottom-center\"} untuk anchor 3×3 atau {\"offsetXRatio\":0.1,\"offsetYRatio\":-0.05} untuk penyesuaian halus. Untuk memisahkan beberapa subtitel, gunakan action=positions, bukan layout"],
    ])],
    ["src/agent/tools/captions-lanes.ts", new Map([
      ["no source with id \"${id}\" (source_list 查 sourceId)", "no source with id \"${id}\" (lihat sourceId melalui source_list)"],
      ["speakerId selector 不支持:无 per-speaker 车道,请按轨/按 item 选择", "Selector speakerId tidak didukung karena tidak ada lane per pembicara; pilih berdasarkan trek atau item"],
      ["缺选择器:每条要带 index / sourceId / trackId / itemId / label / variant 之一定位车道,例 {\"index\":0} 或 {\"trackId\":\"A2\"} 或 {\"variant\":{\"languageCode\":\"en\"}};sourceId 用 source_list 查", "Selector belum diberikan: setiap entri harus memakai salah satu dari index / sourceId / trackId / itemId / label / variant. Contoh {\"index\":0}, {\"trackId\":\"A2\"}, atau {\"variant\":{\"languageCode\":\"en\"}}; cari sourceId dengan source_list"],
      ["cleared — 回到默认 auto-stack", "Dibersihkan — kembali ke auto-stack bawaan"],
      ["manual-slots 要给槽位表,例 {\"mode\":\"manual-slots\",\"slots\":[{\"id\":\"top\",\"anchor\":\"top-center\",\"offsetYRatio\":0.08},{\"id\":\"bottom\",\"anchor\":\"bottom-center\",\"offsetYRatio\":-0.08}]};再用 source_update 把车道 slotId 钉到槽位", "manual-slots memerlukan daftar slot, misalnya {\"mode\":\"manual-slots\",\"slots\":[{\"id\":\"top\",\"anchor\":\"top-center\",\"offsetYRatio\":0.08},{\"id\":\"bottom\",\"anchor\":\"bottom-center\",\"offsetYRatio\":-0.08}]}; kemudian gunakan source_update untuk memasang slotId lane ke slot"],
      ["slot 非法:${JSON.stringify(sl)}(需 id + 3×3 anchor)", "Slot tidak valid: ${JSON.stringify(sl)} (memerlukan id + anchor 3×3)"],
      ["layout_policy 参数例:{\"mode\":\"auto-stack\",\"maxVisibleSources\":2}(上下堆叠)/ {\"mode\":\"single-lane\"}(同位只显一条)/ {\"mode\":\"manual-slots\",\"slots\":[…]} / {\"perSource\":{\"<sourceId>\":{\"maxLines\":2}}} / {\"layoutPolicy\":null} 清除", "Contoh layout_policy: {\"mode\":\"auto-stack\",\"maxVisibleSources\":2} / {\"mode\":\"single-lane\"} / {\"mode\":\"manual-slots\",\"slots\":[…]} / {\"perSource\":{\"<sourceId>\":{\"maxLines\":2}}} / {\"layoutPolicy\":null} untuk menghapus"],
      ["perSource.maxLines 按 maxLines×模板每页词数近似(分页按词数)", "perSource.maxLines diperkirakan dari maxLines × jumlah kata per halaman template"],
      ["positions 参数例(可直接照抄改数):{\"positions\":[{\"index\":0,\"anchor\":\"top-center\",\"offsetYRatio\":0.08},{\"index\":1,\"anchor\":\"bottom-center\",\"offsetYRatio\":-0.08}]}——每条 = 选择器(index/sourceId/trackId/variant…)+ anchor(3×3);同 anchor 会堆叠成一块", "Contoh positions: {\"positions\":[{\"index\":0,\"anchor\":\"top-center\",\"offsetYRatio\":0.08},{\"index\":1,\"anchor\":\"bottom-center\",\"offsetYRatio\":-0.08}]}; setiap entri = selector (index/sourceId/trackId/variant…) + anchor 3×3; sumber dengan anchor sama akan ditumpuk"],
      ["当前没有字幕 source:先 edit_captions action=enable 开字幕(或 source_set 指定 sources),再来摆位", "Belum ada sumber subtitel; jalankan edit_captions action=enable atau tentukan sources dengan source_set sebelum mengatur posisi"],
      ["anchor 非法:\"${anchor}\"。用 3×3 锚点:top/middle/bottom × left/center/right,如 top-center / bottom-center / middle-left", "Anchor tidak valid: \"${anchor}\". Gunakan anchor 3×3 top/middle/bottom × left/center/right, misalnya top-center / bottom-center / middle-left"],
      ["同 anchor 的多个 source 在该锚点堆叠为一个普通字幕块;像素级 left/top 用 action=layout(整块)", "Beberapa source dengan anchor yang sama akan ditumpuk menjadi satu blok subtitel; untuk posisi left/top tingkat piksel gunakan action=layout pada seluruh blok"],
      ["source_update 参数例(可直接照抄改数):{\"updates\":[{\"index\":0,\"anchor\":\"bottom-center\",\"offsetYRatio\":-0.08},{\"trackId\":\"A2\",\"visible\":false},{\"index\":1,\"style\":{\"sizePx\":54,\"color\":\"#fff\"}}]}——每条 = 选择器 + 要改的字段(visible/anchor/offsetXRatio/offsetYRatio/slotId/style/preset/variant);sourceId 用 source_list 查", "Contoh source_update: {\"updates\":[{\"index\":0,\"anchor\":\"bottom-center\",\"offsetYRatio\":-0.08},{\"trackId\":\"A2\",\"visible\":false},{\"index\":1,\"style\":{\"sizePx\":54,\"color\":\"#fff\"}}]}; setiap entri = selector + field yang diubah (visible/anchor/offsetXRatio/offsetYRatio/slotId/style/preset/variant); cari sourceId dengan source_list"],
      ["当前没有字幕 source:先 edit_captions action=enable 开字幕(或 source_set 指定 sources)", "Belum ada sumber subtitel; jalankan edit_captions action=enable atau tentukan sources dengan source_set"],
      ["anchor 非法:\"${anchor}\"。用 3×3 锚点,如 top-center / bottom-center / middle-left", "Anchor tidak valid: \"${anchor}\". Gunakan anchor 3×3 seperti top-center / bottom-center / middle-left"],
      ["variantKind \"${vKind}\" 不支持(仅 translation)", "variantKind \"${vKind}\" tidak didukung (hanya translation)"],
      ["variant 切换要给翻译目标语言,例 {\"variant\":{\"variantKind\":\"translation\",\"languageCode\":\"en\"}} 或简写 {\"languageCode\":\"en\"}", "Pergantian variant memerlukan bahasa tujuan, misalnya {\"variant\":{\"variantKind\":\"translation\",\"languageCode\":\"en\"}} atau singkatnya {\"languageCode\":\"en\"}"],
      ["item ${e.itemId.slice(0, 8)} 上没有 \"${vLang}\" 翻译变体 — 先 manage_transcript translation_ensure", "Item ${e.itemId.slice(0, 8)} tidak memiliki varian terjemahan \"${vLang}\" — jalankan manage_transcript translation_ensure terlebih dahulu"],
      ["style 忽略字段:${mapped.ignored.join(',')}", "Field style yang diabaikan: ${mapped.ignored.join(',')}"],
    ])],
    ["src/agent/tools/edit-asset-tools.ts", new Map([
      ["${refs} 个时间线片段引用了「${asset.name}」。删除只移除媒体池条目,不影响已放置片段。确认请带 confirm:true 重发。", "${refs} klip linimasa mereferensikan \"${asset.name}\". Penghapusan hanya menghapus entri dari pustaka media dan tidak memengaruhi klip yang sudah ditempatkan. Kirim ulang dengan confirm:true untuk mengonfirmasi."],
    ])],
    ["src/agent/tools/edit-item-commit.ts", new Map([
      ["文字", "Teks"],
      ["纯色", "Warna solid"],
    ])],
    ["src/agent/tools/edit-item-generic.ts", new Map([
      ["文字", "Teks"],
    ])],
    ["src/agent/tools/edit-item-validate.ts", new Map([
      ["该插件未安装或该 id 不是转场条目;用 browse_library category=transitions 查可用清单", "Plugin belum dipasang atau ID bukan item transisi; gunakan browse_library category=transitions untuk melihat daftar yang tersedia"],
    ])],
    ["src/agent/tools/effect-tools.ts", new Map([
      ["unknown action ${args.action}（可选 list/add/update/remove）", "Aksi tidak dikenal ${args.action} (pilihan: list/add/update/remove)"],
    ])],
    ["src/agent/tools/followup-tools.ts", new Map([
      ["display.startsWith('其他') || display.startsWith('other')", "display.startsWith('lain') || display.startsWith('other')"],
    ])],
    ["src/agent/tools/frames-tool.ts", new Map([
      ["render-still 请求失败: ${e instanceof Error ? e.message : String(e)}", "Permintaan render-still gagal: ${e instanceof Error ? e.message : String(e)}"],
      ["源资产「${asset.name}」contact sheet", "Contact sheet media sumber \"${asset.name}\""],
      ["（未进时间线合成；每格≈对应源时间区间中点）", "(belum dikomposisikan ke linimasa; tiap sel ≈ titik tengah rentang waktu sumber)"],
      ["时间线「${state.name}」${frames.length} 帧（绝对时间线坐标 f${frames.join(', f')}，共 ${total} @${state.fps}fps）——目标时间线草稿合成画面（含未提交编辑）", "Linimasa \"${state.name}\" ${frames.length} frame (koordinat absolut f${frames.join(', f')}, total ${total} @${state.fps}fps) — komposit draf linimasa target termasuk edit yang belum disimpan"],
      ["item ${item.id} 可见源窗口 [${sourceWindow.startFrame}, ${sourceWindow.endFrame})", "item ${item.id} jendela sumber terlihat [${sourceWindow.startFrame}, ${sourceWindow.endFrame})"],
      ["完整源窗口 [${sourceWindow.startFrame}, ${sourceWindow.endFrame})", "jendela sumber penuh [${sourceWindow.startFrame}, ${sourceWindow.endFrame})"],
      ["源资产「${asset.name}」blob 预览 · ${windowNote}", "Media sumber \"${asset.name}\" pratinjau blob · ${windowNote}"],
      ["源资产「${asset.name}」blob contact sheet · ${sheet.sampleCount} samples · cells L→R T→B: ${labelLine} · ${windowNote}", "Media sumber \"${asset.name}\" contact sheet blob · ${sheet.sampleCount} sampel · sel kiri→kanan atas→bawah: ${labelLine} · ${windowNote}"],
      ["源资产「${asset.name}」${frames.length} 帧（源坐标 f${frames.join(', f')}，共 ${total}）——单独预览，未合成到时间线 · ${windowNote}", "Media sumber \"${asset.name}\" ${frames.length} frame (koordinat sumber f${frames.join(', f')}, total ${total}) — pratinjau terpisah, belum dikomposisikan ke linimasa · ${windowNote}"],
    ])],
    ["src/agent/tools/install-skill-tools.ts", new Map([
      ["技能已安装到用户技能目录（~/.openchatcut/skills/<slug>/），资源库「技能」面板会自动展示。可以在对话中 /skill:<slug> 或从面板激活。", "Skill sudah dipasang ke folder skill pengguna (~/.openchatcut/skills/<slug>/). Panel Skill di Pustaka akan menampilkannya otomatis. Aktifkan melalui /skill:<slug> atau dari panel."],
    ])],
    ["src/agent/tools/layout-tools.ts", new Map([
      ["应用布局 ${layout}", "Terapkan layout ${layout}"],
    ])],
    ["src/agent/tools/library-catalog.ts", new Map([
      ["Library UI: 资源库 → 音频效果.", "UI Pustaka: Pustaka → Efek audio."],
    ])],
    ["src/agent/tools/multicam-tools.ts", new Map([
      ["切换机位", "Ganti kamera"],
    ])],
    ["src/agent/tools/project-tools.ts", new Map([
      ["新工程", "Proyek Baru"],
      ["speaker-update needs {from:\"A\", to:\"新名字\"} — from = existing speaker label, to = new name", "speaker-update memerlukan {from:\"A\", to:\"Nama Baru\"} — from = label pembicara saat ini, to = nama baru"],
    ])],
    ["src/agent/tools/schemas/captions-tools.ts", new Map([
      ["toolbar 字幕显示", "tombol tampilkan subtitel"],
    ])],
    ["src/agent/tools/schemas/font-tools.ts", new Map([
      ["(case/punctuation-insensitive) — e.g. \"inter\", \"playfair\", \"noto sc\", \"思源黑体\", \"得意黑\",", "(tidak peka huruf besar/kecil atau tanda baca) — misalnya \"inter\", \"playfair\", \"noto sans\", \"roboto\", \"montserrat\","],
      ["\"抖音美好体\". loadable=false means catalogued only; prefer a loadable alternative or", "\"poppins\". loadable=false berarti hanya ada di katalog; utamakan alternatif yang dapat dimuat atau"],
    ])],
    ["src/agent/tools/schemas/install-skill-tools.ts", new Map([
      ["从 GitHub 安装一个 skill 仓库到本机技能目录（~/.openchatcut/skills/<slug>/），完整安装 SKILL.md 及其 references/scripts/assets/examples。安装后资源库「技能」面板会自动展示，可用 /skill:<slug> 或面板激活。repo 支持 GitHub URL 或 owner/repo（如 \"Jane-xiaoer/paper-collage-ad-codex\"）。slug 可选，默认取 SKILL.md 的 name 或仓库名。", "Pasang repository skill dari GitHub ke folder skill lokal (~/.openchatcut/skills/<slug>/), termasuk SKILL.md serta references/scripts/assets/examples. Setelah dipasang, panel Skill di Pustaka menampilkannya otomatis dan dapat diaktifkan dengan /skill:<slug> atau dari panel. repo menerima URL GitHub atau owner/repo (misalnya \"Jane-xiaoer/paper-collage-ad-codex\"). slug opsional dan secara bawaan memakai name dari SKILL.md atau nama repository."],
      ["GitHub 仓库：完整 URL（https://github.com/owner/repo）或 owner/repo", "Repository GitHub: URL lengkap (https://github.com/owner/repo) atau owner/repo"],
      ["可选：安装目录名（必须 kebab-case），默认取 SKILL.md frontmatter name 或仓库名", "Opsional: nama folder instalasi (harus kebab-case), bawaan memakai name pada frontmatter SKILL.md atau nama repository"],
    ])],
    ["src/agent/tools/schemas/search-tools.ts", new Map([
      ["Content to find, e.g. 背景音乐音量 / 字幕样式 / 黄昏的海边", "Konten yang dicari, misalnya volume musik latar / gaya subtitel / pantai saat senja"],
    ])],
    ["src/agent/tools/schemas/transcript-tools.ts", new Map([
      ["Transcript panel 「还原全部」", "panel Transkrip \"Pulihkan Semua\""],
    ])],
    ["src/agent/tools/schemas/version-tools.ts", new Map([
      ["save: display name for the checkpoint (e.g. \"粗剪完成\").", "save: nama tampilan untuk checkpoint (misalnya \"Rough Cut Selesai\")."],
    ])],
    ["src/agent/tools/shader-tools.ts", new Map([
      ["生成的着色器为空", "Shader yang dihasilkan kosong"],
      ["着色器过长（${src.length} > ${MAX_GLSL_LEN}）", "Shader terlalu panjang (${src.length} > ${MAX_GLSL_LEN})"],
      ["禁止的指令：${tok}", "Instruksi terlarang: ${tok}"],
      ["着色器必须采样输入贴图 u_input", "Shader harus melakukan sampling tekstur input u_input"],
      ["着色器缺少 main() 入口", "Shader tidak memiliki entry main()"],
      ["着色器必须写出颜色（fragColor / gl_FragColor）", "Shader harus menulis warna (fragColor / gl_FragColor)"],
      ["未知的采样器（运行时只提供 u_input）：${unknown.join(', ')}", "Sampler tidak dikenal (runtime hanya menyediakan u_input): ${unknown.join(', ')}"],
      ["自定义着色器", "Shader kustom"],
      ["submit_shader 自定义效果：${display}", "Efek kustom submit_shader: ${display}"],
      ["转场着色器必须采样前一段 u_outgoing", "Shader transisi harus melakukan sampling segmen sebelumnya u_outgoing"],
      ["转场着色器必须采样后一段 u_incoming", "Shader transisi harus melakukan sampling segmen berikutnya u_incoming"],
      ["转场着色器必须用进度 u_progress（0→1）驱动混合", "Shader transisi harus menggunakan progress u_progress (0→1) untuk mengendalikan campuran"],
      ["未知的采样器（运行时只提供 u_outgoing / u_incoming）：${unknown.join(', ')}", "Sampler tidak dikenal (runtime hanya menyediakan u_outgoing / u_incoming): ${unknown.join(', ')}"],
      ["自定义转场", "Transisi kustom"],
      ["着色器编译失败", "Kompilasi shader gagal"],
      ["（默认 ${p.default}，范围 ${p.min}..${p.max}）", "(bawaan ${p.default}, rentang ${p.min}..${p.max})"],
    ])],
  ]);
  for (const [rel, replacements] of patches) {
    let source = read(rel);
    for (const [from, to] of replacements) {
      if (!source.includes(from)) throw new Error(`Agent runtime translation anchor not found: ${rel} -> ${from.slice(0, 80)}`);
      source = source.split(from).join(to);
    }
    write(rel, source);
  }
}

// ---- MiniCut settings: Gemini-only AI surface --------------------------------
{
  const rel = 'src/components/settings/settingsSchema.ts';
  let source = read(rel);
  const start = source.indexOf('export const SETTINGS_CATEGORIES: readonly SettingsCategory[] = [');
  const stagedMarker = 'export type StagedValues = Record<string, string>;';
  const staged = source.indexOf(stagedMarker, start);
  const end = staged < 0 ? -1 : source.lastIndexOf('];', staged);
  if (start < 0 || staged < 0 || end < 0) throw new Error('settings category block not found');

  const replacement = `export const SETTINGS_CATEGORIES: readonly SettingsCategory[] = [
  {
    key: 'agent', title: 'Gemini Agent', icon: 'sparkles',
    groups: [
      {
        key: 'llm',
        title: 'Google Gemini',
        hint: 'Satu-satunya AI Agent di MiniCut.',
        vendors: AGENT_VENDOR_PAGES_WITH_VISION,
      },
    ],
  },
  {
    key: 'proxy', title: 'Proxy jaringan', icon: 'plug',
    groups: [
      {
        key: 'proxy',
        title: 'Proxy jaringan',
        hint: 'Opsional, hanya jika koneksi Gemini memerlukan proxy.',
        vendors: [PROXY_PAGE],
      },
    ],
  },
  {
    key: 'assets', title: 'Media · Transkripsi', icon: 'folder',
    groups: [
      {
        key: 'stock',
        title: 'Media stok online',
        hint: 'Pencarian media stok untuk bahan edit; bukan model AI.',
        vendors: [
          { key: 'stock/pexels', vendor: 'pexels', title: 'Pexels', fields: [secret('PEXELS_API_KEY', 'API Key')] },
          { key: 'stock/pixabay', vendor: 'pixabay', title: 'Pixabay', fields: [secret('PIXABAY_API_KEY', 'API Key')] },
          { key: 'stock/unsplash', vendor: 'unsplash', title: 'Unsplash', fields: [secret('UNSPLASH_ACCESS_KEY', 'Access Key')] },
          { key: 'stock/freesound', vendor: 'freesound', title: 'Freesound', fields: [secret('FREESOUND_API_KEY', 'API Key')] },
        ],
      },
      {
        key: 'transcription',
        title: 'Transkripsi lokal',
        hint: 'Whisper lokal: gratis, offline, dan tidak memakai AI API lain.',
        vendors: [localAsrPage],
      },
    ],
  },
  {
    key: 'cloud', title: 'Penyimpanan', icon: 'cloud',
    groups: [
      {
        key: 'storage',
        title: 'Lokasi proyek bawaan',
        hint: 'Atur lokasi proyek dan cadangan opsional.',
        vendors: [
          {
            key: 'storage/projects', vendor: 'localdisk', title: 'Lokasi proyek bawaan',
            note: 'Proyek, riwayat versi, dan media buatan aplikasi disimpan di sini.',
            fields: [
              directory('OPENCHATCUT_DATA_DIR', 'Lokasi proyek bawaan', 'Folder data bawaan aplikasi',
                'Klik Pilih folder di desktop, atau isi path absolut secara manual.'),
            ],
          },
          {
            key: 'storage/r2', vendor: 'r2', title: 'Cloudflare R2',
            note: 'Opsional untuk cadangan cloud. Ini layanan penyimpanan, bukan model AI.',
            fields: [
              { name: 'R2_ENABLED', label: 'Sinkronisasi cloud', kind: 'toggle' },
              secret('R2_ACCOUNT_ID', 'Account ID'),
              secret('R2_ACCESS_KEY_ID', 'Access Key ID'),
              secret('R2_SECRET_ACCESS_KEY', 'Secret Access Key'),
              secret('R2_BUCKET', 'Nama bucket'),
            ],
          },
        ],
      },
    ],
  },
  {
    key: 'tools', title: 'Alat lanjutan', icon: 'sliders',
    groups: [
      {
        key: 'sandbox',
        title: 'Sandbox',
        hint: 'Opsional untuk menjalankan skrip alat secara terisolasi; bukan model AI.',
        vendors: [{
          key: 'sandbox/e2b', vendor: 'e2b', title: 'E2B',
          fields: [
            secret('E2B_API_KEY', 'API Key'),
            text('E2B_TEMPLATE', 'ID template (opsional)'),
          ],
        }],
      },
      {
        key: 'web',
        title: 'Pengambilan data web',
        hint: 'Opsional untuk mengambil isi halaman web; bukan model AI.',
        vendors: [{
          key: 'web/firecrawl', vendor: 'firecrawl', title: 'Firecrawl',
          fields: [secret('FIRECRAWL_API_KEY', 'API Key')],
        }],
      },
    ],
  },
  {
    key: 'interface', title: 'Antarmuka', icon: 'layoutPanel',
    groups: [
      {
        key: 'display',
        title: 'Tampilan',
        hint: 'Atur skala antarmuka MiniCut.',
        vendors: [{
          key: 'display/scale', vendor: 'localasr', title: 'Skala antarmuka',
          fields: [{
            name: 'UI_SCALE', label: 'Skala antarmuka', kind: 'select', defaultLabel: '100%',
            options: [
              { value: '0.8', label: '80%' },
              { value: '0.9', label: '90%' },
              { value: '1', label: '100%' },
              { value: '1.1', label: '110%' },
              { value: '1.25', label: '125%' },
              { value: '1.5', label: '150%' },
            ],
          }],
        }],
      },
    ],
  },
  {
    key: 'local', title: 'Model lokal', icon: 'database',
    groups: [
      {
        key: 'local',
        title: 'Model lokal',
        hint: 'Model lokal untuk transkripsi, beat, musik, dan pencarian visual. Data tetap di komputer.',
        vendors: [
          { key: 'local/asr', vendor: 'localasr', title: 'Transkripsi lokal', icon: 'mic', kind: 'local-models', fields: localAsrPage.fields },
          { key: 'local/music/packs', vendor: 'localasr', title: 'Beat & analisis musik', icon: 'music', kind: 'local-models', fields: [] },
          { key: 'local/semantic/setup', vendor: 'localasr', title: 'Pencarian visual lokal', icon: 'search', kind: 'local-models', fields: [] },
        ],
      },
    ],
  },
];`;

  source = source.slice(0, start) + replacement + source.slice(end + 2);

  // The Gemini-only settings tree no longer uses upstream multi-provider
  // generation helpers. Remove them rather than leaving dead imports that fail
  // TypeScript's noUnusedLocals release build.
  source = source
    .replace("import type { VendorId } from './vendorIcons';\n", '')
    .replace('  modelPicker,\n', '')
    .replace('  modelText,\n', '')
    .replace('  routeSelect,\n', '')
    .replace('  TRANSCRIPTION_SETTINGS_GROUP,\n', '')
    .replace('  VOICE_SETTINGS_GROUP,\n', '');
  const providerHelpersStart = source.indexOf("const MINIMAX_NOTE =");
  const categoriesStart = source.indexOf('export const SETTINGS_CATEGORIES: readonly SettingsCategory[] = [');
  if (providerHelpersStart >= 0 && categoriesStart > providerHelpersStart) {
    source = source.slice(0, providerHelpersStart) + source.slice(categoriesStart);
  }

  write(rel, source);
}

console.log('MiniCut overlay applied successfully.');
