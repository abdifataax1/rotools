import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { mkdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { resolveMediaTools, runMediaCommand } from './processor.js';

const DEFAULT_MAX_PACK_SECONDS = 299;
const DEFAULT_MAX_PACK_BYTES = 19 * 1024 * 1024;
const PACK_OVERHEAD_RESERVE_BYTES = 256 * 1024;
const DEFAULT_WIDTH = 1080;
const DEFAULT_HEIGHT = 1920;
const DEFAULT_FPS = 30;

function rounded(value) {
  return Number(Number(value).toFixed(3));
}

export function buildPackPlan(clips, maxPackSeconds = DEFAULT_MAX_PACK_SECONDS) {
  if (!Array.isArray(clips) || clips.length === 0) throw new Error('Choose at least one video.');
  if (!Number.isFinite(maxPackSeconds) || maxPackSeconds <= 0 || maxPackSeconds > 300) throw new Error('Pack duration must be between 1 and 300 seconds.');

  const packs = [];
  let current = [];
  let currentDuration = 0;

  for (const clip of clips) {
    const duration = Number(clip.duration);
    if (!Number.isFinite(duration) || duration <= 0) throw new Error(`${clip.originalname || 'A clip'} has no readable duration.`);
    if (duration > maxPackSeconds) throw new Error(`${clip.originalname || 'A clip'} is too long for a five-minute pack. Trim it slightly before combining.`);

    if (current.length > 0 && currentDuration + duration > maxPackSeconds) {
      packs.push(current);
      current = [];
      currentDuration = 0;
    }
    current.push(clip);
    currentDuration += duration;
  }
  if (current.length > 0) packs.push(current);
  return packs;
}

export function buildSizedPackPlan(clips, maxPackSeconds = DEFAULT_MAX_PACK_SECONDS, maxPackBytes = DEFAULT_MAX_PACK_BYTES - PACK_OVERHEAD_RESERVE_BYTES) {
  if (!Array.isArray(clips) || clips.length === 0) throw new Error('Choose at least one video.');
  if (!Number.isFinite(maxPackBytes) || maxPackBytes <= 0) throw new Error('Pack size limit must be positive.');
  const packs = [];
  let current = [];
  let currentDuration = 0;
  let currentBytes = 0;

  for (const clip of clips) {
    const duration = Number(clip.normalizedDuration ?? clip.duration);
    const bytes = Number(clip.normalizedBytes);
    if (!Number.isFinite(duration) || duration <= 0) throw new Error(`${clip.originalname || 'A clip'} has no readable duration.`);
    if (!Number.isFinite(bytes) || bytes <= 0) throw new Error(`${clip.originalname || 'A clip'} has no readable file size.`);
    if (duration > maxPackSeconds) throw new Error(`${clip.originalname || 'A clip'} is too long for a five-minute pack. Trim it slightly before combining.`);
    if (bytes > maxPackBytes) throw new Error(`${clip.originalname || 'A clip'} could not be compressed below the automatic upload limit.`);

    if (current.length > 0 && (currentDuration + duration > maxPackSeconds || currentBytes + bytes > maxPackBytes)) {
      packs.push(current);
      current = [];
      currentDuration = 0;
      currentBytes = 0;
    }
    current.push(clip);
    currentDuration += duration;
    currentBytes += bytes;
  }
  if (current.length) packs.push(current);
  return packs;
}

async function probeClip(inputPath, ffprobe) {
  const output = await runMediaCommand(ffprobe, [
    '-v', 'error', '-show_entries', 'format=duration:stream=codec_type', '-of', 'json', inputPath,
  ]);
  const data = JSON.parse(output);
  const duration = Number(data.format?.duration);
  const hasVideo = data.streams?.some((stream) => stream.codec_type === 'video');
  const hasAudio = data.streams?.some((stream) => stream.codec_type === 'audio');
  if (!hasVideo || !Number.isFinite(duration) || duration <= 0) throw new Error('The input has no readable video stream.');
  return { duration, hasAudio };
}

function concatPath(filePath) {
  return filePath.replaceAll('\\', '/').replaceAll("'", "'\\''");
}

async function normalizeClip({ inputPath, outputPath, inputStart = 0, duration, hasAudio, tools, width, height, fps, videoBitrate = null }) {
  const videoFilter = `fps=${fps},scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,format=yuv420p`;
  const args = ['-y', '-v', 'error'];

  // Seek the input itself so both video and audio timestamps restart at zero.
  // Output-side seeking can leave later audio packets outside the trimmed range,
  // which produced silent packs when rebuilding timestamp slices.
  if (Number(inputStart) > 0) args.push('-ss', String(inputStart));
  args.push('-i', inputPath);

  if (!hasAudio) args.push('-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo');
  args.push('-map', '0:v:0');
  args.push('-map', hasAudio ? '0:a:0' : '1:a:0');
  const videoEncoding = videoBitrate
    ? ['-b:v', String(videoBitrate), '-maxrate', String(videoBitrate), '-bufsize', String(videoBitrate * 2)]
    : ['-crf', '20'];
  args.push(
    '-t', String(duration),
    '-vf', videoFilter,
    '-af', `aresample=48000:async=1:first_pts=0,apad,atrim=duration=${duration}`,
    '-c:v', 'libx264', '-preset', 'veryfast', ...videoEncoding,
    '-r', String(fps), '-g', String(fps * 2),
    '-c:a', 'aac', '-b:a', videoBitrate ? '128k' : '192k', '-ac', '2',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', outputPath,
  );
  await runMediaCommand(tools.ffmpeg, args);
}

async function normalizeClipWithinLimit(parameters, maxBytes) {
  await normalizeClip(parameters);
  let outputInfo = await stat(parameters.outputPath);
  if (outputInfo.size <= maxBytes) return outputInfo.size;

  const audioBitsPerSecond = 128_000;
  let videoBitrate = Math.max(180_000, Math.floor(((maxBytes * 8 * 0.9) / parameters.duration) - audioBitsPerSecond));
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const candidatePath = `${parameters.outputPath}.compressed-${attempt}.mp4`;
    await normalizeClip({ ...parameters, outputPath: candidatePath, videoBitrate });
    const candidateInfo = await stat(candidatePath);
    if (candidateInfo.size <= maxBytes) {
      await rm(parameters.outputPath, { force: true });
      await rename(candidatePath, parameters.outputPath);
      return candidateInfo.size;
    }
    await rm(candidatePath, { force: true });
    videoBitrate = Math.max(120_000, Math.floor(videoBitrate * (maxBytes / candidateInfo.size) * 0.88));
  }
  throw new Error(`${parameters.originalname || 'A clip'} could not be compressed below 19 MB.`);
}

