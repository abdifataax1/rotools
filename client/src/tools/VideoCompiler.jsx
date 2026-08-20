import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, CheckCircle2, CloudUpload, Coins, Download, Eye, Files, Film, KeyRound, Link2, ListPlus, LoaderCircle, Search, ShieldCheck, Shuffle, Trash2, X } from 'lucide-react';
import { Card, PageTitle } from '../components/Card.jsx';
import { useToast } from '../components/Toast.jsx';

function formatBytes(value) {
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function readVideoLinks(value) {
  return (String(value || '').match(/https:\/\/[^\s,]+/gi) || [])
    .map((url) => url.replace(/[)\]}>.,;]+$/g, ''))
    .filter(Boolean);
}

function createLinkPreview(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }
  const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
  const tiktokHost = hostname === 'tiktok.com' || hostname.endsWith('.tiktok.com');
  const youtubeHost = hostname === 'youtube.com' || hostname.endsWith('.youtube.com') || hostname === 'youtu.be';
  if (parsed.protocol !== 'https:' || (!tiktokHost && !youtubeHost)) return null;

  if (tiktokHost) {
    const videoId = parsed.pathname.match(/\/video\/(\d+)/)?.[1];
    const creator = decodeURIComponent(parsed.pathname.match(/\/@([^/]+)/)?.[1] || 'TikTok video');
    return {
      id: `tiktok-${videoId || parsed.href}`,
      url: parsed.href,
      platform: 'TikTok',
      label: creator.startsWith('@') ? creator : `@${creator}`,
      embedUrl: videoId ? `https://www.tiktok.com/player/v1/${videoId}?controls=1&description=1&music_info=1&autoplay=0` : null,
    };
  }

  const videoId = hostname === 'youtu.be'
    ? parsed.pathname.split('/').filter(Boolean)[0]
    : (parsed.pathname.match(/\/(?:shorts|embed)\/([^/?]+)/)?.[1] || parsed.searchParams.get('v'));
  return {
    id: `youtube-${videoId || parsed.href}`,
    url: parsed.href,
    platform: 'YouTube',
    label: 'YouTube Short',
    embedUrl: videoId ? `https://www.youtube.com/embed/${encodeURIComponent(videoId)}` : null,
  };
}

