import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createShortsUploadRouter } from './uploadRouter.js';

test('paid video endpoint refuses to upload without explicit cost and rights confirmations', async () => {
  let uploadCalled = false;
  const app = express();
  app.use(express.json());
  app.use('/api/shorts/upload', createShortsUploadRouter({
    uploadVideoAsset: async () => { uploadCalled = true; },
  }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/shorts/upload/combine/00000000-0000-0000-0000-000000000000/pack-001.mp4/roblox-upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expectedPrice: 2000 }),
    });
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /Confirm that this upload will spend 2,000 Robux/);
    assert.equal(uploadCalled, false);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('link importer refuses a download without a rights confirmation', async () => {
  let importCalled = false;
  const app = express();
  app.use(express.json());
  app.use('/api/shorts/upload', createShortsUploadRouter({
    downloadOwnedVideo: async () => { importCalled = true; },
  }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/shorts/upload/import-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://www.tiktok.com/@creator/video/123' }),
    });
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /own this video or have permission/);
    assert.equal(importCalled, false);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('YouTube setup saves the key server-side and search returns previews', async () => {
  let savedKey = '';
  let receivedQuery = '';
  const app = express();
  app.use(express.json());
  app.use('/api/shorts/upload', createShortsUploadRouter({
    saveLocalYouTubeConfig: async (key) => { savedKey = key; return { configured: true }; },
    searchYouTubeShorts: async (query) => { receivedQuery = query; return [{ id: 'abc', url: 'https://www.youtube.com/shorts/abc' }]; },
  }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    const configResponse = await fetch(`http://127.0.0.1:${server.address().port}/api/shorts/upload/youtube/config`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: 'secret-api-key-value' }),
    });
    assert.equal(configResponse.status, 200);
    assert.equal(savedKey, 'secret-api-key-value');
    assert.equal(JSON.stringify(await configResponse.json()).includes('secret-api-key-value'), false);

    const searchResponse = await fetch(`http://127.0.0.1:${server.address().port}/api/shorts/upload/youtube/search`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: 'funny' }),
    });
    assert.equal(searchResponse.status, 200);
    assert.equal(receivedQuery, 'funny');
    assert.equal((await searchResponse.json()).videos.length, 1);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
