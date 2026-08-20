import test from 'node:test';
import assert from 'node:assert/strict';
import { manifestToNativeFeed } from './nativeFeed.js';

test('uploaded pack manifests become native VideoFrame feed entries', () => {
  const videos = manifestToNativeFeed({
    jobId: 'job-1',
    format: { width: 1080, height: 1920, fps: 30 },
    packs: [{
      robloxAssetId: '123456',
      clips: [{ index: 4, filename: 'funny.mp4', start: 12.5, end: 20, duration: 7.5 }],
    }],
  });
  assert.deepEqual(videos, [{
    id: 'nf-job1-1-1', title: 'funny', username: '@kariye112', owner: true,
    likes: 0, comments: 0, likedByCurrentUser: false,
    videoAssetId: 'rbxassetid://123456', startTime: 12.5, endTime: 20, duration: 7.5,
    width: 1080, height: 1920, fps: 30, genre: 'general',
  }]);
});

test('packs without a completed Roblox asset ID are ignored', () => {
  assert.deepEqual(manifestToNativeFeed({ jobId: 'job-1', packs: [{ clips: [{}] }] }), []);
});
