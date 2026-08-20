import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { createShortsRouter } from './router.js';
import { writeProcessedFrames } from './processor.js';

async function fixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'roblox-shorts-'));
  const width = 8, height = 8, frameCount = 25;
  const rgba = Buffer.alloc(width * height * 4 * frameCount);
  for (let frame = 0; frame < frameCount; frame += 1) {
    for (let offset = 0; offset < width * height; offset += 1) {
      const pixel = frame * width * height * 4 + offset * 4;
      rgba[pixel] = frame * 8;
      rgba[pixel + 1] = offset * 3;
      rgba[pixel + 2] = 80;
      rgba[pixel + 3] = 255;
    }
  }
  await writeProcessedFrames({ id: 'clip-test', rgba, width, height, fps: 10, chunkFrames: 10, processedDirectory: directory, audioAssetId: 'rbxassetid://123456' });
  const app = express();
  app.use(express.json());
  app.use('/shorts', createShortsRouter({ processedDirectory: directory, rateLimit: { limit: 10 } }));
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/shorts`;
  return { directory, server, base };
}

test('feed, metadata, chunks, likes, comments, and errors work', async (t) => {
  const instance = await fixture();
  t.after(async () => { await new Promise((resolve) => instance.server.close(resolve)); await rm(instance.directory, { recursive: true, force: true }); });

  const feed = await fetch(`${instance.base}/feed?playerId=123`).then((response) => response.json());
  assert.equal(feed.videos.length, 1);
  assert.equal(feed.videos[0].id, 'clip-test');
  assert.equal(feed.videos[0].chunkCount, 3);
  assert.equal(feed.videos[0].audioAssetId, 'rbxassetid://123456');

  const chunkResponse = await fetch(`${instance.base}/video/clip-test/chunk/2`);
  assert.equal(chunkResponse.status, 200);
  assert.equal(chunkResponse.headers.get('content-type'), 'application/zstd');
  assert.ok((await chunkResponse.arrayBuffer()).byteLength > 0);

  const liked = await fetch(`${instance.base}/video/clip-test/like`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ playerId: '123' }) }).then((response) => response.json());
  assert.equal(liked.likes, 1);
  assert.equal(liked.likedByCurrentUser, true);

  const posted = await fetch(`${instance.base}/video/clip-test/comments`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ playerId: '123', username: 'BuilderBob', text: 'Works' }) });
  assert.equal(posted.status, 201);
  const comments = await fetch(`${instance.base}/video/clip-test/comments`).then((response) => response.json());
  assert.equal(comments.comments[0].text, 'Works');
  assert.equal(comments.comments[0].username, 'BuilderBob');
  assert.equal(comments.comments[0].userId, '123');
  assert.ok(comments.comments[0].createdAt);

  assert.equal((await fetch(`${instance.base}/video/nope/metadata`)).status, 404);
  assert.equal((await fetch(`${instance.base}/video/../metadata`)).status, 404);
  assert.equal((await fetch(`${instance.base}/video/clip-test/chunk/99`)).status, 404);
});
