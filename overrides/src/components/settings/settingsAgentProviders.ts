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
  note: 'MiniCut hanya menggunakan Google Gemini untuk Agent. Tambahkan API Key lewat pengelola key di bawah; key lama tidak perlu ditempel ulang.',
  fields: [
    secret(GEMINI_NAMES.apiKey, 'API Key Gemini'),
    {
      name: GEMINI_NAMES.model,
      label: 'Model Gemini',
      kind: 'text',
      defaultLabel: GEMINI_PRESET.defaultModel,
      discoverableModel: true,
      note: 'MiniCut memakai Gemini 3.8 Flash sebagai bawaan. Klik Uji & muat model untuk melihat model yang benar-benar tersedia untuk API Key/proyek Google kamu.',
      options: [
        { value: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash · gratis tersedia' },
        { value: 'gemini-3.7-flash', label: 'Gemini 3.7 Flash · gratis tersedia' },
        { value: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash · gratis tersedia' },
        { value: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash · gratis tersedia' },
        { value: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite · gratis tersedia' },
        { value: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite · gratis tersedia' },
      ],
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
