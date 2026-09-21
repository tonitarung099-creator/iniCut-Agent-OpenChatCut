import assert from 'node:assert/strict';
import {
  parseIndonesianTimelineTimes,
  timelineTimeAnnotation,
} from './indonesian-time';

function one(input: string): number {
  const parsed = parseIndonesianTimelineTimes(input);
  assert.equal(parsed.length, 1, input);
  return parsed[0]!.seconds;
}

assert.equal(one('potong di 1 jam lebih 2 menit'), 3720);
assert.equal(one('potong 1 jam lewat 2 menit 30 detik'), 3750);
assert.equal(one('potong 1 jam 2 menit 3 detik'), 3723);
assert.equal(one('potong 62 menit'), 3720);
assert.equal(one('potong 90 detik'), 90);
assert.equal(one('potong 01:02:03'), 3723);
assert.equal(one('potong 62:03'), 3723);
assert.equal(one('potong 1,5 menit'), 90);
assert.equal(parseIndonesianTimelineTimes('potong klip nomor 2').length, 0, 'plain numbers must not be guessed as time');

const multi = parseIndonesianTimelineTimes('hapus dari 1 menit 5 detik sampai 2 menit 10 detik');
assert.deepEqual(multi.map((x) => x.seconds), [65, 130]);

const annotation = timelineTimeAnnotation('potong di 1 jam lebih 2 menit', 30);
assert.match(annotation, /3720 detik/);
assert.match(annotation, /111600/);
assert.match(annotation, /30 fps/);

console.log('MiniCut Indonesian timeline time checks passed');
