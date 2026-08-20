import test from 'node:test';
import assert from 'node:assert/strict';
import { validateOwnedVideoUrl } from './linkImporter.js';

test('accepts public TikTok and YouTube HTTPS links', () => {
  assert.equal(validateOwnedVideoUrl('https://www.tiktok.com/@creator/video/123'), 'https://www.tiktok.com/@creator/video/123');
  assert.equal(validateOwnedVideoUrl('https://youtu.be/abc123'), 'https://youtu.be/abc123');
  assert.equal(validateOwnedVideoUrl('https://m.youtube.com/shorts/abc123'), 'https://m.youtube.com/shorts/abc123');
});

test('rejects unsupported, insecure, and lookalike hosts', () => {
  assert.throws(() => validateOwnedVideoUrl('http://tiktok.com/@creator/video/123'), /public HTTPS/);
  assert.throws(() => validateOwnedVideoUrl('https://tiktok.com.example.com/video/123'), /public HTTPS/);
  assert.throws(() => validateOwnedVideoUrl('https://example.com/video/123'), /public HTTPS/);
  assert.throws(() => validateOwnedVideoUrl('not a url'), /valid TikTok or YouTube/);
});
