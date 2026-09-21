import {
  LLM_PROVIDER_PRESETS,
  llmProviderConfigNames,
} from '../../../shared/llm-providers';
import { secret, text, type SettingsVendorPage } from './settingsFields';

const GEMINI_PRESET = LLM_PROVIDER_PRESETS.find((preset) => preset.id === 'gemini');
if (!GEMINI_PRESET) throw new Error('Gemini provider preset is required by MiniCut');

const GEMINI_NAMES = llmProviderConfigNames('gemini');

const GEMINI_PAGE: SettingsVendorPage = {
  key: 'llm/gemini',
  vendor: 'gemini',
  title: 'Google · Gemini',
  note: 'MiniCut hanya menggunakan Gemini untuk Agent. Tempel API Key satu per baris; MiniCut mendukung hingga 100 key dan merotasinya otomatis di sisi server.',
  fields: [
    secret(GEMINI_NAMES.apiKey, 'API Key Gemini'),
    {
      name: GEMINI_NAMES.model,
      label: 'Model Gemini',
      kind: 'text',
      defaultLabel: GEMINI_PRESET.defaultModel,
      discoverableModel: true,
      note: 'Biarkan bawaan jika tidak perlu mengganti model. Tombol uji koneksi dapat memuat model Gemini yang tersedia.',
      options: [{ value: GEMINI_PRESET.defaultModel, label: GEMINI_PRESET.defaultModel }],
    },
  ],
};

/**
 * MiniCut Agent is intentionally Gemini-only.
 * Other upstream LLM providers stay in the dependency code for compatibility,
 * but they are not exposed as Agent choices and cannot be selected from MiniCut.
 */
export const AGENT_VENDOR_PAGES_WITH_VISION: readonly SettingsVendorPage[] = [
  GEMINI_PAGE,
];

export const PROXY_PAGE: SettingsVendorPage = {
  key: 'agent/proxy',
  vendor: 'proxy',
  title: 'Proxy jaringan',
  kind: 'settings',
  note: 'Opsional. Isi hanya jika koneksi ke Google Gemini memerlukan proxy. Jika kosong, MiniCut memakai pengaturan jaringan sistem.',
  fields: [text('PROXY_URL', 'Alamat proxy', 'Contoh http://127.0.0.1:7890')],
};
