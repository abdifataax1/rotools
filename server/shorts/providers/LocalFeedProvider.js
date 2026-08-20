function hashUser(value) {
  let hash = 2166136261;
  for (const byte of Buffer.from(String(value))) {
    hash ^= byte;
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash || 1;
}

function randomFromState(state) {
  let next = state >>> 0;
  next ^= next << 13;
  next ^= next >>> 17;
  next ^= next << 5;
  return next >>> 0;
}

export class LocalFeedProvider {
  constructor(videoProvider) {
    this.videoProvider = videoProvider;
  }

  async getFeedForUser(userId) {
    const items = (await this.videoProvider.getVideos()).map((item) => ({ ...item }));
    let state = hashUser(userId || 'anonymous');
    for (let index = items.length - 1; index > 0; index -= 1) {
      state = randomFromState(state);
      const swapIndex = state % (index + 1);
      [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
    }
    return items;
  }
}
