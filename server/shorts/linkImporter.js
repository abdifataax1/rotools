import path from 'node:path';
import tls from 'node:tls';
import { readdir, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';

const ytDlpPath = path.resolve('tools/yt-dlp.exe');
const supportedHosts = ['tiktok.com', 'youtube.com', 'youtu.be'];

export function validateOwnedVideoUrl(value) {
  let parsed;
  try {
    parsed = new URL(String(value || '').trim());
  } catch {
    const error = new Error('Paste a valid TikTok or YouTube video link.');
    error.status = 400;
    throw error;
  }
  const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
  const supported = supportedHosts.some((host) => hostname === host || hostname.endsWith(`.${host}`));
  if (parsed.protocol !== 'https:' || !supported || parsed.username || parsed.password || parsed.href.length > 2048) {
    const error = new Error('Only public HTTPS TikTok and YouTube video links are supported.');
    error.status = 400;
    throw error;
  }
  return parsed.href;
}

function runYtDlp(args, timeoutMs = 180_000, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(ytDlpPath, args, { windowsHide: true, shell: false, env: { ...process.env, ...extraEnv } });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      const error = new Error('The download took too long. Try the link again.');
      error.status = 504;
      reject(error);
    }, timeoutMs);
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', (cause) => {
      clearTimeout(timer);
      const error = new Error(cause.code === 'ENOENT' ? 'The local link downloader is not installed.' : cause.message);
      error.status = 503;
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) return resolve({ stdout, stderr });
      const lines = `${stderr}\n${stdout}`
        .replace(/\u001b\[[0-9;]*m/g, '')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      const usefulLine = [...lines].reverse().find((line) => !/aborting remaining downloads/i.test(line)
        && /(?:ERROR:|unable|unavailable|private|login|sign.?in|cookies?|forbidden|not found|no video)/i.test(line));
      const fallbackLine = [...lines].reverse().find((line) => !/aborting remaining downloads/i.test(line));
      const rawDetail = (usefulLine || fallbackLine || 'The platform could not provide this video.').replace(/^ERROR:\s*/i, '');
      let detail = rawDetail;
      if (/private/i.test(rawDetail)) detail = 'This video is private. Change it to public or download it from your TikTok account.';
      else if (/(?:login|sign.?in|cookies?)/i.test(rawDetail)) detail = 'This video requires a signed-in browser session, which the local downloader cannot access safely.';
      else if (/(?:unavailable|not available|not found)/i.test(rawDetail)) detail = 'This video is unavailable, deleted, region-blocked, or the link has expired.';
      else if (/(?:forbidden|HTTP Error 403)/i.test(rawDetail)) detail = 'TikTok or YouTube refused this download. Try the full public video URL instead of a shortened or copied redirect.';
      const error = new Error(`Could not download that link: ${detail.slice(0, 700)}`);
      error.status = 422;
      reject(error);
    });
  });
}

export async function downloadOwnedVideo(url, outputDirectory) {
  const safeUrl = validateOwnedVideoUrl(url);
  const outputTemplate = path.join(outputDirectory, '%(title).100B-%(id)s.%(ext)s');
  const caBundlePath = path.join(outputDirectory, 'system-ca.pem');
  const systemCertificates = typeof tls.getCACertificates === 'function' ? tls.getCACertificates('system') : [];
  await writeFile(caBundlePath, [...new Set([...tls.rootCertificates, ...systemCertificates])].join('\n'), 'utf8');
  await runYtDlp([
    '--no-playlist',
    '--max-filesize', '250M',
    '--no-progress',
    '--restrict-filenames',
    '--compat-options', 'no-certifi',
    '--js-runtimes', `node:${process.execPath}`,
    '--ffmpeg-location', ffmpegPath,
    '--merge-output-format', 'mp4',
    '--recode-video', 'mp4',
    '-S', 'res:1080,ext:mp4:m4a',
    '-o', outputTemplate,
    safeUrl,
  ], 180_000, { SSL_CERT_FILE: caBundlePath, CURL_CA_BUNDLE: caBundlePath, REQUESTS_CA_BUNDLE: caBundlePath });
  const files = (await readdir(outputDirectory)).filter((name) => name.toLowerCase().endsWith('.mp4'));
  if (files.length !== 1) {
    await rm(outputDirectory, { recursive: true, force: true });
    const error = new Error('The video downloaded, but no usable MP4 was created.');
    error.status = 422;
    throw error;
  }
  return { filePath: path.join(outputDirectory, files[0]), filename: files[0] };
}