async function probeDuration(inputPath, ffprobe) {
  const output = await runMediaCommand(ffprobe, [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', inputPath,
  ]);
  const duration = Number(output.trim());
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('Could not measure a processed clip.');
  return duration;
}

export async function compileVideoPacks(files, options = {}) {
  const tools = await resolveMediaTools();
  if (!tools.ffmpeg || !tools.ffprobe) throw new Error('FFmpeg is unavailable. Run npm install first.');

  const width = Number(options.width) || DEFAULT_WIDTH;
  const height = Number(options.height) || DEFAULT_HEIGHT;
  const fps = Number(options.fps) || DEFAULT_FPS;
  const maxPackSeconds = Number(options.maxPackSeconds) || DEFAULT_MAX_PACK_SECONDS;
  const maxPackBytes = Number(options.maxPackBytes) || DEFAULT_MAX_PACK_BYTES;
  const outputRoot = path.resolve(options.outputRoot || path.join(process.cwd(), 'data', 'compilations'));
  const workDirectory = path.resolve(options.workDirectory);
  const jobId = randomUUID();
  const outputDirectory = path.join(outputRoot, jobId);
  await mkdir(outputDirectory, { recursive: true });

  const clips = [];
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const info = await probeClip(file.path, tools.ffprobe);
    const requestedDuration = Number(file.duration);
    clips.push({ ...file, ...info, duration: Number.isFinite(requestedDuration) && requestedDuration > 0 ? requestedDuration : info.duration, index });
  }

  const normalizedClips = [];
  const maxPlannedBytes = maxPackBytes - PACK_OVERHEAD_RESERVE_BYTES;
  for (let index = 0; index < clips.length; index += 1) {
    const clip = clips[index];
    const normalizedPath = path.join(workDirectory, `normalized-clip-${String(index + 1).padStart(3, '0')}.mp4`);
    const normalizedBytes = await normalizeClipWithinLimit({
      inputPath: clip.path,
      outputPath: normalizedPath,
      inputStart: Number(clip.inputStart) || 0,
      duration: clip.duration,
      hasAudio: clip.hasAudio,
      tools,
      width,
      height,
      fps,
      originalname: clip.originalname,
    }, maxPlannedBytes);
    const normalizedDuration = await probeDuration(normalizedPath, tools.ffprobe);
    normalizedClips.push({ ...clip, normalizedPath, normalizedBytes, normalizedDuration });
  }

  const packPlan = buildSizedPackPlan(normalizedClips, maxPackSeconds, maxPlannedBytes);
  const manifest = {
    version: 1,
    jobId,
    createdAt: new Date().toISOString(),
    format: { width, height, fps, videoCodec: 'H.264', audioCodec: 'AAC' },
    maxPackSeconds,
    maxPackBytes,
    packs: [],
  };

  for (let packIndex = 0; packIndex < packPlan.length; packIndex += 1) {
    const packNumber = packIndex + 1;
    const normalizedPaths = [];
    const clipEntries = [];
    let cursor = 0;

    for (let clipIndex = 0; clipIndex < packPlan[packIndex].length; clipIndex += 1) {
      const clip = packPlan[packIndex][clipIndex];
      const normalizedDuration = clip.normalizedDuration;
      normalizedPaths.push(clip.normalizedPath);
      clipEntries.push({
        index: clip.index,
        filename: clip.originalname,
        start: rounded(cursor),
        end: rounded(cursor + normalizedDuration),
        duration: rounded(normalizedDuration),
      });
      cursor += normalizedDuration;
    }

    const listPath = path.join(workDirectory, `pack-${packNumber}-concat.txt`);
    await writeFile(listPath, normalizedPaths.map((filePath) => `file '${concatPath(filePath)}'`).join('\n'), 'utf8');
    const packFile = `pack-${String(packNumber).padStart(3, '0')}.mp4`;
    const outputPath = path.join(outputDirectory, packFile);
    await runMediaCommand(tools.ffmpeg, [
      '-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', listPath,
      '-c', 'copy', '-movflags', '+faststart', outputPath,
    ]);

    const outputInfo = await stat(outputPath);
    if (outputInfo.size > maxPackBytes) {
      throw new Error(`Pack ${packNumber} is ${(outputInfo.size / 1024 / 1024).toFixed(1)} MB after encoding, above the 19 MB automatic-upload target.`);
    }

    manifest.packs.push({ file: packFile, duration: rounded(cursor), sizeBytes: outputInfo.size, clips: clipEntries });
  }

  await writeFile(path.join(outputDirectory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifest;
}
