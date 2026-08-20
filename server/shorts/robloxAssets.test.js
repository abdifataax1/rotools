import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm, truncate, writeFile } from 'node:fs/promises';
import { getAudioUploadStatus, getRobloxCreator, uploadAudioAsset, uploadVideoAsset } from './robloxAssets.js';
import { saveLocalRobloxConfig } from './localConfig.js';

test('creator configuration never exposes the API key', () => {
  const env = { ROBLOX_API_KEY: 'super-secret', ROBLOX_CREATOR_USER_ID: '12345' };
  assert.deepEqual(getRobloxCreator(env), { userId: '12345' });
  assert.deepEqual(getAudioUploadStatus(env), { configured: true, hasApiKey: true, creatorType: 'userId', creatorId: '12345' });
  assert.equal(JSON.stringify(getAudioUploadStatus(env)).includes('super-secret'), false);
});

test('website setup saves the secret to a private env file without returning it', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'rotools-config-test-'));
  const envFile = path.join(directory, '.env');
  const targetEnv = {};
  try {
    const result = await saveLocalRobloxConfig({ apiKey: 'harmless-test-key-123456789', creatorType: 'user', creatorId: '12345' }, { envFile, targetEnv });
    const saved = await import('node:fs/promises').then(({ readFile }) => readFile(envFile, 'utf8'));
    assert.equal(result.configured, true);
    assert.equal(JSON.stringify(result).includes('harmless-test-key'), false);
    assert.match(saved, /ROBLOX_API_KEY="harmless-test-key-123456789"/);
    assert.equal(targetEnv.ROBLOX_API_KEY, 'harmless-test-key-123456789');
    assert.equal(targetEnv.ROBLOX_CREATOR_USER_ID, '12345');
    assert.equal(targetEnv.ROBLOX_CREATOR_GROUP_ID, '');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('audio upload creates and polls a Roblox operation', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'rotools-audio-test-'));
  const audioPath = path.join(directory, 'clip.mp3');
  await writeFile(audioPath, Buffer.from([0x49, 0x44, 0x33]));
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url: String(url), options });
    const payload = calls.length === 1
      ? { path: 'operations/upload-1', done: false }
      : { path: 'operations/upload-1', done: true, response: { assetId: '987654321' } };
    return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const result = await uploadAudioAsset(audioPath, {
      apiKey: 'test-key', creator: { userId: '12345' }, fetchImpl, pollIntervalMs: 1, maxPolls: 2,
    });
    assert.equal(result.audioAssetId, 'rbxassetid://987654321');
    assert.equal(calls[0].url, 'https://apis.roblox.com/assets/v1/assets');
    assert.equal(calls[1].url, 'https://apis.roblox.com/assets/v1/operations/upload-1');
    assert.equal(calls[0].options.headers['x-api-key'], 'test-key');
    assert.equal(calls[1].options.headers['x-api-key'], 'test-key');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('video upload includes the confirmed 2,000 Robux expected price', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'rotools-video-test-'));
  const videoPath = path.join(directory, 'pack-001.mp4');
  await writeFile(videoPath, Buffer.from([0x00, 0x00, 0x00, 0x18]));
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url: String(url), options });
    const payload = calls.length === 1
      ? { path: 'operations/video-upload-1', done: false }
      : { path: 'operations/video-upload-1', done: true, response: { assetId: '1234567890' } };
    return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const result = await uploadVideoAsset(videoPath, {
      apiKey: 'test-key', creator: { groupId: '54321' }, expectedPrice: 2000, fetchImpl, pollIntervalMs: 1, maxPolls: 2,
    });
    const request = JSON.parse(calls[0].options.body.get('request'));
    assert.equal(request.assetType, 'Video');
    assert.equal(request.creationContext.expectedPrice, 2000);
    assert.deepEqual(request.creationContext.creator, { groupId: '54321' });
    assert.equal(result.videoAssetId, 'rbxassetid://1234567890');
    assert.equal(calls[1].url, 'https://apis.roblox.com/assets/v1/operations/video-upload-1');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('video upload refuses any unconfirmed or different price', async () => {
  await assert.rejects(
    uploadVideoAsset('unused.mp4', { apiKey: 'test-key', creator: { userId: '12345' }, expectedPrice: 0 }),
    /exactly 2,000 Robux/,
  );
});

test('video upload explains the Open Cloud file-size limit before making a paid request', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'rotools-large-video-test-'));
  const videoPath = path.join(directory, 'pack-too-large.mp4');
  await writeFile(videoPath, Buffer.from([0]));
  await truncate(videoPath, (20 * 1024 * 1024) + 1);
  let called = false;
  try {
    await assert.rejects(
      uploadVideoAsset(videoPath, {
        apiKey: 'test-key', creator: { userId: '12345' }, expectedPrice: 2000, fetchImpl: async () => { called = true; },
      }),
      /20 MB or smaller/,
    );
    assert.equal(called, false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
