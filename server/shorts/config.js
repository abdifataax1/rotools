import path from 'node:path';

const root = process.cwd();

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export const shortsConfig = Object.freeze({
  width: positiveInteger(process.env.SHORTS_WIDTH, 300),
  height: positiveInteger(process.env.SHORTS_HEIGHT, 534),
  fps: positiveInteger(process.env.SHORTS_FPS, 30),
  chunkFrames: positiveInteger(process.env.SHORTS_CHUNK_FRAMES, 15),
  maxDurationSeconds: positiveInteger(process.env.SHORTS_MAX_DURATION, 20),
  zstdLevel: positiveInteger(process.env.SHORTS_ZSTD_LEVEL, 3),
  sourceDirectory: path.resolve(root, process.env.SHORTS_VIDEO_DIR || 'videos'),
  processedDirectory: path.resolve(root, process.env.SHORTS_PROCESSED_DIR || 'data/shorts'),
});
