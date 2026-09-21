import assert from 'node:assert/strict';
import { routedToolNames } from './tool-routing';

function has(request: string, tool: string): void {
  const tools = routedToolNames(request, false);
  assert.equal(tools.has(tool), true, `${request} should activate ${tool}`);
}

has('potong video di 1 jam lebih 2 menit', 'split_item');
has('hapus klip yang dipilih', 'remove_item');
has('geser klip ke kanan', 'move_item');
has('ubah rasio video ke 9:16', 'set_aspect_ratio');
has('buat subtitel dari transkrip', 'edit_captions');
has('transkrip video ini', 'read_transcript');
has('hapus bagian hening', 'remove_silence');
has('normalkan audio dan musik', 'normalize_loudness');
has('ekspor hasil akhir', 'submit_export');
has('cari sorotan dari adegan film ini', 'find_highlights');

console.log('MiniCut Indonesian agent routing checks passed');
