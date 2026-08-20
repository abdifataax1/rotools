import express from 'express';
import multer from 'multer';
import os from 'node:os';
import path from 'node:path';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { extractAudio, ingestVideo } from './processor.js';
import { compileVideoPacks } from './compiler.js';
import { assertVideoId, toVideoId } from './videoIds.js';
import { getAudioUploadStatus, uploadAudioAsset, uploadVideoAsset } from './robloxAssets.js';
import { saveLocalRobloxConfig, saveLocalYouTubeConfig } from './localConfig.js';
import { downloadOwnedVideo } from './linkImporter.js';
import { getYouTubeSearchStatus, searchYouTubeShorts } from './youtubeShorts.js';

const uploadRoot = path.join(os.tmpdir(), 'rotools-shorts-uploads');
const compilationRoot = path.resolve('data/compilations');
await mkdir(uploadRoot, { recursive: true });
await mkdir(compilationRoot, { recursive: true });

const upload = multer({
  dest: uploadRoot,
  limits: { files: 1, fileSize: 250 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    const allowed = new Set(['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska']);
    callback(allowed.has(file.mimetype) ? null : new Error('Choose an MP4, MOV, WebM, or MKV video.'), allowed.has(file.mimetype));
  },
});

const combineUpload = multer({
  dest: uploadRoot,
  limits: { files: 60, fileSize: 500 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    const allowed = new Set(['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska']);
    callback(allowed.has(file.mimetype) ? null : new Error('Choose MP4, MOV, WebM, or MKV videos.'), allowed.has(file.mimetype));
  },
});

function localOnly(req, res, next) {
  const address = String(req.socket.remoteAddress || '');
  if (address === '127.0.0.1' || address === '::1' || address.endsWith(':127.0.0.1')) return next();
  return res.status(403).json({ error: 'Video uploads are available only from this computer.' });
}

function normalizeAudioAssetId(value) {
  if (!value) return undefined;
  const match = String(value).trim().match(/^(?:rbxassetid:\/\/)?(\d+)$/);
  if (!match) { const error = new Error('Existing audio ID must be numeric.'); error.status = 400; throw error; }
  return `rbxassetid://${match[1]}`;
}

