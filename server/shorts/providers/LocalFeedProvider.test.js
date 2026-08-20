import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalFeedProvider } from './LocalFeedProvider.js';

const videoProvider = { async getVideos() { return Array.from({ length: 12 }, (_, index) => ({ id: `clip-${index}` })); } };

test('personalized feed is deterministic and preserves every video', async () => {
  const provider = new LocalFeedProvider(videoProvider);
  const first = (await provider.getFeedForUser('123')).map((item) => item.id);
  const repeat = (await provider.getFeedForUser('123')).map((item) => item.id);
  const other = (await provider.getFeedForUser('456')).map((item) => item.id);
  assert.deepEqual(first, repeat);
  assert.notDeepEqual(first, other);
  assert.deepEqual([...first].sort(), Array.from({ length: 12 }, (_, index) => `clip-${index}`).sort());
});
