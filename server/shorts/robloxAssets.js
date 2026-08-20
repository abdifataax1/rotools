import { openAsBlob } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const ASSETS_BASE_URL = 'https://apis.roblox.com/assets/v1/';
const OPEN_CLOUD_MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

function apiError(status, payload, fallback) {
  const details = payload?.message || payload?.error?.message || payload?.error || fallback;
  const error = new Error(`Roblox Assets API (${status}): ${details}`);
  error.status = status >= 400 && status < 500 ? 400 : 502;
  return error;
}

async function readResponse(response) {
  const text = await response.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { return { message: text.slice(0, 500) }; }
}

export function getRobloxCreator(env = process.env) {
  const userId = String(env.ROBLOX_CREATOR_USER_ID || '').trim();
  const groupId = String(env.ROBLOX_CREATOR_GROUP_ID || '').trim();
  if (userId && groupId) throw new Error('Set only one of ROBLOX_CREATOR_USER_ID or ROBLOX_CREATOR_GROUP_ID.');
  if (userId && /^\d+$/.test(userId)) return { userId };
  if (groupId && /^\d+$/.test(groupId)) return { groupId };
  throw new Error('Set a numeric ROBLOX_CREATOR_USER_ID or ROBLOX_CREATOR_GROUP_ID in .env.');
}

export function getAudioUploadStatus(env = process.env) {
  let creatorType = null;
  let creatorId = null;
  try {
    const creator = getRobloxCreator(env);
    creatorType = Object.keys(creator)[0];
    creatorId = creator[creatorType];
  } catch {}
  return {
    configured: Boolean(String(env.ROBLOX_API_KEY || '').trim()) && Boolean(creatorType),
    hasApiKey: Boolean(String(env.ROBLOX_API_KEY || '').trim()),
    creatorType,
    creatorId,
  };
}

