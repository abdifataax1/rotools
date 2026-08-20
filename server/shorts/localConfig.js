import path from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';

function envValue(value) {
  return JSON.stringify(String(value));
}

function setEnvValue(source, key, value) {
  const line = `${key}=${envValue(value)}`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  if (pattern.test(source)) return source.replace(pattern, line);
  return `${source.replace(/\s*$/, '')}${source.trim() ? '\n' : ''}${line}\n`;
}

export async function saveLocalRobloxConfig({ apiKey, creatorType, creatorId }, options = {}) {
  const cleanKey = String(apiKey || '').trim();
  const cleanCreatorId = String(creatorId || '').trim();
  if (cleanKey.length < 20 || cleanKey.length > 4096 || /[\r\n]/.test(cleanKey)) {
    const error = new Error('Paste the complete Roblox API key.');
    error.status = 400;
    throw error;
  }
  if (!/^\d+$/.test(cleanCreatorId)) {
    const error = new Error('Creator ID must contain numbers only.');
    error.status = 400;
    throw error;
  }
  if (creatorType !== 'user' && creatorType !== 'group') {
    const error = new Error('Choose Personal account or Group.');
    error.status = 400;
    throw error;
  }

  const envFile = options.envFile || path.resolve(process.cwd(), '.env');
  const targetEnv = options.targetEnv || process.env;
  let source = '';
  try { source = await readFile(envFile, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  source = setEnvValue(source, 'ROBLOX_API_KEY', cleanKey);
  source = setEnvValue(source, 'ROBLOX_CREATOR_USER_ID', creatorType === 'user' ? cleanCreatorId : '');
  source = setEnvValue(source, 'ROBLOX_CREATOR_GROUP_ID', creatorType === 'group' ? cleanCreatorId : '');
  await writeFile(envFile, source, { encoding: 'utf8', mode: 0o600 });

  targetEnv.ROBLOX_API_KEY = cleanKey;
  targetEnv.ROBLOX_CREATOR_USER_ID = creatorType === 'user' ? cleanCreatorId : '';
  targetEnv.ROBLOX_CREATOR_GROUP_ID = creatorType === 'group' ? cleanCreatorId : '';
  return { configured: true, creatorType: creatorType === 'user' ? 'userId' : 'groupId', creatorId: cleanCreatorId };
}

export async function saveLocalYouTubeConfig(apiKey, options = {}) {
  const cleanKey = String(apiKey || '').trim();
  if (cleanKey.length < 20 || cleanKey.length > 512 || /[\r\n]/.test(cleanKey)) {
    const error = new Error('Paste the complete YouTube Data API key.');
    error.status = 400;
    throw error;
  }
  const envFile = options.envFile || path.resolve(process.cwd(), '.env');
  const targetEnv = options.targetEnv || process.env;
  let source = '';
  try { source = await readFile(envFile, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  source = setEnvValue(source, 'YOUTUBE_DATA_API_KEY', cleanKey);
  await writeFile(envFile, source, { encoding: 'utf8', mode: 0o600 });
  targetEnv.YOUTUBE_DATA_API_KEY = cleanKey;
  return { configured: true };
}
