import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TOOL_SCHEMAS } from './tools';
import { ToolActivation } from './tool-activation';

const coverage = new Map<string, string>();

function cover(tool: string, commands: readonly string[]): void {
  for (const command of commands) {
    assert.equal(coverage.has(command), false, `duplicate parity mapping for ${command}`);
    coverage.set(command, tool);
  }
}

cover('add_motion_graphic', ['addMotionGraphic']);
cover('add_audio', ['addAudio']);
cover('import_asset', ['addAsset']);
cover('edit_item', [
  'addMediaItem',
  'relinkTimelineItem',
  'addSolidItem',
  'addTextClip',
  'slipItem',
  'setItemVolume',
  'setItemFade',
  'setItemTransform',
  'setItemFilters',
  'setItemBackgroundFill',
  'setItemZoom',
  'setItemSpeed',
  'replaceItemMedia',
  'setItemKeyframe',
  'removeItemKeyframe',
  'clearItemKeyframes',
  'addTransition',
  'setTransition',
  'removeTransition',
]);
cover('manage_effects', ['setItemEffects']);
cover('manage_timelines', [
  'addSequence',
  'createTimeline',
  'switchTimeline',
  'duplicateTimeline',
  'deleteTimeline',
  'renameTimeline',
  'retargetTimeline',
  'setTimelineHidden',
]);
cover('manage_media_pool', [
  'createMediaFolder',
  'renameMediaFolder',
  'deleteMediaFolder',
  'moveMediaAssets',
  'renameMediaAsset',
  'renameMediaAssets',
  'setMediaAssetFavorite',
  'setMediaAssetsFavorite',
  'removeMediaAsset',
  'removeMediaAssets',
  'relinkMediaAsset',
]);
cover('edit_asset', ['editMediaAsset']);
cover('update_item_props', ['updateItemProps']);
cover('move_item', ['moveItem']);
cover('set_item_timing', ['setItemTiming']);
cover('manage_markers', ['addMarker', 'updateMarker', 'removeMarker']);
cover('manual_editor_action', [
  'toggleTrackFlag',
  'setCaptionsHidden',
  'setReframeKeyframe',
  'removeReframeKeyframe',
  'toggleWord',
  'deleteWords',
  'selectItem',
  'selectItems',
  'selectAll',
]);
cover('duplicate_item', ['duplicateItem']);
cover('remove_item', ['removeItem', 'rippleDeleteItem']);
cover('split_item', ['splitItem']);
cover('clear_timeline', ['clearTimeline']);
cover('set_aspect_ratio', ['setAspect']);
cover('edit_track', [
  'createTrack',
  'createCaptionTrack',
  'updateTrack',
  'deleteTracks',
  'tightenTrack',
  'reorderTrackItems',
]);
cover('edit_captions', ['setCaptions', 'updateCaptions']);
cover('update_watermark', ['updateWatermark']);
cover('transcribe_track', ['setItemTranscript', 'setAssetTranscription']);
cover('manage_transcript', [
  'setItemVariants',
  'setTranscriptPlayOrder',
  'clearEdits',
  'fixTranscriptWord',
  'renameSpeaker',
]);
cover('clean_script', ['cleanScript']);
cover('edit_gap', ['setGapCap']);
cover('isolate_voice', ['setItemDenoise']);
cover('manage_design_style', ['setDesignStyle', 'patchDesignStyle']);
cover('undo_last_change', ['undo']);
cover('redo_last_change', ['redo']);

const internalOnly = new Set([
  // Internal reducer/plumbing operations, not distinct user-facing editor
  // capabilities. The public action is represented by a higher-level tool.
  'canonicalizeMediaAsset',
  'applyState',
  'applyDoc',
  'batch',
  'beginHistoryGesture',
  'endHistoryGesture',
]);

const source = readFileSync('src/editor/storeCommands.ts', 'utf8');
const start = source.indexOf('export interface EditorCommands');
assert.notEqual(start, -1, 'EditorCommands interface not found');
const end = source.indexOf('\n}', start);
assert.notEqual(end, -1, 'EditorCommands interface end not found');
const block = source.slice(start, end);
const commandNames = [...block.matchAll(/^\s{2}([A-Za-z_][A-Za-z0-9_]*)\s*:/gm)].map((match) => match[1]!);

const uncovered = commandNames.filter((name) => !coverage.has(name) && !internalOnly.has(name));
assert.deepEqual(
  uncovered,
  [],
  `new manual editor commands need Agent parity mapping: ${uncovered.join(', ')}`,
);

const mappedButMissing = [...coverage.keys()].filter((name) => !commandNames.includes(name));
assert.deepEqual(mappedButMissing, [], `stale parity mappings: ${mappedButMissing.join(', ')}`);

const knownTools = new Set(TOOL_SCHEMAS.map((schema) => schema.name));
const missingTools = [...new Set(coverage.values())].filter((tool) => !knownTools.has(tool));
assert.deepEqual(missingTools, [], `parity mappings reference missing Agent tools: ${missingTools.join(', ')}`);

assert.equal(knownTools.has('manual_editor_action'), true);
const bootActivation = new ToolActivation(TOOL_SCHEMAS, []);
assert.equal(
  bootActivation.names().includes('manual_editor_action'),
  true,
  'manual_editor_action must be available as Gemini parity fallback on editing turns',
);

for (const request of [
  'jangan edit, hanya baca proyek ini',
  'jangan mengubah apa pun, cuma baca',
  'read only, do not edit this project',
]) {
  const readOnlyActivation = new ToolActivation(
    TOOL_SCHEMAS,
    [{ role: 'user', content: request }],
  );
  assert.equal(
    readOnlyActivation.names().includes('manual_editor_action'),
    false,
    `read-only request must not pre-activate manual mutations: ${request}`,
  );
}
assert.equal(commandNames.length, coverage.size + internalOnly.size);
assert.ok(commandNames.length >= 90, 'unexpectedly small EditorCommands surface');

console.log(
  `MiniCut manual-editor parity checks passed: ${coverage.size} user-facing commands covered, `
  + `${internalOnly.size} internal-only commands accounted for, ${knownTools.size} Agent tools available.`,
);
