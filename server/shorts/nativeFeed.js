import path from 'node:path';
import { readFile, readdir } from 'node:fs/promises';

function asAssetUri(pack) {
  if (typeof pack.robloxVideo === 'string' && /^rbxassetid:\/\/\d+$/.test(pack.robloxVideo)) return pack.robloxVideo;
  if (/^\d+$/.test(String(pack.robloxAssetId || ''))) return `rbxassetid://${pack.robloxAssetId}`;
  return null;
}

export function manifestToNativeFeed(manifest) {
  const videos = [];
  const shortJobId = String(manifest.jobId || 'local').replaceAll('-', '').slice(0, 12) || 'local';
  for (let packIndex = 0; packIndex < (manifest.packs || []).length; packIndex += 1) {
    const pack = manifest.packs[packIndex];
    const videoAssetId = asAssetUri(pack);
    if (!videoAssetId) continue;
    for (let clipIndex = 0; clipIndex < (pack.clips || []).length; clipIndex += 1) {
      const clip = pack.clips[clipIndex];
      const startTime = Number(clip.start) || 0;
      const endTime = Number(clip.end) || startTime + (Number(clip.duration) || 0);
      videos.push({
        id: `nf-${shortJobId}-${packIndex + 1}-${clipIndex + 1}`,
        title: clip.title || path.parse(clip.filename || `Short ${clip.index + 1}`).name,
        username: manifest.username || '@kariye112',
        owner: true,
        likes: 0,
        comments: 0,
        likedByCurrentUser: false,
        videoAssetId,
        startTime,
        endTime,
        duration: Number(clip.duration) || Math.max(0, endTime - startTime),
        width: Number(manifest.format?.width) || 1080,
        height: Number(manifest.format?.height) || 1920,
        fps: Number(manifest.format?.fps) || 30,
        genre: clip.genre || manifest.genre || 'general',
      });
    }
  }
  return videos;
}

export async function loadUploadedNativeFeed(compilationRoot) {
  const entries = await readdir(compilationRoot, { withFileTypes: true }).catch(() => []);
  const manifests = await Promise.all(entries
    .filter((entry) => entry.isDirectory())
    .map(async (entry) => {
      try {
        return JSON.parse(await readFile(path.join(compilationRoot, entry.name, 'manifest.json'), 'utf8'));
      } catch {
        return null;
      }
    }));
  return manifests.filter(Boolean).flatMap(manifestToNativeFeed);
}
