import {
  LLM_PROVIDER_PRESETS,
  isLocalLlmProvider,
  llmProviderConfigNames,
} from '../../../shared/llm-providers';
import type { VendorId } from './vendorIcons';
import { secret, text, type SettingsVendorPage } from './settingsFields';

const llmPage = (preset: (typeof LLM_PROVIDER_PRESETS)[number]): SettingsVendorPage => {
  const names = llmProviderConfigNames(preset.id);
  return {
    key: `llm/${preset.id}`,
    vendor: preset.id as VendorId,
    title: preset.label,
    note: preset.id === 'gemini'
      ? 'Gemini adalah Agent utama MiniCut. Kolom API Key dapat diisi 1 sampai 100 key; pisahkan dengan koma. MiniCut akan merotasi key di sisi server.'
      : preset.id === 'anthropic'
        ? 'Agent bawaan juga dapat memakai Anthropic API Key. Untuk Claude Code melalui MCP, gunakan panel Agent eksternal.'
        : 'Setiap penyedia menyimpan alamat, API Key, dan model secara terpisah. Uji koneksi lalu pilih model yang tersedia.',
    ...(preset.id === 'anthropic'
      ? { noteAction: { label: 'Hubungkan Agent eksternal (MCP)', action: 'open-mcp-guide' } }
      : {}),
    fields: [
      {
        name: names.baseUrl,
        label: 'API URL',
        kind: 'text',
        defaultLabel: preset.baseUrl,
        note: 'Masukkan prefix API lengkap. Bisa memakai endpoint resmi, gateway sendiri, atau relay yang kompatibel.',
      },
      secret(
        names.apiKey,
        preset.id === 'gemini'
          ? 'API Key Gemini / Pool hingga 100 key (pisahkan dengan koma)'
          : isLocalLlmProvider(preset.id) ? 'API Key (opsional)' : 'API Key',
      ),
      ...(preset.id === 'openai' ? [{
        name: 'LLM_OPENAI_API_MODE',
        label: 'Format API',
        kind: 'select' as const,
        defaultLabel: 'Responses API (disarankan)',
        note: 'Pilih protokol yang benar-benar didukung layanan. OpenAI memakai Responses API; layanan kompatibel dapat memakai Chat Completions API.',
        options: [{ value: 'chat', label: 'Chat Completions API' }],
      }] : []),
      {
        name: names.model,
        label: 'Model',
        kind: 'text',
        defaultLabel: preset.defaultModel,
        discoverableModel: true,
        note: 'Setelah koneksi diuji, pilih model yang tersedia atau masukkan ID model secara manual.',
        options: [{ value: preset.defaultModel, label: preset.defaultModel }],
      },
    ],
  };
};

const CODEX_PAGE: SettingsVendorPage = {
  key: 'llm/codex',
  vendor: 'openai',
  title: 'OpenAI · Codex',
  connection: 'codex',
  note: 'Masuk memakai langganan ChatGPT. Codex CLI resmi mengelola kredensial, perpanjangan sesi, dan keluar. MiniCut tidak membaca atau menampilkan kredensial OAuth.',
  fields: [
    {
      name: 'CODEX_MODEL', label: 'Model Codex', kind: 'text',
      defaultLabel: 'Model bawaan Codex', discoverableModel: true,
      note: 'Setelah masuk, MiniCut dapat membaca model yang tersedia untuk akun ini. ID model juga dapat diisi manual.',
    },
    {
      name: 'CODEX_REASONING_EFFORT', label: 'Tingkat penalaran', kind: 'select',
      options: [{ value: '', label: 'Bawaan model' }],
      note: 'Setelah model dimuat, pilihan tingkat penalaran yang didukung akan tampil. Kosongkan untuk memakai bawaan model.',
    },
  ],
};

