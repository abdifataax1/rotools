import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPackPlan, buildSizedPackPlan } from './compiler.js';

test('buildPackPlan keeps order and creates five-minute packs', () => {
  const clips = [120, 120, 80, 20].map((duration, index) => ({ duration, originalname: `${index}.mp4` }));
  const packs = buildPackPlan(clips, 299);
  assert.deepEqual(packs.map((pack) => pack.map((clip) => clip.duration)), [[120, 120], [80, 20]]);
});

test('buildPackPlan rejects a clip longer than the pack limit', () => {
  assert.throws(() => buildPackPlan([{ duration: 300, originalname: 'long.mp4' }], 299), /too long for a five-minute pack/);
});

test('buildSizedPackPlan creates another pack before the file-size limit', () => {
  const megabyte = 1024 * 1024;
  const clips = [8, 8, 8].map((size, index) => ({ duration: 15, normalizedDuration: 15, normalizedBytes: size * megabyte, originalname: `${index}.mp4` }));
  const packs = buildSizedPackPlan(clips, 299, 19 * megabyte);
  assert.deepEqual(packs.map((pack) => pack.map((clip) => clip.normalizedBytes / megabyte)), [[8, 8], [8]]);
});
