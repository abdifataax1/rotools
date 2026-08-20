import test from 'node:test';
import assert from 'node:assert/strict';
import { searchYouTubeShorts } from './youtubeShorts.js';

test('YouTube search returns randomized embeddable short videos without exposing the key', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(String(url));
    if (String(url).includes('/search?')) {
      return new Response(JSON.stringify({ items: [{ id: { videoId: 'short1' } }, { id: { videoId: 'long1' } }] }), { status: 200 });
    }
    return new Response(JSON.stringify({ items: [
      { id: 'short1', snippet: { title: 'Funny short', channelTitle: 'Friend', thumbnails: { high: { url: 'https://example.com/short.jpg' } } }, contentDetails: { duration: 'PT15S' }, status: { embeddable: true } },
      { id: 'long1', snippet: { title: 'Too long', channelTitle: 'Friend' }, contentDetails: { duration: 'PT4M1S' }, status: { embeddable: true } },
    ] }), { status: 200 });
  };
  const videos = await searchYouTubeShorts('funny', { apiKey: 'secret-key-for-testing-123', fetchImpl, limit: 10 });
  assert.equal(videos.length, 1);
  assert.equal(videos[0].url, 'https://www.youtube.com/shorts/short1');
  assert.equal(videos[0].duration, 15);
  assert.match(calls[0], /safeSearch=strict/);
  assert.match(calls[0], /videoDuration=short/);
  assert.equal(JSON.stringify(videos).includes('secret-key'), false);
});

