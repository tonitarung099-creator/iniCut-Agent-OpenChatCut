// MiniCut: Indonesian-only interface.
//
// Upstream OpenChatCut uses Chinese source strings as translation keys. MiniCut
// resolves those keys through the upstream English dictionary, then passes the
// result through the Indonesian bridge. Chinese is never used as a visible
// fallback.

import { EN } from './dict/en';
import EN_DATA from './dict/en/templates-data';
import { indonesianUiText } from '../../shared/indonesian-ui';

export type Locale = 'id';

export const ALL_LOCALES: readonly Locale[] = ['id'];

const STORAGE_KEY = 'cc.locale';
const subscribers = new Set<() => void>();

function forceDocumentLanguage(): void {
  try {
    localStorage.setItem(STORAGE_KEY, 'id');
  } catch {
    // Storage may be unavailable; MiniCut is still Indonesian-only.
  }
  if (typeof document !== 'undefined') document.documentElement.lang = 'id';
}

forceDocumentLanguage();

export function getLocale(): Locale {
  return 'id';
}

export function subscribeLocale(onChange: () => void): () => void {
  subscribers.add(onChange);
  return () => { subscribers.delete(onChange); };
}

export function localeLanguageName(_locale: Locale): string {
  return 'Bahasa Indonesia';
}

export function localizedCatalogText(
  english: string,
  _chinese: string,
  _locale: Locale = 'id',
): string {
  return indonesianUiText(english);
}

export function setLocale(_next: Locale): void {
  forceDocumentLanguage();
}

export function prefetchLocaleDicts(): void {
  // There is only one MiniCut interface language.
}

export function ensureLocaleDict(_locale: Locale): Promise<void> {
  return Promise.resolve();
}

export function t(sourceKey: string, params?: Record<string, string | number>): string {
  const english = EN[sourceKey] ?? sourceKey;
  let raw = indonesianUiText(english, sourceKey);
  if (params) {
    raw = raw.replace(/\{(\w+)\}/g, (match, key: string) => (
      key in params ? String(params[key]) : match
    ));
  }
  return raw;
}

export function tData(text: string): string {
  const english = EN_DATA[text] ?? text;
  return indonesianUiText(english, text);
}

export function useT(): typeof t {
  return t;
}
