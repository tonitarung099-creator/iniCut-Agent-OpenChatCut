/**
 * MiniCut Indonesian-only UI translation bridge.
 *
 * OpenChatCut uses Chinese source strings as i18n keys. MiniCut never renders
 * those keys directly. We resolve through the upstream English dictionary and
 * then convert supported UI copy to Indonesian. Unknown non-technical copy is
 * replaced with a safe Indonesian placeholder instead of leaking another
 * language into the interface.
 */

const DIRECT: Record<string, string> = {
  // Top bar / common actions
  'Switch UI language': 'Bahasa antarmuka',
  'Back to projects': 'Kembali ke proyek',
  'Double-click to rename': 'Klik dua kali untuk mengganti nama',
  'Edit keyboard shortcuts': 'Edit pintasan keyboard',
  'Undo': 'Urungkan',
  'Redo': 'Ulangi',
  'Design style (brand)': 'Gaya desain (merek)',
  'Version History': 'Riwayat versi',
  'Toggle panel layout': 'Ubah tata letak panel',
  'Export MP4': 'Ekspor MP4',
  'Exporting…': 'Mengekspor…',
  'Export': 'Ekspor',
  'Account': 'Akun',
  'Window controls': 'Kontrol jendela',
  'Close window': 'Tutup jendela',
  'Minimize window': 'Minimalkan jendela',
  'Zoom window': 'Perbesar jendela',
  'Settings': 'Pengaturan',
  'Close': 'Tutup',
  'Cancel': 'Batal',
  'Save': 'Simpan',
  'Open': 'Buka',
  'Delete': 'Hapus',
  'Remove': 'Hapus',
  'Add': 'Tambah',
  'Edit': 'Edit',
  'Copy': 'Salin',
  'Paste': 'Tempel',
  'Cut': 'Potong',
  'Search': 'Cari',
  'Reset': 'Atur ulang',
  'Retry': 'Coba lagi',
  'Continue': 'Lanjutkan',
  'Confirm': 'Konfirmasi',
  'Apply': 'Terapkan',
  'Done': 'Selesai',
  'Loading…': 'Memuat…',
  'Processing…': 'Memproses…',
  'Project': 'Proyek',
  'Projects': 'Proyek',
  'New project': 'Proyek baru',
  'Media': 'Media',
  'Timeline': 'Linimasa',
  'Transcript': 'Transkrip',
  'Captions': 'Takarir',
  'Subtitle': 'Subtitel',
  'Subtitles': 'Subtitel',
  'Audio': 'Audio',
  'Video': 'Video',
  'Image': 'Gambar',
  'Images': 'Gambar',
  'Text': 'Teks',
  'Effects': 'Efek',
  'Transitions': 'Transisi',
  'Speed': 'Kecepatan',
  'Volume': 'Volume',
  'Opacity': 'Opasitas',
  'Position': 'Posisi',
  'Rotation': 'Rotasi',
  'Scale': 'Skala',
  'Duration': 'Durasi',
  'Start': 'Mulai',
  'End': 'Akhir',
  'Name': 'Nama',
  'Type': 'Jenis',
  'Status': 'Status',
  'Error': 'Kesalahan',
  'Warning': 'Peringatan',
  'Success': 'Berhasil',
  'Failed': 'Gagal',
  'Ready': 'Siap',
  'Enabled': 'Aktif',
  'Disabled': 'Nonaktif',
  'Auto': 'Otomatis',
  'Manual': 'Manual',
  'Default': 'Bawaan',
  'Advanced': 'Lanjutan',
  'General': 'Umum',
  'Language': 'Bahasa',
  'Model': 'Model',
  'Provider': 'Penyedia',
  'Agent': 'Agent',
  'AI Chat': 'Chat AI',
  'Reasoning': 'Penalaran',
  'API Key': 'API Key',
  'Base URL': 'Base URL',
  'Export directory': 'Folder ekspor',
  'Select export directory': 'Pilih folder ekspor',
  'Select export file': 'Pilih file ekspor',
  'Select media save directory': 'Pilih folder penyimpanan media',
  'No clips were modified.': 'Tidak ada klip yang diubah.',
  'Voice isolation failed; no clips were modified.': 'Pemisahan suara gagal; tidak ada klip yang diubah.',
  'Loudness analysis failed; no clips were modified.': 'Analisis kenyaringan gagal; tidak ada klip yang diubah.',
  'Source media changed; the previous voice separation result was discarded. Retry.':
    'Media sumber berubah; hasil pemisahan suara sebelumnya dibuang. Coba lagi.',
  'Punch': 'Hentakan',
  'Push & Pull Back': 'Dorong & Tarik Kembali',
  'Slow Push': 'Dorong Perlahan',
  'Instant': 'Instan',
  'Zoom Out': 'Perkecil',
  'Ease-In Push': 'Dorong Masuk Halus',
  'Bouncy Push': 'Dorong Memantul',
  'Snap Push': 'Dorong Cepat',
  'Pulse': 'Denyut',
  'Whip-In Push': 'Dorong Masuk Cepat',
  'Anticipation Zoom': 'Zoom Antisipasi',
  'Clean Line Wipe': 'Sapuan Garis Bersih',
  'Cross Dissolve': 'Dissolve Silang',
  'Dip to Black': 'Redup ke Hitam',
  'Flash': 'Kilat',
  'Impact Shake': 'Guncangan Dampak',
  'Luma Blend': 'Campuran Luma',
  'Organic Dissolve': 'Dissolve Organik',
  'Page Curl': 'Lipatan Halaman',
  'Rack Focus': 'Peralihan Fokus',
  'Soft Wipe': 'Sapuan Halus',
  'Whip Pan': 'Whip Pan',
  'Circle Wipe': 'Sapuan Lingkaran',

  // Chinese source keys that are used outside the regular dictionary path.
  '选择素材保存目录': 'Pilih folder penyimpanan media',
  '选择导出目录': 'Pilih folder ekspor',
  '所选导出目录不可用': 'Folder ekspor yang dipilih tidak dapat digunakan',
  '选择导出文件': 'Pilih file ekspor',
  '导出文件名无效': 'Nama file ekspor tidak valid',
  '文字稿': 'Transkrip',
};

