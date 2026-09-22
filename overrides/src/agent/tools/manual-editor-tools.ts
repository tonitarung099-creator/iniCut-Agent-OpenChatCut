import type { AgentContext } from '../context';
import { resolveTrackId } from '../../editor/types';
import type { TimelineItem } from '../../editor/types';

type Args = Record<string, unknown>;

function uniqueItem(items: readonly TimelineItem[], raw: unknown): TimelineItem | null {
  const query = String(raw ?? '').trim();
  if (!query) return null;
  const exact = items.find((item) => item.id === query);
  if (exact) return exact;
  const matches = items.filter((item) => item.id.startsWith(query));
  return matches.length === 1 ? matches[0]! : null;
}

function resolveMany(items: readonly TimelineItem[], raw: unknown): {
  ids?: string[];
  error?: string;
} {
  if (!Array.isArray(raw) || raw.length === 0) return { error: 'itemIds harus berisi setidaknya satu klip.' };
  const ids: string[] = [];
  for (const value of raw) {
    const item = uniqueItem(items, value);
    if (!item) return { error: `Klip tidak ditemukan atau prefix tidak unik: ${String(value)}` };
    if (!ids.includes(item.id)) ids.push(item.id);
  }
  return { ids };
}

export async function execManualEditorTool(
  name: string,
  args: Args,
  ctx: AgentContext,
): Promise<unknown> {
  if (name !== 'manual_editor_action') return { error: `unknown tool ${name}` };

  const action = String(args.action ?? '');
  const state = ctx.getState();

  if (action === 'select_item') {
    const item = uniqueItem(state.items, args.itemId);
    if (!item) return { error: `Klip tidak ditemukan atau prefix tidak unik: ${String(args.itemId ?? '')}` };
    const mode = args.mode === 'toggle' || args.mode === 'add' ? args.mode : 'replace';
    ctx.commands.selectItem(item.id, { mode });
    return { ok: true, action, itemId: item.id, mode };
  }

  if (action === 'select_items') {
    const resolved = resolveMany(state.items, args.itemIds);
    if (!resolved.ids) return { error: resolved.error };
    ctx.commands.selectItems(resolved.ids);
    return { ok: true, action, itemIds: resolved.ids };
  }

  if (action === 'select_all') {
    ctx.commands.selectAll();
    return { ok: true, action, count: state.items.length };
  }

  if (action === 'clear_selection') {
    ctx.commands.selectItem(null);
    return { ok: true, action };
  }

  if (action === 'set_track_flag') {
    const track = resolveTrackId(state, args.track);
    if (!track) return { error: `Trek tidak ditemukan: ${String(args.track ?? '')}` };
    const flag = String(args.flag ?? '');
    if (!['hidden', 'muted', 'collapsed', 'locked'].includes(flag)) {
      return { error: `Flag trek tidak didukung: ${flag}` };
    }
    if (typeof args.value !== 'boolean') return { error: 'value boolean wajib diisi.' };
    const current = Boolean((state.tracks[track] as Record<string, unknown> | undefined)?.[flag]);
    if (current !== args.value) {
      ctx.commands.toggleTrackFlag(track, flag as 'hidden' | 'muted' | 'collapsed' | 'locked');
    }
    return { ok: true, action, trackId: track, flag, value: args.value, changed: current !== args.value };
  }

  if (action === 'set_captions_hidden') {
    if (typeof args.hidden !== 'boolean') return { error: 'hidden boolean wajib diisi.' };
    ctx.commands.setCaptionsHidden(args.hidden);
    return { ok: true, action, hidden: args.hidden };
  }

  if (
    action === 'set_reframe_keyframe'
    || action === 'remove_reframe_keyframe'
    || action === 'clear_reframe_keyframes'
  ) {
    const item = uniqueItem(state.items, args.itemId);
    if (!item) return { error: `Klip tidak ditemukan atau prefix tidak unik: ${String(args.itemId ?? '')}` };

    if (action === 'clear_reframe_keyframes') {
      const keyframes = item.zoom?.reframeCurve?.keyframes ?? [];
      for (const keyframe of keyframes) ctx.commands.removeReframeKeyframe(item.id, keyframe.frame);
      return { ok: true, action, itemId: item.id, removed: keyframes.length };
    }

    if (!Number.isInteger(args.frame) || Number(args.frame) < 0) {
      return { error: 'frame integer >= 0 wajib diisi.' };
    }
    const frame = Number(args.frame);

    if (action === 'remove_reframe_keyframe') {
      ctx.commands.removeReframeKeyframe(item.id, frame);
      return { ok: true, action, itemId: item.id, frame };
    }

    const x = Number(args.focalPointX);
    const y = Number(args.focalPointY);
    const magnification = Number(args.magnification);
    if (!Number.isFinite(x) || x < 0 || x > 1 || !Number.isFinite(y) || y < 0 || y > 1) {
      return { error: 'focalPointX dan focalPointY harus 0..1.' };
    }
    if (!Number.isFinite(magnification) || magnification < 0.05 || magnification > 16) {
      return { error: 'magnification harus 0.05..16.' };
    }
    ctx.commands.setReframeKeyframe(item.id, frame, x, y, magnification);
    return { ok: true, action, itemId: item.id, frame, focalPointX: x, focalPointY: y, magnification };
  }

  return { error: `Aksi manual editor tidak dikenal: ${action}` };
}
