export class EngagementStore {
  constructor() {
    this.likes = new Map();
    this.comments = new Map();
  }

  hydrate(metadata) {
    if (!this.likes.has(metadata.id)) this.likes.set(metadata.id, { base: Number(metadata.likes) || 0, users: new Set() });
    if (!this.comments.has(metadata.id)) this.comments.set(metadata.id, Array.isArray(metadata.seedComments) ? [...metadata.seedComments] : []);
  }

  getState(metadata, playerId) {
    this.hydrate(metadata);
    const like = this.likes.get(metadata.id);
    return { likes: like.base + like.users.size, comments: this.comments.get(metadata.id).length, likedByCurrentUser: like.users.has(String(playerId)) };
  }

  setLike(metadata, playerId, liked) {
    this.hydrate(metadata);
    const users = this.likes.get(metadata.id).users;
    const key = String(playerId);
    if (liked) users.add(key); else users.delete(key);
    return this.getState(metadata, playerId);
  }

  listComments(metadata) {
    this.hydrate(metadata);
    return this.comments.get(metadata.id).map((comment) => ({ ...comment }));
  }

  addComment(metadata, playerId, text, username) {
    this.hydrate(metadata);
    const clean = String(text || '').trim().slice(0, 200);
    if (!clean) { const error = new Error('Comment text is required.'); error.status = 400; throw error; }
    const fallbackUsername = `Player ${String(playerId)}`;
    const cleanUsername = String(username || fallbackUsername).trim().slice(0, 20) || fallbackUsername;
    const item = { userId: String(playerId), username: cleanUsername, text: clean, likes: 0, createdAt: new Date().toISOString() };
    this.comments.get(metadata.id).push(item);
    return { ...item };
  }
}
