import path from 'node:path';
import { access } from 'node:fs/promises';
import { ingestVideo } from './processor.js';
import { toVideoId } from './videoIds.js';

const input = process.argv[2];
const audioArgument = process.argv[4];

function normalizeAudioAssetId(value) {
  if (!value) return undefined;
  const match = String(value).match(/^(?:rbxassetid:\/\/)?(\d+)$/);
  if (!match) throw new Error('Audio must be a numeric Roblox audio asset ID or rbxassetid://ID.');
  return `rbxassetid://${match[1]}`;
}

if (!input) {
  console.error('Usage: npm run ingest -- ./videos/example.mp4 [video-id] [roblox-audio-asset-id]');
  process.exitCode = 1;
} else {
  const inputPath = path.resolve(input);
  const id = process.argv[3] || toVideoId(path.basename(inputPath));
  try {
    await access(inputPath);
    const metadata = await ingestVideo(inputPath, { id, audioAssetId: normalizeAudioAssetId(audioArgument) });
    console.log(JSON.stringify({ ok: true, metadata }, null, 2));
  } catch (error) {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}
