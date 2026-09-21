import assert from 'node:assert/strict';
import {
  firstGeminiApiKey,
  geminiApiKeyCount,
  nextGeminiApiKey,
  parseGeminiApiKeys,
} from './gemini-key-pool';

assert.deepEqual(parseGeminiApiKeys('a,b; c  a'), ['a', 'b', 'c']);
assert.equal(firstGeminiApiKey(' key-1, key-2 '), 'key-1');
assert.equal(geminiApiKeyCount('a,b,c'), 3);

const many = Array.from({ length: 120 }, (_, i) => `k-${i}`).join(',');
assert.equal(parseGeminiApiKeys(many).length, 100, 'pool is capped at 100 unique keys');

const rotated = new Set([
  nextGeminiApiKey('r1,r2,r3'),
  nextGeminiApiKey('r1,r2,r3'),
  nextGeminiApiKey('r1,r2,r3'),
]);
assert.deepEqual(rotated, new Set(['r1', 'r2', 'r3']));

console.log('MiniCut Gemini key-pool checks passed');
