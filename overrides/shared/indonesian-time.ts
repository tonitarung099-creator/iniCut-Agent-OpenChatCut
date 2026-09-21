export interface ParsedTimelineTime {
  readonly raw: string;
  readonly seconds: number;
  readonly start: number;
  readonly end: number;
}

const MAX_REASONABLE_SECONDS = 7 * 24 * 60 * 60;

function decimal(value: string | undefined): number {
  if (!value) return 0;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function validSeconds(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= MAX_REASONABLE_SECONDS;
}

function overlaps(items: readonly ParsedTimelineTime[], start: number, end: number): boolean {
  return items.some((item) => start < item.end && end > item.start);
}

function push(
  items: ParsedTimelineTime[],
  raw: string,
  seconds: number,
  start: number,
  end: number,
): void {
  if (!validSeconds(seconds) || overlaps(items, start, end)) return;
  items.push({ raw, seconds, start, end });
}

/**
 * Parse explicit Indonesian timeline clock expressions without guessing plain
 * numbers. Supported examples:
 * - 1 jam lebih 2 menit
 * - 1 jam lewat 2 menit 30 detik
 * - 1 jam 2 menit 3 detik
 * - 62 menit
 * - 90 detik
 * - 01:02:03
 * - 62:03
 */
export function parseIndonesianTimelineTimes(input: string): ParsedTimelineTime[] {
  const text = String(input ?? '');
  const out: ParsedTimelineTime[] = [];

  // Clock notation first so phrase matching cannot consume pieces of it.
  const hms = /\b(\d{1,3}):(\d{2}):(\d{2})(?:[.,](\d{1,3}))?\b/g;
  for (const match of text.matchAll(hms)) {
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    const seconds = Number(match[3]);
    const millis = Number(`0.${match[4] ?? '0'}`);
    if (minutes >= 60 || seconds >= 60 || match.index === undefined) continue;
    push(out, match[0], hours * 3600 + minutes * 60 + seconds + millis, match.index, match.index + match[0].length);
  }

  const ms = /\b(\d{1,4}):(\d{2})(?:[.,](\d{1,3}))?\b/g;
  for (const match of text.matchAll(ms)) {
    if (match.index === undefined || overlaps(out, match.index, match.index + match[0].length)) continue;
    const minutes = Number(match[1]);
    const seconds = Number(match[2]);
    const millis = Number(`0.${match[3] ?? '0'}`);
    if (seconds >= 60) continue;
    push(out, match[0], minutes * 60 + seconds + millis, match.index, match.index + match[0].length);
  }

  // Long-form Indonesian. "lebih"/"lewat" is a semantic separator, not addition
  // beyond the following units: 1 jam lebih 2 menit = 1h + 2m.
  const phrase = /\b(?:(\d+(?:[.,]\d+)?)\s*jam)(?:\s*(?:lebih|lewat|dan)?\s*(\d+(?:[.,]\d+)?)\s*menit)?(?:\s*(?:lebih|lewat|dan)?\s*(\d+(?:[.,]\d+)?)\s*detik)?\b/gi;
  for (const match of text.matchAll(phrase)) {
    if (match.index === undefined) continue;
    const seconds = decimal(match[1]) * 3600 + decimal(match[2]) * 60 + decimal(match[3]);
    push(out, match[0], seconds, match.index, match.index + match[0].length);
  }

  const minutePhrase = /\b(\d+(?:[.,]\d+)?)\s*menit(?:\s*(?:lebih|lewat|dan)?\s*(\d+(?:[.,]\d+)?)\s*detik)?\b/gi;
  for (const match of text.matchAll(minutePhrase)) {
    if (match.index === undefined) continue;
    const seconds = decimal(match[1]) * 60 + decimal(match[2]);
    push(out, match[0], seconds, match.index, match.index + match[0].length);
  }

  const secondPhrase = /\b(\d+(?:[.,]\d+)?)\s*detik\b/gi;
  for (const match of text.matchAll(secondPhrase)) {
    if (match.index === undefined) continue;
    push(out, match[0], decimal(match[1]), match.index, match.index + match[0].length);
  }

  return out.sort((a, b) => a.start - b.start || a.end - b.end);
}

export function timelineTimeAnnotation(input: string, fps: number): string {
  const parsed = parseIndonesianTimelineTimes(input);
  if (parsed.length === 0) return '';
  const safeFps = Number.isFinite(fps) && fps > 0 ? fps : 30;
  const rows = parsed.map((item) => {
    const frame = Math.round(item.seconds * safeFps);
    return `- "${item.raw}" = ${item.seconds} detik = frame timeline ${frame} pada ${safeFps} fps`;
  });
  return [
    '<minicut_time_normalization>',
    'Hasil parsing waktu lokal MiniCut. Gunakan nilai ini untuk koordinat timeline; jangan menebak ulang frasa waktu:',
    ...rows,
    '</minicut_time_normalization>',
  ].join('\n');
}