export function VideoCompiler() {
  const [files, setFiles] = useState([]);
  const [combining, setCombining] = useState(false);
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState(null);
  const [confirmCost, setConfirmCost] = useState(false);
  const [confirmRights, setConfirmRights] = useState(false);
  const [uploadingPack, setUploadingPack] = useState(null);
  const [uploadedPacks, setUploadedPacks] = useState({});
  const [linkUrl, setLinkUrl] = useState('');
  const [linkRights, setLinkRights] = useState(false);
  const [importingLink, setImportingLink] = useState(false);
  const [previewText, setPreviewText] = useState('');
  const [linkPreviews, setLinkPreviews] = useState([]);
  const [importProgress, setImportProgress] = useState(null);
  const [youtubeKey, setYoutubeKey] = useState('');
  const [savingYoutubeKey, setSavingYoutubeKey] = useState(false);
  const [shortsQuery, setShortsQuery] = useState('funny memes');
  const [searchingShorts, setSearchingShorts] = useState(false);
  const loadedJobRef = useRef(null);
  const { push } = useToast();
  const totalBytes = useMemo(() => files.reduce((sum, file) => sum + file.size, 0), [files]);

  useEffect(() => {
    fetch('/api/shorts/upload/status')
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Uploader status unavailable.');
        setStatus(data);
      })
      .catch((error) => push(error.message, 'error'));
  }, [push]);

  useEffect(() => {
    const jobId = new URLSearchParams(window.location.search).get('job');
    if (!jobId || !/^[0-9a-f-]{36}$/i.test(jobId)) return;
    if (loadedJobRef.current === jobId) return;
    loadedJobRef.current = jobId;
    fetch(`/api/shorts/upload/combine/${jobId}/manifest.json`)
      .then(async (response) => {
        const manifest = await response.json();
        if (!response.ok) throw new Error(manifest.error || 'Could not load that saved video-pack job.');
        const baseUrl = `/api/shorts/upload/combine/${jobId}`;
        setResult({
          ...manifest,
          downloadUrl: `${baseUrl}/manifest.json`,
          packs: (manifest.packs || []).map((pack) => ({ ...pack, downloadUrl: `${baseUrl}/${pack.file}` })),
        });
        push(`Loaded ${manifest.packs?.length || 0} saved API-ready packs.`);
      })
      .catch((error) => push(error.message, 'error'));
  }, [push]);

  function addFiles(selected) {
    const selectedFiles = Array.from(selected || []);
    setFiles((current) => [...current, ...selectedFiles].slice(0, 60));
    setResult(null);
  }

  function move(index, direction) {
    setFiles((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function fetchVideoFile(url) {
    const response = await fetch('/api/shorts/upload/import-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, confirmRights: true }),
    });
    if (!response.ok) {
      const contentType = response.headers.get('content-type') || '';
      const data = contentType.includes('application/json') ? await response.json() : null;
      throw new Error(data?.error || 'Could not download that video link.');
    }
    const blob = await response.blob();
    const disposition = response.headers.get('content-disposition') || '';
    const encodedName = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
    const basicName = disposition.match(/filename="?([^";]+)"?/i)?.[1];
    const filename = encodedName ? decodeURIComponent(encodedName) : (basicName || `imported-video-${Date.now()}.mp4`);
    return new File([blob], filename, { type: 'video/mp4', lastModified: Date.now() });
  }

  async function importVideoLink(addToClipList) {
    if (!linkUrl.trim() || !linkRights || importingLink) return;
    if (addToClipList && files.length >= 60) {
      push('This batch already has 60 clips. Create the packs, then start another batch.', 'error');
      return;
    }
    setImportingLink(true);
    try {
      const file = await fetchVideoFile(linkUrl.trim());
      if (addToClipList) {
        addFiles([file]);
      } else {
        const objectUrl = URL.createObjectURL(file);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = file.name;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
      }
      setLinkUrl('');
      push(addToClipList ? 'Downloaded the video and added it to your numbered clip list.' : 'Video download started.');
    } catch (error) {
      push(error.message, 'error');
    } finally {
      setImportingLink(false);
    }
  }

  function loadLinkPreviews() {
    const previews = readVideoLinks(previewText).map(createLinkPreview).filter(Boolean);
    if (previews.length === 0) {
      push('Paste at least one full TikTok or YouTube Shorts link.', 'error');
      return;
    }
    setLinkPreviews((current) => {
      const known = new Set(current.map((item) => item.url));
      const added = previews.filter((item) => !known.has(item.url)).slice(0, Math.max(0, 20 - current.length));
      return [...current, ...added.map((item) => ({ ...item, selected: true }))];
    });
    setPreviewText('');
  }

  async function saveYoutubeApiKey(event) {
    event.preventDefault();
    if (youtubeKey.trim().length < 20 || savingYoutubeKey) return;
    setSavingYoutubeKey(true);
    try {
      const response = await fetch('/api/shorts/upload/youtube/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: youtubeKey.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save the YouTube API key.');
      setStatus((current) => ({ ...current, youtubeSearch: data.youtubeSearch }));
      setYoutubeKey('');
      push('YouTube Shorts search is connected.');
    } catch (error) {
      push(error.message, 'error');
    } finally {
      setSavingYoutubeKey(false);
    }
  }

  async function findRandomShorts(event) {
    event.preventDefault();
    if (!status?.youtubeSearch?.configured || !shortsQuery.trim() || searchingShorts) return;
    setSearchingShorts(true);
    try {
      const response = await fetch('/api/shorts/upload/youtube/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: shortsQuery.trim(), limit: Math.max(1, 20 - linkPreviews.length) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'YouTube Shorts search failed.');
      const found = (data.videos || []).map((video) => ({
        ...createLinkPreview(video.url),
        id: `youtube-${video.id}`,
        label: video.title,
        creator: video.channel,
        thumbnail: video.thumbnail,
        duration: video.duration,
        selected: true,
      }));
      setLinkPreviews((current) => {
        const known = new Set(current.map((item) => item.url));
        return [...current, ...found.filter((item) => item?.url && !known.has(item.url))].slice(0, 20);
      });
      push(found.length ? `Found ${found.length} random Shorts. Preview them and choose the ones you have permission to use.` : 'No matching Shorts were found. Try a different search.', found.length ? 'success' : 'error');
    } catch (error) {
      push(error.message, 'error');
    } finally {
      setSearchingShorts(false);
    }
  }

  async function importSelectedPreviews() {
    const selected = linkPreviews.filter((item) => item.selected);
    const availableSlots = Math.max(0, 60 - files.length);
    if (!linkRights || selected.length === 0 || importingLink) return;
    if (selected.length > availableSlots) {
      push(`Only ${availableSlots} more clips fit in this batch.`, 'error');
      return;
    }

    setImportingLink(true);
    const downloaded = [];
    const failed = [];
    for (let index = 0; index < selected.length; index += 1) {
      const item = selected[index];
      setImportProgress({ current: index + 1, total: selected.length });
      try {
        downloaded.push(await fetchVideoFile(item.url));
      } catch (error) {
        failed.push({ url: item.url, message: error.message });
      }
    }
    if (downloaded.length) {
      addFiles(downloaded);
      const completed = new Set(selected.filter((item) => !failed.some((failure) => failure.url === item.url)).map((item) => item.url));
      setLinkPreviews((current) => current.filter((item) => !completed.has(item.url)));
    }
    if (failed.length) push(`${failed.length} video${failed.length === 1 ? '' : 's'} could not be downloaded. The others were added.`, 'error');
    else push(`Added ${downloaded.length} selected video${downloaded.length === 1 ? '' : 's'} to the clip list.`);
    setImportProgress(null);
    setImportingLink(false);
  }

  async function submit(event) {
    event.preventDefault();
    if (files.length === 0 || combining) return;
    setCombining(true);
    setResult(null);
    const body = new FormData();
    files.forEach((file) => body.append('videos', file));
    try {
      const response = await fetch('/api/shorts/upload/combine', { method: 'POST', body });
      const contentType = response.headers.get('content-type') || '';
      const data = contentType.includes('application/json')
        ? await response.json()
        : { error: `The combiner server returned an unexpected response (${response.status}). Restart the localhost server and try again.` };
      if (!response.ok) throw new Error(data.error || 'Could not combine the videos.');
      setResult(data.manifest);
      push(`Created ${data.manifest.packs.length} Roblox-ready video pack${data.manifest.packs.length === 1 ? '' : 's'}.`);
    } catch (error) {
      push(error.message, 'error');
    } finally {
      setCombining(false);
    }
  }

  async function uploadPack(pack, index) {
    if (!status?.videoUpload?.configured || !confirmCost || !confirmRights || uploadingPack) return;
    const accepted = window.confirm(`Upload Pack ${index + 1} to Roblox now? This will spend 2,000 Robux and cannot be undone.`);
    if (!accepted) return;
    setUploadingPack(pack.file);
    try {
      const response = await fetch(`/api/shorts/upload/combine/${result.jobId}/${pack.file}/roblox-upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmCost: true,
          confirmRights: true,
          expectedPrice: 2000,
          displayName: `Shorts Pack ${String(index + 1).padStart(3, '0')}`,
        }),
      });
      const contentType = response.headers.get('content-type') || '';
      const data = contentType.includes('application/json')
        ? await response.json()
        : { error: `Roblox upload returned an unexpected response (${response.status}).` };
      if (!response.ok) throw new Error(data.error || 'Roblox video upload failed.');
      setUploadedPacks((current) => ({ ...current, [pack.file]: data }));
      push(`Pack ${index + 1} uploaded as Roblox asset ${data.assetId}.`);
    } catch (error) {
      push(error.message, 'error');
    } finally {
      setUploadingPack(null);
    }
  }

  return (
    <div>
      <PageTitle eyebrow="Roblox VideoFrame" title="Combine shorts into video packs">
        Choose your clips in playback order. RoTools keeps their audio, converts them to vertical 1080p, and automatically creates Open Cloud-ready packs under five minutes and 20 MB.
      </PageTitle>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <Card className="p-5 md:p-7">
          <form className="mb-5 rounded-2xl border border-neon/20 bg-neon/[.04] p-4" onSubmit={(event) => { event.preventDefault(); importVideoLink(true); }}>
            <div className="flex items-center gap-2 font-bold"><Link2 className="text-neon" size={18} /> Download my video from a link</div>
            <p className="mt-1 text-xs leading-5 text-slate-400">Paste a public TikTok or YouTube Shorts link. Save the MP4 only, or download it and add it straight to the clip list.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
              <input className="field min-w-0 flex-1" type="url" placeholder="https://www.tiktok.com/@you/video/..." value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} />
              <button className="btn btn-ghost shrink-0" type="button" disabled={!linkUrl.trim() || !linkRights || importingLink} onClick={() => importVideoLink(false)}>
                {importingLink ? <LoaderCircle className="animate-spin" size={17} /> : <Download size={17} />} Download only
              </button>
              <button className="btn btn-primary shrink-0" type="submit" disabled={!linkUrl.trim() || !linkRights || importingLink || files.length >= 60}>
                {importingLink ? <LoaderCircle className="animate-spin" size={17} /> : <Files size={17} />} Download + add
              </button>
            </div>
            <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs leading-5 text-slate-300">
              <input className="mt-1" type="checkbox" checked={linkRights} onChange={(event) => setLinkRights(event.target.checked)} />
              <span>I own this video or have permission from its creator to download and use it.</span>
            </label>
          </form>

          <section className="mb-5 rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-center gap-2 font-bold"><Eye className="text-neon" size={18} /> Preview and choose several links</div>
            <p className="mt-1 text-xs leading-5 text-slate-400">Paste up to 20 TikTok or YouTube Shorts links, one per line. Watch them here, untick the ones you do not want, then add the selected videos together.</p>

            <div className="mt-4 rounded-xl border border-neon/20 bg-neon/[.04] p-3">
              <div className="flex items-center gap-2 text-sm font-bold"><Shuffle className="text-neon" size={17} /> Find random YouTube Shorts</div>
              {status?.youtubeSearch?.configured ? (
                <form className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]" onSubmit={findRandomShorts}>
                  <input className="field min-w-0" value={shortsQuery} maxLength={80} placeholder="funny, memes, brainrot..." onChange={(event) => setShortsQuery(event.target.value)} />
                  <button className="btn btn-primary" type="submit" disabled={!shortsQuery.trim() || searchingShorts || linkPreviews.length >= 20}>
                    {searchingShorts ? <LoaderCircle className="animate-spin" size={17} /> : <Search size={17} />} {searchingShorts ? 'Searching...' : 'Find random Shorts'}
                  </button>
                </form>
              ) : (
                <form className="mt-3" onSubmit={saveYoutubeApiKey}>
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <input className="field min-w-0" type="password" autoComplete="new-password" spellCheck="false" value={youtubeKey} placeholder="Paste YouTube Data API key" onChange={(event) => setYoutubeKey(event.target.value)} />
                    <button className="btn btn-primary" type="submit" disabled={youtubeKey.trim().length < 20 || savingYoutubeKey}>
                      {savingYoutubeKey ? <LoaderCircle className="animate-spin" size={17} /> : <KeyRound size={17} />} {savingYoutubeKey ? 'Saving...' : 'Save key securely'}
                    </button>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-400">Enable <strong className="text-white">YouTube Data API v3</strong> in Google Cloud, create an API key, and restrict it to that API. The key is saved only in this computer’s private .env file. <a className="text-neon hover:underline" href="https://console.cloud.google.com/apis/library/youtube.googleapis.com" target="_blank" rel="noreferrer">Open Google Cloud</a></p>
                </form>
              )}
            </div>

            <textarea className="field mt-3 min-h-24 w-full resize-y" placeholder={'https://www.tiktok.com/@friend/video/...\nhttps://www.youtube.com/shorts/...'} value={previewText} onChange={(event) => setPreviewText(event.target.value)} />
            <button className="btn btn-ghost mt-2" type="button" disabled={!previewText.trim() || importingLink || linkPreviews.length >= 20} onClick={loadLinkPreviews}>
              <Eye size={17} /> Load previews
            </button>

            {linkPreviews.length > 0 && (
              <div className="mt-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                  <span>{linkPreviews.filter((item) => item.selected).length} of {linkPreviews.length} selected</span>
                  <div className="flex gap-2">
                    <button className="btn btn-ghost !px-3 !py-1.5" type="button" onClick={() => setLinkPreviews((current) => current.map((item) => ({ ...item, selected: true })))}>Select all</button>
                    <button className="btn btn-ghost !px-3 !py-1.5" type="button" onClick={() => setLinkPreviews((current) => current.map((item) => ({ ...item, selected: false })))}>Clear</button>
                  </div>
                </div>
                <div className="grid max-h-[38rem] grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3">
                  {linkPreviews.map((item) => (
                    <article className={`overflow-hidden rounded-xl border transition ${item.selected ? 'border-neon/60 bg-neon/[.06]' : 'border-white/10 bg-white/[.02] opacity-65'}`} key={item.url}>
                      <div className="relative aspect-[9/16] bg-black">
                        {item.embedUrl ? (
                          <iframe className="h-full w-full" src={item.embedUrl} title={`${item.platform} preview`} allow="encrypted-media; picture-in-picture" allowFullScreen loading="lazy" />
                        ) : (
                          <a className="grid h-full place-items-center p-4 text-center text-sm text-neon" href={item.url} target="_blank" rel="noreferrer">Open this shortened link to preview it</a>
                        )}
                        <button className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/80 text-white hover:bg-pink-500" type="button" title="Remove preview" onClick={() => setLinkPreviews((current) => current.filter((preview) => preview.url !== item.url))}><X size={16} /></button>
                      </div>
                      <label className="flex cursor-pointer items-center gap-2 p-3 text-sm font-semibold">
                        <input type="checkbox" checked={item.selected} onChange={() => setLinkPreviews((current) => current.map((preview) => preview.url === item.url ? { ...preview, selected: !preview.selected } : preview))} />
                        <span className="min-w-0"><span className="block truncate">{item.label}</span><span className="block truncate text-xs font-normal text-slate-500">{item.creator ? `${item.creator} · ` : ''}{item.duration ? `${item.duration}s · ` : ''}{item.platform}</span></span>
                      </label>
                    </article>
                  ))}
                </div>
                <button className="btn btn-primary mt-4 w-full" type="button" disabled={!linkRights || importingLink || !linkPreviews.some((item) => item.selected) || files.length + linkPreviews.filter((item) => item.selected).length > 60} onClick={importSelectedPreviews}>
                  {importingLink ? <LoaderCircle className="animate-spin" size={17} /> : <ListPlus size={17} />}
                  {importProgress ? `Downloading ${importProgress.current} of ${importProgress.total}...` : 'Download + add selected'}
                </button>
                {!linkRights && <p className="mt-2 text-center text-xs text-amber-200">Tick the permission box above before downloading.</p>}
              </div>
            )}
          </section>
          <form className="space-y-5" onSubmit={submit}>
            <label className="group grid min-h-44 cursor-pointer place-items-center rounded-2xl border border-dashed border-white/20 bg-black/20 p-6 text-center transition hover:border-neon/60 hover:bg-neon/[.04]">
              <span>
                <Files className="mx-auto mb-3 text-neon" size={38} />
                <span className="block text-lg font-bold">Choose multiple videos</span>
                <span className="mt-1 block text-sm text-slate-400">MP4, MOV, WebM, or MKV · up to 60 clips</span>
              </span>
              <input className="hidden" type="file" multiple accept="video/mp4,video/quicktime,video/webm,video/x-matroska" onChange={(event) => { addFiles(event.target.files); event.target.value = ''; }} />
            </label>

            {files.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-white/10">
                <div className="flex items-center justify-between bg-white/[.04] px-4 py-3 text-sm">
                  <strong>{files.length} clip{files.length === 1 ? '' : 's'}</strong>
                  <span className="text-slate-400">{formatBytes(totalBytes)}</span>
                </div>
                <ol className="max-h-80 divide-y divide-white/5 overflow-y-auto">
                  {files.map((file, index) => (
                    <li className="flex items-center gap-3 px-3 py-3" key={`${file.name}-${file.size}-${file.lastModified}-${index}`}>
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/5 text-xs font-bold text-slate-400">{index + 1}</span>
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{file.name}</span><span className="text-xs text-slate-500">{formatBytes(file.size)}</span></span>
                      <button className="btn btn-ghost !p-2" type="button" title="Move up" disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={15} /></button>
                      <button className="btn btn-ghost !p-2" type="button" title="Move down" disabled={index === files.length - 1} onClick={() => move(index, 1)}><ArrowDown size={15} /></button>
                      <button className="btn btn-ghost !p-2 text-pink-300" type="button" title="Remove" onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={15} /></button>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <button className="btn btn-primary w-full py-3" disabled={files.length === 0 || combining} type="submit">
              <Film size={18} /> {combining ? 'Combining and converting…' : 'Create Roblox video packs'}
            </button>
            <p className="text-center text-xs leading-5 text-slate-500">Processing can take several minutes. Nothing is uploaded to Roblox and no Robux is spent.</p>
          </form>
        </Card>

        <div className="space-y-5">
          <Card className="p-5">
            <h2 className="text-xl font-bold">Output settings</h2>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-white/5 p-3"><dt className="text-slate-500">Resolution</dt><dd className="mt-1 font-bold">1080×1920</dd></div>
              <div className="rounded-lg bg-white/5 p-3"><dt className="text-slate-500">Frame rate</dt><dd className="mt-1 font-bold">30 FPS</dd></div>
              <div className="rounded-lg bg-white/5 p-3"><dt className="text-slate-500">Video</dt><dd className="mt-1 font-bold">H.264 MP4</dd></div>
              <div className="rounded-lg bg-white/5 p-3"><dt className="text-slate-500">Audio</dt><dd className="mt-1 font-bold">AAC stereo</dd></div>
            </dl>
            <p className="mt-4 text-xs leading-5 text-slate-400">Clips are fitted inside a vertical canvas without stretching. Packs split automatically before either five minutes or the 20 MB Open Cloud upload limit.</p>
          </Card>

          {result && (
            <Card className="border-mint/30 p-5">
              <div className="flex items-center gap-2 font-bold text-mint"><CheckCircle2 size={20} /> Packs ready</div>
              <div className="mt-4 space-y-3">
                {result.packs.map((pack, index) => (
                  <div className="rounded-xl border border-white/10 bg-white/[.025] p-3" key={pack.file}>
                    <a className="btn btn-ghost flex w-full justify-between" href={pack.downloadUrl} download>
                      <span className="flex items-center gap-2"><Download size={16} /> Pack {index + 1}</span>
                      <span className="text-xs text-slate-400">{pack.clips.length} clips · {pack.duration.toFixed(1)}s{pack.sizeBytes ? ` · ${formatBytes(pack.sizeBytes)}` : ''}</span>
                    </a>
                    {uploadedPacks[pack.file] ? (
                      <div className="mt-2 rounded-lg bg-mint/10 p-3 text-sm text-mint">
                        <div className="flex items-center gap-2 font-bold"><CheckCircle2 size={16} /> Roblox asset {uploadedPacks[pack.file].assetId}</div>
                        <p className="mt-1 text-xs text-mint/75">Waiting for Roblox moderation before it can play.</p>
                      </div>
                    ) : (
                      <button className="btn mt-2 w-full border-amber-300/30 bg-amber-300/10 text-amber-100 hover:bg-amber-300/20" type="button" disabled={!status?.videoUpload?.configured || !confirmCost || !confirmRights || Boolean(uploadingPack)} onClick={() => uploadPack(pack, index)}>
                        <CloudUpload size={16} /> {uploadingPack === pack.file ? 'Uploading to Roblox…' : 'Upload to Roblox · 2,000 Robux'}
                      </button>
                    )}
                  </div>
                ))}
                <a className="btn btn-ghost w-full" href={result.downloadUrl} download><Download size={16} /> Download timestamp map</a>
              </div>
              <div className="mt-4 space-y-3 rounded-xl border border-amber-300/20 bg-amber-300/[.07] p-4 text-sm">
                <div className="flex items-center gap-2 font-bold text-amber-100"><Coins size={17} /> Paid Roblox upload</div>
                {!status?.videoUpload?.configured && <p className="text-xs leading-5 text-amber-100/75">First save an Assets Read + Write API key on the Video Upload page.</p>}
                <label className="flex cursor-pointer items-start gap-3 text-xs leading-5 text-slate-300"><input className="mt-1" type="checkbox" checked={confirmRights} onChange={(event) => setConfirmRights(event.target.checked)} /><span>I own or have permission to upload every clip and its audio.</span></label>
                <label className="flex cursor-pointer items-start gap-3 text-xs leading-5 text-slate-300"><input className="mt-1" type="checkbox" checked={confirmCost} onChange={(event) => setConfirmCost(event.target.checked)} /><span>I understand that <strong className="text-white">each pack costs 2,000 Robux</strong> and rejected videos may still count as an upload.</span></label>
                {status?.videoUpload?.configured && <div className="flex items-center gap-2 text-xs text-mint"><ShieldCheck size={15} /> Connected to {status.videoUpload.creatorType === 'groupId' ? 'group' : 'user'} {status.videoUpload.creatorId}</div>}
              </div>
              <p className="mt-4 text-xs leading-5 text-slate-400">Keep the timestamp JSON file—it tells the game where every short begins and ends.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
