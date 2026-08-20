import path from 'node:path';
import os from 'node:os';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { compileVideoPacks } from '../server/shorts/compiler.js';

const [sourcePathValue, manifestPathValue, packNumberValue = '1'] = process.argv.slice(2);
if (!sourcePathValue || !manifestPathValue) {
  throw new Error('Usage: node tools/repack-video-pack.mjs <pack.mp4> <manifest.json> [pack-number]');
}

const sourcePath = path.resolve(sourcePathValue);
const manifestPath = path.resolve(manifestPathValue);
const sourceManifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const sourcePack = sourceManifest.packs?.[Number(packNumberValue) - 1];
if (!sourcePack?.clips?.length) throw new Error('That pack is missing from the timestamp map.');

const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'rotools-repack-'));
const workDirectory = path.join(temporaryDirectory, 'work');
await mkdir(workDirectory);

try {
  const files = sourcePack.clips.map((clip) => ({
    path: sourcePath,
    originalname: clip.filename,
    mimetype: 'video/mp4',
    inputStart: clip.start,
    duration: clip.duration,
  }));
  const manifest = await compileVideoPacks(files, {
    workDirectory,
    outputRoot: path.resolve('data/compilations'),
    maxPackBytes: 19 * 1024 * 1024,
  });
  console.log(JSON.stringify(manifest, null, 2));
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
