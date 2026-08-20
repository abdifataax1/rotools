const VIDEO_ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;

export function assertVideoId(value) {
  if (typeof value !== 'string' || !VIDEO_ID.test(value)) {
    const error = new Error('Invalid video ID.');
    error.status = 400;
    throw error;
  }
  return value;
}

export function toVideoId(fileName) {
  const normalized = fileName
    .replace(/\.[^.]+$/, '')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return assertVideoId(normalized || `clip-${Date.now()}`);
}