const COPILOT_PAGE: SettingsVendorPage = {
  key: 'llm/copilot',
  vendor: 'copilot',
  title: 'GitHub Copilot',
  connection: 'copilot',
  note: 'Gunakan langganan GitHub Copilot. Copilot CLI resmi mengelola login dan kredensial (jalankan copilot login di terminal),'
    + ' MiniCut memakai Copilot SDK untuk menjalankan alat edit dan tidak membaca atau menampilkan kredensial.'
    + ' Status sesi MiniCut disimpan terpisah dan tidak mengganggu konfigurasi Copilot pribadi.',
  fields: [
    {
      name: 'COPILOT_MODEL', label: 'Model Copilot', kind: 'text',
      defaultLabel: 'Model bawaan Copilot', discoverableModel: true,
      note: 'Setelah masuk, model yang tersedia pada langganan dapat dimuat atau ID model dapat diisi manual. Hanya model yang mendukung pemanggilan alat yang dapat mengedit.',
    },
    {
      name: 'COPILOT_REASONING_EFFORT', label: 'Tingkat penalaran', kind: 'select',
      options: [{ value: '', label: 'Bawaan model' }],
      note: 'Setelah model dimuat, pilihan tingkat penalaran yang didukung akan tampil. Kosongkan untuk memakai bawaan model.',
    },
  ],
};

const XAI_OAUTH_PAGE: SettingsVendorPage = {
  key: 'llm/xai-oauth', vendor: 'xai-oauth', title: 'xAI · Grok (Login langganan)',
  connection: 'xai-oauth',
  note: 'Masuk memakai langganan SuperGrok atau X Premium+. Grok CLI resmi mengelola login dan kredensial; MiniCut mengimpor sesi dan memperbaruinya tanpa membaca atau menampilkan kredensial OAuth.',
  fields: [{
    name: 'LLM_XAI_OAUTH_MODEL', label: 'Model', kind: 'text', defaultLabel: 'grok-4.6',
    discoverableModel: true,
    note: 'Setelah koneksi diuji, pilih model yang tersedia atau masukkan ID model secara manual.',
    options: [{ value: 'grok-4.6', label: 'grok-4.6' }],
  }],
};

// Penempatan OFox mengikuti urutan penyedia Agent upstream (Anthropic, OpenAI,
// OpenAI · Codex, OFox), independent of its position in LLM_PROVIDER_PRESETS.
const OFOX_PRESET = LLM_PROVIDER_PRESETS.find((preset) => preset.id === 'ofox');
const MINI_CUT_PROVIDER_ORDER = [
  ...LLM_PROVIDER_PRESETS.filter((preset) => preset.id === 'gemini'),
  ...LLM_PROVIDER_PRESETS.filter((preset) => preset.id !== 'gemini'),
] as const;

const AGENT_VENDOR_PAGES: readonly SettingsVendorPage[] = MINI_CUT_PROVIDER_ORDER.flatMap((preset) => {
  if (preset.id === 'xai-oauth') return [XAI_OAUTH_PAGE];
  if (preset.id === 'ofox') return [];
  const page = llmPage(preset);
  if (preset.id !== 'openai') return [page];
  return OFOX_PRESET
    ? [page, CODEX_PAGE, llmPage(OFOX_PRESET), COPILOT_PAGE]
    : [page, CODEX_PAGE, COPILOT_PAGE];
});

const VISION_PAGE: SettingsVendorPage = {
  key: 'llm/vision', vendor: 'vision', title: 'Pemahaman visual', fields: [],
};

export const PROXY_PAGE: SettingsVendorPage = {
  key: 'agent/proxy', vendor: 'proxy', title: 'Proxy jaringan', kind: 'settings',
  note: 'Jika akses ke Gemini, OpenAI, Anthropic, Mistral, atau layanan lain memerlukan proxy,'
    + ' masukkan alamat proxy lokal di sini, misalnya http://127.0.0.1:7890.'
    + ' Jika dikosongkan, MiniCut memakai variabel sistem HTTPS_PROXY / HTTP_PROXY.'
    + ' Berlaku untuk model Agent, generasi AI, unduhan model, dan sinkronisasi R2.',
  fields: [text('PROXY_URL', 'Alamat proxy', 'Contoh http://127.0.0.1:7890')],
};

export const AGENT_VENDOR_PAGES_WITH_VISION: readonly SettingsVendorPage[] = [
  ...AGENT_VENDOR_PAGES,
  VISION_PAGE,
];
