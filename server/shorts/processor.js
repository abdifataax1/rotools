import { createHash } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { encodeFrameChunk } from './frameChunk.js';
import { shortsConfig } from './config.js';
import { assertVideoId } from './videoIds.js';

async function dependencyPath(packageName, selector = (value) => value.default) {
  try { return selector(await import(packageName)); } catch { return null; }
}

export async function resolveMediaTools() {
  const ffmpeg = process.env.FFMPEG_PATH || await dependencyPath('ffmpeg-static');
  const ffprobe = process.env.FFPROBE_PATH || await dependencyPath('ffprobe-static', (value) => value.default?.path || value.path);
  return { ffmpeg, ffprobe };
}

export function runMediaCommand(command, args, { binary = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true });
    const stdout = [];
    const stderr = [];
    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) return resolve(binary ? Buffer.concat(stdout) : Buffer.concat(stdout).toString('utf8'));
      reject(new Error(`${path.basename(command)} exited ${code}: ${Buffer.concat(stderr).toString('utf8').slice(-2000)}`));
    });
  });
}

export async function probeVideo(inputPath, ffprobePath) {
  const output = await runMediaCommand(ffprobePath, ['-v', 'error', '-show_entries', 'format=duration:stream=width,height', '-select_streams', 'v:0', '-of', 'json', inputPath]);
  const data = JSON.parse(output);
  const stream = data.streams?.[0];
  const duration = Number(data.format?.duration);
  if (!stream || !Number.isFinite(duration) || duration <= 0) throw new Error('The input has no readable video stream.');
  return { duration, sourceWidth: stream.width, sourceHeight: stream.height };
}

export async function writeProcessedFrames({
  id,
  rgba,
  width = shortsConfig.width,
  height = shortsConfig.height,
  fps = shortsConfig.fps,
  chunkFrames = shortsConfig.chunkFrames,
  processedDirectory = shortsConfig.processedDirectory,
  zstdLevel = shortsConfig.zstdLevel,
  source = 'generated',
  audioAssetId,
}) {
  assertVideoId(id);
  const frameBytes = width * height * 4;
  if (!Buffer.isBuffer(rgba) || rgba.length === 0 || rgba.length % frameBytes !== 0) throw new Error('RGBA payload does not contain complete frames.');
  const frameCount = rgba.length / frameBytes;
  const outputDirectory = path.resolve(processedDirectory, id);
  const allowedRoot = `${path.resolve(processedDirectory)}${path.sep}`;
  if (!outputDirectory.startsWith(allowedRoot)) throw new Error('Unsafe processed output path.');
  await rm(outputDirectory, { recursive: true, force: true });
  await mkdir(outputDirectory, { recursive: true });

  const chunks = [];
  let compressedTotalBytes = 0;
  for (let startFrame = 0, index = 0; startFrame < frameCount; startFrame += chunkFrames, index += 1) {
    const count = Math.min(chunkFrames, frameCount - startFrame);
    const frames = Array.from({ length: count }, (_, offset) => {
      const start = (startFrame + offset) * frameBytes;
      return rgba.subarray(start, start + frameBytes);
    });
    const { raw, compressed } = encodeFrameChunk({ width, height, fps, startFrame, totalFrameCount: frameCount, frames, zstdLevel });
    const file = `chunk-${String(index).padStart(4, '0')}.rvz`;
    await writeFile(path.join(outputDirectory, file), compressed);
    compressedTotalBytes += compressed.length;
    chunks.push({ index, file, startFrame, frameCount: count, byteSize: compressed.length, rawByteSize: raw.length, sha256: createHash('sha256').update(compressed).digest('hex') });
  }

  const metadata = {
    id,
    source,
    format: 'RVF1_ZSTD_RGBA8',
    width,
    height,
    fps,
    duration: frameCount / fps,
    frameCount,
    frameBytes,
    chunkFrames,
    chunks,
    compressedBytes: compressedTotalBytes,
    rawBytes: rgba.length,
    likes: 0,
    seedComments: [],
    createdAt: new Date().toISOString(),
  };
  if (audioAssetId) metadata.audioAssetId = audioAssetId;
  await writeFile(path.join(outputDirectory, 'metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
  return metadata;
}

export async function ingestVideo(inputPath, options = {}) {
  const tools = await resolveMediaTools();
  if (!tools.ffmpeg || !tools.ffprobe) throw new Error('FFmpeg is unavailable. Run npm install or set FFMPEG_PATH and FFPROBE_PATH.');
  const info = await probeVideo(inputPath, tools.ffprobe);
  const config = { ...shortsConfig, ...options };
  const duration = Math.min(info.duration, config.maxDurationSeconds);
  const filter = `fps=${config.fps},scale=${config.width}:${config.height}:force_original_aspect_ratio=increase,crop=${config.width}:${config.height}`;
  const rgba = await runMediaCommand(tools.ffmpeg, ['-v', 'error', '-i', inputPath, '-t', String(duration), '-an', '-vf', filter, '-pix_fmt', 'rgba', '-f', 'rawvideo', 'pipe:1'], { binary: true });
  return writeProcessedFrames({ ...config, id: options.id, rgba, source: path.basename(inputPath), audioAssetId: options.audioAssetId });
}

export async function extractAudio(inputPath, outputPath, options = {}) {
  const tools = await resolveMediaTools();
  if (!tools.ffmpeg) throw new Error('FFmpeg is unavailable. Run npm install or set FFMPEG_PATH.');
  const duration = Math.min(Number(options.duration) || shortsConfig.maxDurationSeconds, shortsConfig.maxDurationSeconds);
  await runMediaCommand(tools.ffmpeg, [
    '-y', '-v', 'error', '-i', inputPath, '-t', String(duration), '-vn',
    '-ac', '2', '-ar', '44100', '-b:a', '128k', outputPath,
  ]);
  return outputPath;
}
