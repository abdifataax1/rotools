import { zstdCompressSync, zstdDecompressSync } from 'node:zlib';

export const CHUNK_MAGIC = 'RVF1';
export const CHUNK_HEADER_BYTES = 32;

export function encodeFrameChunk({ width, height, fps, startFrame, totalFrameCount, frames, zstdLevel = 3 }) {
  if (!Array.isArray(frames) || frames.length === 0) throw new Error('At least one RGBA frame is required.');
  const frameBytes = width * height * 4;
  for (const frame of frames) {
    if (!Buffer.isBuffer(frame) || frame.length !== frameBytes) throw new Error(`Expected ${frameBytes} bytes per RGBA frame.`);
  }

  const raw = Buffer.allocUnsafe(CHUNK_HEADER_BYTES + frameBytes * frames.length);
  raw.write(CHUNK_MAGIC, 0, 4, 'ascii');
  raw.writeUInt8(1, 4);
  raw.writeUInt8(4, 5);
  raw.writeUInt16LE(CHUNK_HEADER_BYTES, 6);
  raw.writeUInt16LE(width, 8);
  raw.writeUInt16LE(height, 10);
  raw.writeUInt16LE(Math.round(fps * 100), 12);
  raw.writeUInt16LE(frames.length, 14);
  raw.writeUInt32LE(startFrame, 16);
  raw.writeUInt32LE(totalFrameCount, 20);
  raw.writeUInt32LE(frameBytes, 24);
  raw.writeUInt32LE(raw.length, 28);
  frames.forEach((frame, index) => frame.copy(raw, CHUNK_HEADER_BYTES + index * frameBytes));

  return { raw, compressed: zstdCompressSync(raw, { params: { 100: zstdLevel } }) };
}

export function decodeFrameChunk(compressed) {
  const raw = zstdDecompressSync(compressed);
  if (raw.toString('ascii', 0, 4) !== CHUNK_MAGIC) throw new Error('Invalid frame chunk magic.');
  const headerBytes = raw.readUInt16LE(6);
  const metadata = {
    version: raw.readUInt8(4),
    channels: raw.readUInt8(5),
    width: raw.readUInt16LE(8),
    height: raw.readUInt16LE(10),
    fps: raw.readUInt16LE(12) / 100,
    frameCount: raw.readUInt16LE(14),
    startFrame: raw.readUInt32LE(16),
    totalFrameCount: raw.readUInt32LE(20),
    frameBytes: raw.readUInt32LE(24),
    rawBytes: raw.readUInt32LE(28),
  };
  if (metadata.version !== 1 || metadata.channels !== 4 || metadata.rawBytes !== raw.length) throw new Error('Unsupported or corrupted frame chunk.');
  const expected = headerBytes + metadata.frameBytes * metadata.frameCount;
  if (expected !== raw.length) throw new Error('Frame chunk length mismatch.');
  return { raw, headerBytes, ...metadata };
}
