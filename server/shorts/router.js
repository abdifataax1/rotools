import express from 'express';
import path from 'node:path';
import { LocalVideoProvider } from './providers/LocalVideoProvider.js';
import { LocalFeedProvider } from './providers/LocalFeedProvider.js';
import { EngagementStore } from './EngagementStore.js';
import { createRateLimiter } from './rateLimiter.js';
import { resolveMediaTools } from './processor.js';
import { shortsConfig } from './config.js';
import { loadUploadedNativeFeed } from './nativeFeed.js';

function publicMetadata(metadata, engagement) {
  return {
    id: metadata.id,
    likes: engagement.likes,
    comments: engagement.comments,
    likedByCurrentUser: engagement.likedByCurrentUser,
    duration: metadata.duration,
    width: metadata.width,
    height: metadata.height,
    fps: metadata.fps,
    frameCount: metadata.frameCount,
    chunkFrames: metadata.chunkFrames,
    chunkCount: metadata.chunks.length,
    format: metadata.format,
    compressedBytes: metadata.compressedBytes,
    rawBytes: metadata.rawBytes,
    audioAssetId: metadata.audioAssetId || null,
  };
}

export function createShortsRouter(options = {}) {
  const videoProvider = options.videoProvider || new LocalVideoProvider(options.processedDirectory || shortsConfig.processedDirectory);
  const feedProvider = options.feedProvider || new LocalFeedProvider(videoProvider);
  const engagement = options.engagement || new EngagementStore();
  const limiter = createRateLimiter(options.rateLimit);
  const router = express.Router();
  const loadNativeFeed = options.loadUploadedNativeFeed || (() => loadUploadedNativeFeed(options.compilationRoot || path.resolve('data/compilations')));

  router.get('/native-feed', async (_req, res, next) => {
    try {
      res.json({ videos: await loadNativeFeed() });
    } catch (error) { next(error); }
  });

  router.get('/health', async (_req, res, next) => {
    try {
      const tools = await resolveMediaTools();
      res.json({ ok: true, service: 'roblox-shorts', format: 'RVF1_ZSTD_RGBA8', ffmpeg: Boolean(tools.ffmpeg), ffprobe: Boolean(tools.ffprobe) });
    } catch (error) { next(error); }
  });

  router.get('/feed', async (req, res, next) => {
    try {
      const playerId = String(req.query.playerId || 'anonymous');
      const videos = await feedProvider.getFeedForUser(playerId);
      res.json({ videos: videos.map((video) => publicMetadata(video, engagement.getState(video, playerId))) });
    } catch (error) { next(error); }
  });

  router.get('/video/:id/metadata', async (req, res, next) => {
    try {
      const metadata = await videoProvider.getMetadata(req.params.id);
      const playerId = String(req.query.playerId || 'anonymous');
      res.json({ ...publicMetadata(metadata, engagement.getState(metadata, playerId)), chunks: metadata.chunks });
    } catch (error) { next(error); }
  });

  router.get('/video/:id/chunk/:chunkIndex', async (req, res, next) => {
    try {
      const chunkIndex = Number(req.params.chunkIndex);
      const { file, chunk } = await videoProvider.getChunkPath(req.params.id, chunkIndex);
      res.set({ 'Content-Type': 'application/zstd', 'Content-Length': String(chunk.byteSize), 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Chunk-SHA256': chunk.sha256 });
      res.sendFile(file);
    } catch (error) { next(error); }
  });

  router.post('/video/:id/like', limiter, async (req, res, next) => {
    try {
      const metadata = await videoProvider.getMetadata(req.params.id);
      const playerId = String(req.body?.playerId || 'anonymous');
      res.json({ ok: true, ...engagement.setLike(metadata, playerId, true) });
    } catch (error) { next(error); }
  });

  router.delete('/video/:id/like', limiter, async (req, res, next) => {
    try {
      const metadata = await videoProvider.getMetadata(req.params.id);
      const playerId = String(req.body?.playerId || 'anonymous');
      res.json({ ok: true, ...engagement.setLike(metadata, playerId, false) });
    } catch (error) { next(error); }
  });

  router.get('/video/:id/comments', async (req, res, next) => {
    try {
      const metadata = await videoProvider.getMetadata(req.params.id);
      res.json({ comments: engagement.listComments(metadata) });
    } catch (error) { next(error); }
  });

  router.post('/video/:id/comments', limiter, async (req, res, next) => {
    try {
      const metadata = await videoProvider.getMetadata(req.params.id);
      const comment = engagement.addComment(metadata, req.body?.playerId || 'anonymous', req.body?.text, req.body?.username);
      res.status(201).json({ ok: true, comment, count: engagement.listComments(metadata).length });
    } catch (error) { next(error); }
  });

  router.use((error, _req, res, _next) => {
    const status = error.status || (error.code === 'ENOENT' ? 404 : 500);
    res.status(status).json({ error: status === 500 ? 'Shorts service failed.' : error.message });
  });
  return router;
}