export function createShortsUploadRouter(options = {}) {
  const router = express.Router();
  const ingest = options.ingestVideo || ingestVideo;
  const extract = options.extractAudio || extractAudio;
  const uploadAudio = options.uploadAudioAsset || uploadAudioAsset;
  const uploadVideo = options.uploadVideoAsset || uploadVideoAsset;
  const compile = options.compileVideoPacks || compileVideoPacks;
  const importLink = options.downloadOwnedVideo || downloadOwnedVideo;
  const searchShorts = options.searchYouTubeShorts || searchYouTubeShorts;
  const saveYouTubeConfig = options.saveLocalYouTubeConfig || saveLocalYouTubeConfig;

  router.get('/status', localOnly, (_req, res) => {
    res.json({
      ok: true,
      audioUpload: getAudioUploadStatus(),
      videoUpload: { ...getAudioUploadStatus(), expectedPrice: 2000, dailyLimit: 20 },
      youtubeSearch: getYouTubeSearchStatus(),
      limits: { maxVideoBytes: 250 * 1024 * 1024, maxProcessedSeconds: 20, openCloudVerifiedAudioPerMonth: 100 },
    });
  });

  router.post('/youtube/config', localOnly, async (req, res, next) => {
    try {
      const saved = await saveYouTubeConfig(req.body?.apiKey);
      res.json({ ok: true, youtubeSearch: saved });
    } catch (error) { next(error); }
  });

  router.post('/youtube/search', localOnly, async (req, res, next) => {
    try {
      const videos = await searchShorts(req.body?.query, { limit: req.body?.limit });
      res.json({ ok: true, videos });
    } catch (error) { next(error); }
  });

  router.post('/config', localOnly, async (req, res, next) => {
    try {
      const saved = await saveLocalRobloxConfig({
        apiKey: req.body?.apiKey,
        creatorType: req.body?.creatorType,
        creatorId: req.body?.creatorId,
      });
      res.json({ ok: true, audioUpload: { ...saved, hasApiKey: true } });
    } catch (error) { next(error); }
  });

  router.post('/combine', localOnly, combineUpload.array('videos', 60), async (req, res, next) => {
    if (!req.files?.length) return res.status(400).json({ error: 'Choose at least one video.' });
    const workDirectory = await mkdtemp(path.join(uploadRoot, 'combine-'));
    try {
      const manifest = await compile(req.files, { workDirectory, outputRoot: compilationRoot });
      const baseUrl = `/api/shorts/upload/combine/${manifest.jobId}`;
      res.status(201).json({
        ok: true,
        manifest: {
          ...manifest,
          downloadUrl: `${baseUrl}/manifest.json`,
          packs: manifest.packs.map((pack) => ({ ...pack, downloadUrl: `${baseUrl}/${pack.file}` })),
        },
      });
    } catch (error) {
      next(error);
    } finally {
      await Promise.allSettled([
        ...req.files.map((file) => rm(file.path, { force: true })),
        rm(workDirectory, { recursive: true, force: true }),
      ]);
    }
  });

  router.post('/import-link', localOnly, async (req, res, next) => {
    if (req.body?.confirmRights !== true) {
      return res.status(400).json({ error: 'Confirm that you own this video or have permission to download it.' });
    }
    const workDirectory = await mkdtemp(path.join(uploadRoot, 'link-'));
    try {
      const downloaded = await importLink(req.body?.url, workDirectory);
      res.download(downloaded.filePath, downloaded.filename, async (error) => {
        await rm(workDirectory, { recursive: true, force: true });
        if (error && !res.headersSent) next(error);
      });
    } catch (error) {
      await rm(workDirectory, { recursive: true, force: true });
      next(error);
    }
  });

  router.get('/combine/:jobId/:filename', localOnly, async (req, res, next) => {
    try {
      const { jobId, filename } = req.params;
      if (!/^[0-9a-f-]{36}$/i.test(jobId) || !/^(?:manifest\.json|pack-\d{3}\.mp4)$/.test(filename)) return res.status(404).end();
      const filePath = path.join(compilationRoot, jobId, filename);
      await access(filePath);
      res.download(filePath, filename);
    } catch (error) {
      if (error.code === 'ENOENT') return res.status(404).end();
      next(error);
    }
  });

  router.post('/combine/:jobId/:filename/roblox-upload', localOnly, async (req, res, next) => {
    try {
      const { jobId, filename } = req.params;
      if (!/^[0-9a-f-]{36}$/i.test(jobId) || !/^pack-\d{3}\.mp4$/.test(filename)) return res.status(404).end();
      if (req.body?.confirmCost !== true || Number(req.body?.expectedPrice) !== 2000) {
        return res.status(400).json({ error: 'Confirm that this upload will spend 2,000 Robux.' });
      }
      if (req.body?.confirmRights !== true) {
        return res.status(400).json({ error: 'Confirm that you own or have permission to upload every clip in this pack.' });
      }

      const outputDirectory = path.join(compilationRoot, jobId);
      const filePath = path.join(outputDirectory, filename);
      const manifestPath = path.join(outputDirectory, 'manifest.json');
      await Promise.all([access(filePath), access(manifestPath)]);
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
      const pack = manifest.packs?.find((item) => item.file === filename);
      if (!pack) return res.status(404).json({ error: 'This pack is missing from its timestamp map.' });
      if (pack.robloxAssetId) return res.status(409).json({ error: `This pack was already uploaded as Roblox asset ${pack.robloxAssetId}.` });

      const uploaded = await uploadVideo(filePath, {
        displayName: String(req.body?.displayName || `Shorts ${filename.replace('.mp4', '')}`),
        description: 'Combined short-form video pack for a Roblox experience',
        expectedPrice: 2000,
      });
      pack.robloxAssetId = uploaded.assetId;
      pack.robloxVideo = uploaded.videoAssetId;
      pack.uploadedAt = new Date().toISOString();
      pack.moderationState = uploaded.operation?.response?.moderationResult?.moderationState || 'PROCESSING';
      await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
      res.status(201).json({
        ok: true,
        assetId: uploaded.assetId,
        videoAssetId: uploaded.videoAssetId,
        moderationState: pack.moderationState,
        message: 'Video sent to Roblox. It may not play until moderation approves it.',
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/', localOnly, upload.single('video'), async (req, res, next) => {
    if (!req.file) return res.status(400).json({ error: 'Choose a video file.' });
    const workDirectory = await mkdtemp(path.join(uploadRoot, 'job-'));
    try {
      const id = String(req.body.id || toVideoId(req.file.originalname));
      assertVideoId(id);
      const audioMode = String(req.body.audioMode || 'automatic');
      let audioAssetId;
      let uploadedAudioAssetId = null;

      if (audioMode === 'automatic') {
        const audioPath = path.join(workDirectory, `${id}-audio.mp3`);
        await extract(req.file.path, audioPath);
        const uploaded = await uploadAudio(audioPath, { displayName: String(req.body.displayName || id) });
        audioAssetId = uploaded.audioAssetId;
        uploadedAudioAssetId = uploaded.assetId;
      } else if (audioMode === 'existing') {
        audioAssetId = normalizeAudioAssetId(req.body.audioAssetId);
        if (!audioAssetId) { const error = new Error('Enter an existing Roblox audio asset ID.'); error.status = 400; throw error; }
      } else if (audioMode !== 'silent') {
        const error = new Error('Invalid audio mode.'); error.status = 400; throw error;
      }

      const metadata = await ingest(req.file.path, { id, audioAssetId });
      res.status(201).json({ ok: true, metadata, uploadedAudioAssetId, message: uploadedAudioAssetId ? 'Video ingested and audio sent to Roblox moderation.' : 'Video ingested.' });
    } catch (error) {
      next(error);
    } finally {
      await Promise.allSettled([
        rm(req.file.path, { force: true }),
        rm(workDirectory, { recursive: true, force: true }),
      ]);
    }
  });

  router.use((error, _req, res, _next) => {
    const status = error.status || (error instanceof multer.MulterError ? 400 : 500);
    res.status(status).json({ error: error.message || 'Video upload failed.' });
  });
  return router;
}
