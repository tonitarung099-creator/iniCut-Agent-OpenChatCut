// MiniCut: the server-side UI language is permanently Bahasa Indonesia.

import { indonesianUiText } from '../shared/indonesian-ui.ts';

export type UiLocale = 'id';

export function parseUiLocale(_value: unknown): UiLocale {
  return 'id';
}

export function uiLocale(): UiLocale {
  return 'id';
}

/**
 * Upstream call sites still provide zh/en variants. MiniCut always starts from
 * the English semantic variant and converts it to Indonesian, never Chinese.
 */
export function localized<T>(
  variants: { zh: T; en: T; ru?: T; it?: T },
  _locale: UiLocale = 'id',
): T {
  const value = variants.en;
  return (typeof value === 'string' ? indonesianUiText(value) : value) as T;
}
