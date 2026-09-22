import assert from 'node:assert/strict';
import type { AgentContext } from './context';
import { execManualEditorTool } from './tools/manual-editor-tools';

type Call = { name: string; args: unknown[] };
const calls: Call[] = [];
const record = (name: string) => (...args: unknown[]) => {
  calls.push({ name, args });
};

const state = {
  fps: 30,
  width: 1920,
  height: 1080,
  selectedId: null,
  trackOrder: ['track-v', 'track-a'],
  tracks: {
    'track-v': { kind: 'video', hidden: true, muted: false, collapsed: false, locked: false },
    'track-a': { kind: 'audio', hidden: false, muted: false, collapsed: false, locked: false },
  },
  items: [
    {
      id: 'clip-alpha-123',
      kind: 'video',
      name: 'Alpha',
      track: 'track-v',
      startFrame: 0,
      durationInFrames: 300,
      zoom: {
        reframeCurve: {
          keyframes: [
            { frame: 0, focalPointX: 0.5, focalPointY: 0.5, magnification: 1 },
            { frame: 60, focalPointX: 0.6, focalPointY: 0.5, magnification: 1.2 },
          ],
        },
      },
    },
    {
      id: 'clip-beta-456',
      kind: 'audio',
      name: 'Beta',
      track: 'track-a',
      startFrame: 0,
      durationInFrames: 300,
    },
    {
      id: 'clip-alpine-789',
      kind: 'video',
      name: 'Alpine',
      track: 'track-v',
      startFrame: 300,
      durationInFrames: 300,
    },
  ],
};

const commands = {
  selectItem: record('selectItem'),
  selectItems: record('selectItems'),
  selectAll: record('selectAll'),
  toggleTrackFlag: record('toggleTrackFlag'),
  setCaptionsHidden: record('setCaptionsHidden'),
  toggleWord: record('toggleWord'),
  deleteWords: record('deleteWords'),
  setReframeKeyframe: record('setReframeKeyframe'),
  removeReframeKeyframe: record('removeReframeKeyframe'),
};

const ctx = {
  commands,
  getState: () => state,
  getDoc: () => ({ assets: [], timelines: [] }),
  getCreativeMode: () => null,
  templates: [],
  audio: [],
} as unknown as AgentContext;

function reset(): void {
  calls.length = 0;
}

reset();
let result = await execManualEditorTool('manual_editor_action', {
  action: 'select_item',
  itemId: 'clip-beta',
  mode: 'add',
}, ctx) as Record<string, unknown>;
assert.equal(result.ok, true);
assert.deepEqual(calls, [{ name: 'selectItem', args: ['clip-beta-456', { mode: 'add' }] }]);

reset();
result = await execManualEditorTool('manual_editor_action', {
  action: 'select_item',
  itemId: 'clip-al',
}, ctx) as Record<string, unknown>;
assert.match(String(result.error), /tidak ditemukan|tidak unik/i);
assert.equal(calls.length, 0, 'ambiguous prefix must not edit selection');

reset();
result = await execManualEditorTool('manual_editor_action', {
  action: 'select_items',
  itemIds: ['clip-alpha-123', 'clip-beta', 'clip-alpha-123'],
}, ctx) as Record<string, unknown>;
assert.equal(result.ok, true);
assert.deepEqual(calls, [{
  name: 'selectItems',
  args: [['clip-alpha-123', 'clip-beta-456']],
}]);

reset();
result = await execManualEditorTool('manual_editor_action', {
  action: 'clear_selection',
}, ctx) as Record<string, unknown>;
assert.equal(result.ok, true);
assert.deepEqual(calls, [{ name: 'selectItem', args: [null] }]);

reset();
result = await execManualEditorTool('manual_editor_action', {
  action: 'set_track_flag',
  track: 'V1',
  flag: 'hidden',
  value: true,
}, ctx) as Record<string, unknown>;
assert.equal(result.ok, true);
assert.equal(result.changed, false);
assert.equal(calls.length, 0, 'exact track state should avoid accidental toggle');

reset();
result = await execManualEditorTool('manual_editor_action', {
  action: 'set_track_flag',
  track: 'V1',
  flag: 'hidden',
  value: false,
}, ctx) as Record<string, unknown>;
assert.equal(result.ok, true);
assert.equal(result.changed, true);
assert.deepEqual(calls, [{
  name: 'toggleTrackFlag',
  args: ['track-v', 'hidden'],
}]);

reset();
result = await execManualEditorTool('manual_editor_action', {
  action: 'set_captions_hidden',
  hidden: true,
}, ctx) as Record<string, unknown>;
assert.equal(result.ok, true);
assert.deepEqual(calls, [{ name: 'setCaptionsHidden', args: [true] }]);

reset();
result = await execManualEditorTool('manual_editor_action', {
  action: 'toggle_transcript_word',
  itemId: 'clip-alpha-123',
  wordIndex: 7,
}, ctx) as Record<string, unknown>;
assert.equal(result.ok, true);
assert.deepEqual(calls, [{ name: 'toggleWord', args: ['clip-alpha-123', 7] }]);

reset();
result = await execManualEditorTool('manual_editor_action', {
  action: 'delete_transcript_words',
  itemId: 'clip-alpha-123',
  wordIndexes: [1, 4, 8],
}, ctx) as Record<string, unknown>;
assert.equal(result.ok, true);
assert.deepEqual(calls, [{ name: 'deleteWords', args: ['clip-alpha-123', [1, 4, 8]] }]);

reset();
result = await execManualEditorTool('manual_editor_action', {
  action: 'set_reframe_keyframe',
  itemId: 'clip-alpha-123',
  frame: 90,
  focalPointX: 0.4,
  focalPointY: 0.7,
  magnification: 1.4,
}, ctx) as Record<string, unknown>;
assert.equal(result.ok, true);
assert.deepEqual(calls, [{
  name: 'setReframeKeyframe',
  args: ['clip-alpha-123', 90, 0.4, 0.7, 1.4],
}]);

reset();
result = await execManualEditorTool('manual_editor_action', {
  action: 'clear_reframe_keyframes',
  itemId: 'clip-alpha-123',
}, ctx) as Record<string, unknown>;
assert.equal(result.ok, true);
assert.equal(result.removed, 2);
assert.deepEqual(calls, [
  { name: 'removeReframeKeyframe', args: ['clip-alpha-123', 0] },
  { name: 'removeReframeKeyframe', args: ['clip-alpha-123', 60] },
]);

reset();
result = await execManualEditorTool('manual_editor_action', {
  action: 'set_reframe_keyframe',
  itemId: 'clip-alpha-123',
  frame: 12,
  focalPointX: 2,
  focalPointY: 0.5,
  magnification: 1,
}, ctx) as Record<string, unknown>;
assert.match(String(result.error), /0\.\.1/);
assert.equal(calls.length, 0, 'invalid reframe values must not mutate');

console.log('MiniCut manual editor action behavior checks passed');
