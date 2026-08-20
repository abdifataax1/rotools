import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { assertVideoId } from '../videoIds.js';

export class LocalVideoProvider {
  constructor(processedDirectory) {
    this.processedDirectory = processedDirectory;
  }

  async getVideos() {
    try {
      const entries = await readdir(this.processedDirectory, { withFileTypes: true });
      const videos = await Promise.all(entries.filter((entry) => entry.isDirectory()).map(async (entry) => {
        try { return await this.getMetadata(entry.name); } catch { return null; }
      }));
      return videos.filter(Boolean).sort((a, b) => a.id.localeCompare(b.id));
    } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
  }

  async getMetadata(videoId) {
    const id = assertVideoId(videoId);
    const file = path.join(this.processedDirectory, id, 'metadata.json');
    const metadata = JSON.parse(await readFile(file, 'utf8'));
    if (metadata.id !== id || !Number.isInteger(metadata.frameCount) || !Array.isArray(metadata.chunks)) throw new Error('Invalid processed metadata.');
    return metadata;
  }

  async getChunkPath(videoId, chunkIndex) {
    const metadata = await this.getMetadata(videoId);
    if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex >= metadata.chunks.length) {
      const error = new Error('Chunk not found.');
      error.status = 404;
      throw error;
    }
    const chunk = metadata.chunks[chunkIndex];
    const file = path.join(this.processedDirectory, metadata.id, chunk.file);
    await access(file);
    return { file, chunk, metadata };
  }
}
