import type { AgentToolSchema } from '../../tool-schema';

/**
 * Low-level parity bridge for editor actions that are directly available in the
 * manual UI but do not belong to a richer domain tool. Ordinary editing should
 * still prefer edit_item/edit_track/edit_captions/etc.
 */
export const MANUAL_EDITOR_TOOL_SCHEMAS: AgentToolSchema[] = [{
  name: 'manual_editor_action',
  description: [
    'Bridge for exact manual-editor actions that are otherwise UI-only or too low-level for the domain tools.',
    'Use dedicated tools first for normal clip edits.',
    'Supported actions: select_item, select_items, select_all, clear_selection, set_track_flag,',
    'set_captions_hidden, set_reframe_keyframe, remove_reframe_keyframe, clear_reframe_keyframes,',
    'toggle_transcript_word, delete_transcript_words.',
    'This tool operates only on MiniCut EditorCore commands; it cannot execute arbitrary OS or shell actions.',
  ].join(' '),
  input_schema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: [
          'select_item',
          'select_items',
          'select_all',
          'clear_selection',
          'set_track_flag',
          'set_captions_hidden',
          'set_reframe_keyframe',
          'remove_reframe_keyframe',
          'clear_reframe_keyframes',
          'toggle_transcript_word',
          'delete_transcript_words',
        ],
      },
      itemId: { type: 'string', description: 'Timeline item id or unique prefix.' },
      itemIds: {
        type: 'array',
        items: { type: 'string' },
        maxItems: 256,
        description: 'Timeline item ids or unique prefixes.',
      },
      mode: {
        type: 'string',
        enum: ['replace', 'toggle', 'add'],
        description: 'Selection mode for select_item.',
      },
      track: { type: 'string', description: 'Track alias such as V1/A1/C1 or stable track id.' },
      flag: {
        type: 'string',
        enum: ['hidden', 'muted', 'collapsed', 'locked'],
        description: 'Track flag to set exactly.',
      },
      value: { type: 'boolean', description: 'Desired value for set_track_flag.' },
      hidden: { type: 'boolean', description: 'Global caption/text visibility.' },
      frame: { type: 'integer', minimum: 0, description: 'Item-local frame for a reframe keyframe.' },
      focalPointX: { type: 'number', minimum: 0, maximum: 1 },
      focalPointY: { type: 'number', minimum: 0, maximum: 1 },
      magnification: { type: 'number', minimum: 0.05, maximum: 16 },
      wordIndex: { type: 'integer', minimum: 0, description: 'Exact transcript word index.' },
      wordIndexes: {
        type: 'array',
        items: { type: 'integer', minimum: 0 },
        maxItems: 1000,
        description: 'Exact transcript word indexes to delete as one editor action.',
      },
    },
    required: ['action'],
    additionalProperties: false,
  },
}];

export const MANUAL_EDITOR_TOOL_NAMES = new Set(
  MANUAL_EDITOR_TOOL_SCHEMAS.map((tool) => tool.name),
);