export async function uploadAudioAsset(audioPath, options = {}) {
  const apiKey = String(options.apiKey || process.env.ROBLOX_API_KEY || '').trim();
  if (!apiKey) throw new Error('ROBLOX_API_KEY is missing from .env.');
  const creator = options.creator || getRobloxCreator(options.env || process.env);
  const fetchImpl = options.fetchImpl || fetch;
  const file = await readFile(audioPath);
  if (file.length > 20 * 1024 * 1024) throw new Error('Extracted audio exceeds Roblox\'s 20 MB limit.');

  const form = new FormData();
  form.append('request', JSON.stringify({
    assetType: 'Audio',
    displayName: String(options.displayName || path.parse(audioPath).name).slice(0, 50),
    description: String(options.description || 'Audio extracted by RoTools Shorts uploader').slice(0, 1000),
    creationContext: { creator },
  }));
  form.append('fileContent', new Blob([file], { type: 'audio/mpeg' }), path.basename(audioPath));

  const createResponse = await fetchImpl(`${ASSETS_BASE_URL}assets`, {
    method: 'POST',
    headers: { 'x-api-key': apiKey },
    body: form,
  });
  const initialOperation = await readResponse(createResponse);
  if (!createResponse.ok) throw apiError(createResponse.status, initialOperation, 'Audio upload failed.');

  let operation = initialOperation;
  const operationPath = String(operation.path || operation.name || '');
  if (!operationPath) throw new Error('Roblox did not return an upload operation.');
  const operationUrl = new URL(operationPath.replace(/^\//, ''), ASSETS_BASE_URL).toString();
  const pollIntervalMs = Number(options.pollIntervalMs) || 1500;
  const maxPolls = Number(options.maxPolls) || 80;

  for (let attempt = 0; !operation.done && attempt < maxPolls; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    const response = await fetchImpl(operationUrl, { headers: { 'x-api-key': apiKey } });
    operation = await readResponse(response);
    if (!response.ok) throw apiError(response.status, operation, 'Could not read audio upload status.');
  }

  if (!operation.done) throw new Error('Roblox audio upload timed out while processing.');
  if (operation.error) throw apiError(400, operation.error, 'Roblox rejected the audio.');
  const assetId = String(operation.response?.assetId || operation.response?.path?.match(/assets\/(\d+)/)?.[1] || '');
  if (!/^\d+$/.test(assetId)) throw new Error('Roblox completed the upload without returning an audio asset ID.');
  return { assetId, audioAssetId: `rbxassetid://${assetId}`, operation };
}

export async function uploadVideoAsset(videoPath, options = {}) {
  const apiKey = String(options.apiKey || process.env.ROBLOX_API_KEY || '').trim();
  if (!apiKey) throw new Error('ROBLOX_API_KEY is missing from .env.');
  const creator = options.creator || getRobloxCreator(options.env || process.env);
  const fetchImpl = options.fetchImpl || fetch;
  const expectedPrice = Number(options.expectedPrice);
  if (expectedPrice !== 2000) throw new Error('Video uploads require an expected price confirmation of exactly 2,000 Robux.');

  const fileInfo = await stat(videoPath);
  if (fileInfo.size <= 0) throw new Error('The generated video pack is empty.');
  if (fileInfo.size > OPEN_CLOUD_MAX_UPLOAD_BYTES) throw new Error(`This pack is ${(fileInfo.size / 1024 / 1024).toFixed(1)} MB. Automatic Roblox uploads must be 20 MB or smaller; create new API-ready packs first.`);
  if (fileInfo.size > 3.75 * 1024 * 1024 * 1024) throw new Error('The video exceeds Roblox\'s 3.75 GB limit.');
  const extension = path.extname(videoPath).toLowerCase();
  if (extension !== '.mp4' && extension !== '.mov') throw new Error('Roblox video uploads must be MP4 or MOV files.');
  const mimeType = extension === '.mov' ? 'video/mov' : 'video/mp4';

  const form = new FormData();
  form.append('request', JSON.stringify({
    assetType: 'Video',
    displayName: String(options.displayName || path.parse(videoPath).name).slice(0, 50),
    description: String(options.description || 'Video pack created by RoTools').slice(0, 1000),
    creationContext: { creator, expectedPrice },
  }));
  form.append('fileContent', await openAsBlob(videoPath, { type: mimeType }), path.basename(videoPath));

  const createResponse = await fetchImpl(`${ASSETS_BASE_URL}assets`, {
    method: 'POST',
    headers: { 'x-api-key': apiKey },
    body: form,
  });
  const initialOperation = await readResponse(createResponse);
  if (!createResponse.ok) throw apiError(createResponse.status, initialOperation, 'Video upload failed.');

  let operation = initialOperation;
  const operationPath = String(operation.path || operation.name || '');
  if (!operationPath) throw new Error('Roblox did not return a video upload operation.');
  const operationUrl = new URL(operationPath.replace(/^\//, ''), ASSETS_BASE_URL).toString();
  const pollIntervalMs = Number(options.pollIntervalMs) || 1500;
  const maxPolls = Number(options.maxPolls) || 160;

  for (let attempt = 0; !operation.done && attempt < maxPolls; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    const response = await fetchImpl(operationUrl, { headers: { 'x-api-key': apiKey } });
    operation = await readResponse(response);
    if (!response.ok) throw apiError(response.status, operation, 'Could not read video upload status.');
  }

  if (!operation.done) throw new Error('Roblox video upload timed out while processing. Check Creator Dashboard before retrying so you do not pay twice.');
  if (operation.error) throw apiError(400, operation.error, 'Roblox rejected the video.');
  const assetId = String(operation.response?.assetId || operation.response?.path?.match(/assets\/(\d+)/)?.[1] || '');
  if (!/^\d+$/.test(assetId)) throw new Error('Roblox completed the video upload without returning an asset ID.');
  return { assetId, videoAssetId: `rbxassetid://${assetId}`, operation };
}
