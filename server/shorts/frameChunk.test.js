import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeFrameChunk, decodeFrameChunk, CHUNK_HEADER_BYTES } from './frameChunk.js';

test('RVF1 chunks round-trip RGBA frames through zstd', () => {
  const frameA = Buffer.alloc(4 * 3 * 4, 17);
  const frameB = Buffer.alloc(4 * 3 * 4, 240);
  const encoded = encodeFrameChunk({ width: 4, height: 3, fps: 10, startFrame: 20, totalFrameCount: 100, frames: [frameA, frameB] });
  const decoded = decodeFrameChunk(encoded.compressed);
  assert.equal(decoded.width, 4);
  assert.equal(decoded.height, 3);
  assert.equal(decoded.frameCount, 2);
  assert.equal(decoded.startFrame, 20);
  assert.deepEqual(decoded.raw.subarray(CHUNK_HEADER_BYTES, CHUNK_HEADER_BYTES + frameA.length), frameA);
  assert.ok(encoded.compressed.length < encoded.raw.length);
});