const TECHNICAL_EXACT = new Set([
  'Gemini', 'Google Gemini', 'OpenAI', 'Anthropic', 'FFmpeg', 'FFprobe',
  'FPS', 'SRT', 'MCP', 'GPU', 'CPU', 'JSON', 'MP4', 'MOV', 'WebM',
  'API', 'API Key', 'Base URL', 'URL', 'HTTP', 'HTTPS', 'WebGPU',
  'Whisper', 'Remotion', 'Electron', 'SQLite', 'ONNX',
]);

const HAS_CJK = /[\u3400-\u9FFF\uF900-\uFAFF]/;
const URL_OR_PATH = /^(?:https?:\/\/|file:|[A-Za-z]:[\\/]|\/|\.\.?[\\/])/;
const MODELISH = /^(?:[A-Za-z0-9_.:+/@-]+)(?:\s+[A-Za-z0-9_.:+/@-]+){0,2}$/;

function replaceCommonEnglish(input: string): string {
  let out = input;
  const replacements: Array<[RegExp, string]> = [
    [/\bExporting\b/gi, 'Mengekspor'],
    [/\bExport\b/gi, 'Ekspor'],
    [/\bImporting\b/gi, 'Mengimpor'],
    [/\bImport\b/gi, 'Impor'],
    [/\bSettings\b/gi, 'Pengaturan'],
    [/\bProject(s)?\b/gi, 'Proyek'],
    [/\bTimeline\b/gi, 'Linimasa'],
    [/\bTranscript\b/gi, 'Transkrip'],
    [/\bCaption(s)?\b/gi, 'Takarir'],
    [/\bSubtitle(s)?\b/gi, 'Subtitel'],
    [/\bDelete\b/gi, 'Hapus'],
    [/\bRemove\b/gi, 'Hapus'],
    [/\bAdd\b/gi, 'Tambah'],
    [/\bSave\b/gi, 'Simpan'],
    [/\bCancel\b/gi, 'Batal'],
    [/\bClose\b/gi, 'Tutup'],
    [/\bOpen\b/gi, 'Buka'],
    [/\bBack\b/gi, 'Kembali'],
    [/\bRetry\b/gi, 'Coba lagi'],
    [/\bLoading\b/gi, 'Memuat'],
    [/\bProcessing\b/gi, 'Memproses'],
    [/\bFailed\b/gi, 'Gagal'],
    [/\bError\b/gi, 'Kesalahan'],
    [/\bWarning\b/gi, 'Peringatan'],
    [/\bSelect\b/gi, 'Pilih'],
    [/\bDirectory\b/gi, 'Folder'],
    [/\bFolder\b/gi, 'Folder'],
    [/\bFile\b/gi, 'File'],
    [/\bModel\b/gi, 'Model'],
    [/\bProvider\b/gi, 'Penyedia'],
    [/\bReasoning\b/gi, 'Penalaran'],
    [/\bLanguage\b/gi, 'Bahasa'],
    [/\bHistory\b/gi, 'Riwayat'],
    [/\bWindow\b/gi, 'Jendela'],
  ];
  for (const [pattern, replacement] of replacements) out = out.replace(pattern, replacement);
  return out;
}

function containsObviousEnglishSentence(text: string): boolean {
  return /\b(the|this|that|with|from|for|and|or|your|you|is|are|was|were|to|of|in|on|when|while|cannot|could|should|please)\b/i.test(text);
}

export function indonesianUiText(input: unknown, original?: unknown): string {
  const rawOriginal = typeof original === 'string' ? original.trim() : '';
  if (rawOriginal && DIRECT[rawOriginal]) return DIRECT[rawOriginal]!;

  const raw = typeof input === 'string' ? input.trim() : '';
  if (!raw) return '';
  if (DIRECT[raw]) return DIRECT[raw]!;
  if (TECHNICAL_EXACT.has(raw)) return raw;
  if (URL_OR_PATH.test(raw)) return raw;
  if (!/[A-Za-z\u3400-\u9FFF\uF900-\uFAFF]/.test(raw)) return raw;

  if (HAS_CJK.test(raw)) return 'Teks antarmuka belum diterjemahkan';

  const converted = replaceCommonEnglish(raw);
  if (converted !== raw && !containsObviousEnglishSentence(converted)) return converted;

  // Short model IDs / format names are technical identifiers, not UI prose.
  if (MODELISH.test(raw) && (/[0-9_.:/@-]/.test(raw) || raw.length <= 5)) return raw;

  // Never leak an untranslated foreign-language sentence into the MiniCut UI.
  return 'Teks antarmuka belum diterjemahkan';
}

export function containsCjk(input: unknown): boolean {
  return typeof input === 'string' && HAS_CJK.test(input);
}
