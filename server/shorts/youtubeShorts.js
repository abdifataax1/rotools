function parseIsoDuration(value) {
  const match = String(value || '').match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return 0;
  return (Number(match[1] || 0) * 3600) + (Number(match[2] || 0) * 60) + Number(match[3] || 0);
}

function shuffle(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

async function googleRequest(pathname, parameters, apiKey, fetchImpl) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${pathname}`);
  Object.entries({ ...parameters, key: apiKey }).forEach(([key, value]) => url.searchParams.set(key, String(value)));
  const response = await fetchImpl(url, { headers: { Accept: 'application/json' } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error?.message || 'YouTube search failed. Check the API key and its YouTube Data API access.');
    error.status = response.status === 403 ? 403 : 502;
    throw error;
  }
  return data;
}

export function getYouTubeSearchStatus(env = process.env) {
  return { configured: Boolean(String(env.YOUTUBE_DATA_API_KEY || '').trim()) };
}

export async function searchYouTubeShorts(query, options = {}) {
  const cleanQuery = String(query || '').trim().slice(0, 80);
  if (!cleanQuery) {
    const error = new Error('Enter something to search for, such as funny or brainrot.');
    error.status = 400;
    throw error;
  }
  const apiKey = String(options.apiKey || process.env.YOUTUBE_DATA_API_KEY || '').trim();
  if (!apiKey) {
    const error = new Error('Save a YouTube Data API key first.');
    error.status = 400;
    throw error;
  }
  const fetchImpl = options.fetchImpl || fetch;
  const requested = Math.min(20, Math.max(1, Number(options.limit) || 12));
  const search = await googleRequest('search', {
    part: 'snippet',
    type: 'video',
    q: `${cleanQuery} #shorts`,
    maxResults: 50,
    order: 'relevance',
    safeSearch: 'strict',
    videoDuration: 'short',
    videoEmbeddable: 'true',
  }, apiKey, fetchImpl);
  const ids = (search.items || []).map((item) => item?.id?.videoId).filter(Boolean);
  if (!ids.length) return [];

  const details = await googleRequest('videos', {
    part: 'snippet,contentDetails,status',
    id: ids.join(','),
  }, apiKey, fetchImpl);
  const candidates = (details.items || [])
    .map((item) => ({
      id: item.id,
      url: `https://www.youtube.com/shorts/${item.id}`,
      title: item.snippet?.title || 'YouTube Short',
      channel: item.snippet?.channelTitle || 'YouTube',
      thumbnail: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || '',
      duration: parseIsoDuration(item.contentDetails?.duration),
    }))
    .filter((item) => item.duration > 0 && item.duration <= 180);
  return shuffle(candidates).slice(0, requested);
}

