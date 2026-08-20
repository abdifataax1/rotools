import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Film, KeyRound, Music2, Save, ShieldCheck, UploadCloud } from 'lucide-react';
import { Card, PageTitle } from '../components/Card.jsx';
import { useToast } from '../components/Toast.jsx';

function makeVideoId(name) {
  return String(name || 'new-video')
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'new-video';
}

function formatBytes(value) {
  if (!Number.isFinite(value)) return '';
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

export function ShortsUploader() {
  const [file, setFile] = useState(null);
  const [videoId, setVideoId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [audioMode, setAudioMode] = useState('automatic');
  const [audioAssetId, setAudioAssetId] = useState('');
  const [status, setStatus] = useState(null);
  const [apiKey, setApiKey] = useState('');
  const [creatorType, setCreatorType] = useState('user');
  const [creatorId, setCreatorId] = useState('515567637');
  const [savingConfig, setSavingConfig] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const { push } = useToast();

  useEffect(() => {
    fetch('/api/shorts/upload/status')
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Uploader status unavailable.');
        setStatus(data);
        if (data.audioUpload?.creatorId) setCreatorId(data.audioUpload.creatorId);
        if (data.audioUpload?.creatorType === 'groupId') setCreatorType('group');
      })
      .catch((error) => push(error.message, 'error'));
  }, [push]);

  const canUpload = useMemo(() => {
    if (!file || !/^[A-Za-z0-9_-]{1,64}$/.test(videoId) || uploading) return false;
    if (audioMode === 'automatic') return status?.audioUpload?.configured === true;
    if (audioMode === 'existing') return /^(?:rbxassetid:\/\/)?\d+$/.test(audioAssetId.trim());
    return true;
  }, [file, videoId, uploading, audioMode, audioAssetId, status]);

  function chooseFile(nextFile) {
    setFile(nextFile || null);
    setResult(null);
    if (nextFile) {
      const nextId = makeVideoId(nextFile.name);
      setVideoId(nextId);
      setDisplayName(nextId.replace(/[-_]+/g, ' '));
    }
  }

  async function saveApiConfig(event) {
    event.preventDefault();
    setSavingConfig(true);
    try {
      const response = await fetch('/api/shorts/upload/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, creatorType, creatorId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save Roblox setup.');
      setStatus((old) => ({ ...old, audioUpload: data.audioUpload }));
      setApiKey('');
      push('Roblox audio uploads are connected.');
    } catch (error) {
      push(error.message, 'error');
    } finally {
      setSavingConfig(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    if (!canUpload) return;
    setUploading(true);
    setResult(null);
    const body = new FormData();
    body.append('video', file);
    body.append('id', videoId);
    body.append('displayName', displayName || videoId);
    body.append('audioMode', audioMode);
    if (audioMode === 'existing') body.append('audioAssetId', audioAssetId);
    try {
      const response = await fetch('/api/shorts/upload', { method: 'POST', body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Upload failed.');
      setResult(data);
      push('Short added to the Roblox feed.');
    } catch (error) {
      push(error.message, 'error');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <PageTitle eyebrow="Roblox Shorts" title="Upload a video to your feed">
        Choose one local video. RoTools converts it for Roblox and can automatically extract and upload its audio without exposing your API key to the browser.
      </PageTitle>

      <Card className="mb-5 overflow-hidden">
        <div className="border-b border-white/10 bg-white/[.03] p-5 md:flex md:items-center md:justify-between md:px-7">
          <div className="flex items-center gap-3">
            <span className={`grid h-10 w-10 place-items-center rounded-xl ${status?.audioUpload?.configured ? 'bg-mint/15 text-mint' : 'bg-neon/15 text-neon'}`}><ShieldCheck size={21} /></span>
            <div><h2 className="font-bold">Connect Roblox audio uploads</h2><p className="mt-1 text-xs text-slate-400">Saved only to this computer’s private .env file—not browser storage.</p></div>
          </div>
          {status?.audioUpload?.configured && <span className="mt-3 inline-flex items-center gap-2 rounded-full bg-mint/10 px-3 py-1 text-xs font-bold text-mint md:mt-0"><CheckCircle2 size={14} /> Connected</span>}
        </div>
        <form className="grid gap-4 p-5 md:grid-cols-[1.35fr_.65fr_.7fr_auto] md:items-end md:px-7" onSubmit={saveApiConfig}>
          <label className="text-sm font-semibold text-slate-200">Roblox API key
            <input className="field mt-2" type="password" autoComplete="new-password" spellCheck="false" value={apiKey} placeholder={status?.audioUpload?.configured ? 'Paste a new key only to replace it' : 'Paste generated key'} onChange={(event) => setApiKey(event.target.value)} />
          </label>
          <label className="text-sm font-semibold text-slate-200">Creator type
            <select className="field mt-2" value={creatorType} onChange={(event) => setCreatorType(event.target.value)}>
              <option value="user">Personal account</option>
              <option value="group">Group</option>
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-200">{creatorType === 'group' ? 'Group ID' : 'User ID'}
            <input className="field mt-2" inputMode="numeric" value={creatorId} placeholder="Numbers only" onChange={(event) => setCreatorId(event.target.value.replace(/\D/g, ''))} />
          </label>
          <button className="btn btn-primary h-[38px]" type="submit" disabled={savingConfig || apiKey.trim().length < 20 || !creatorId}>
            <Save size={16} /> {savingConfig ? 'Saving…' : 'Save securely'}
          </button>
        </form>
        <div className="border-t border-white/10 px-5 py-3 text-xs leading-5 text-slate-400 md:px-7">
          In Roblox Creator Dashboard choose <strong className="text-white">Select API System → assets</strong>, then enable <strong className="text-white">Read + Write</strong>. Do not choose asset-permissions.
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <Card className="p-5 md:p-7">
          <form onSubmit={submit} className="space-y-5">
            <label className="group grid min-h-48 cursor-pointer place-items-center rounded-2xl border border-dashed border-white/20 bg-black/20 p-6 text-center transition hover:border-neon/60 hover:bg-neon/[.04]">
              <span>
                <UploadCloud className="mx-auto mb-3 text-neon" size={38} />
                <span className="block text-lg font-bold">{file ? file.name : 'Choose a video'}</span>
                <span className="mt-1 block text-sm text-slate-400">{file ? formatBytes(file.size) : 'MP4, MOV, WebM, or MKV · up to 250 MB'}</span>
              </span>
              <input className="hidden" type="file" accept="video/mp4,video/quicktime,video/webm,video/x-matroska" onChange={(event) => chooseFile(event.target.files?.[0])} />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm font-semibold text-slate-200">Video ID
                <input className="field mt-2" value={videoId} maxLength={64} placeholder="my-first-video" onChange={(event) => setVideoId(event.target.value)} />
              </label>
              <label className="text-sm font-semibold text-slate-200">Audio name on Roblox
                <input className="field mt-2" value={displayName} maxLength={50} placeholder="My first video" onChange={(event) => setDisplayName(event.target.value)} />
              </label>
            </div>

            <fieldset>
              <legend className="mb-3 text-sm font-semibold text-slate-200">Audio</legend>
              <div className="grid gap-3 md:grid-cols-3">
                {[
                  ['automatic', 'Automatic', 'Extract and upload through Open Cloud'],
                  ['existing', 'Existing ID', 'Use audio you already uploaded'],
                  ['silent', 'No audio', 'Add only the video frames'],
                ].map(([value, label, detail]) => (
                  <label key={value} className={`cursor-pointer rounded-xl border p-4 transition ${audioMode === value ? 'border-neon/70 bg-neon/10' : 'border-white/10 bg-white/[.03] hover:border-white/20'}`}>
                    <span className="flex items-center gap-2 font-bold"><input type="radio" name="audioMode" value={value} checked={audioMode === value} onChange={() => setAudioMode(value)} /> {label}</span>
                    <span className="mt-2 block text-xs leading-5 text-slate-400">{detail}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {audioMode === 'existing' && <label className="block text-sm font-semibold text-slate-200">Roblox audio asset ID
              <input className="field mt-2" value={audioAssetId} placeholder="1234567890" onChange={(event) => setAudioAssetId(event.target.value)} />
            </label>}

            {audioMode === 'automatic' && status && !status.audioUpload.configured && (
              <div className="rounded-xl border border-amber-300/25 bg-amber-300/10 p-4 text-sm text-amber-100">
                <div className="flex items-center gap-2 font-bold"><KeyRound size={17} /> Open Cloud setup needed</div>
                <p className="mt-2 text-amber-100/75">Create a Roblox key with the assets API and Read + Write operations, then save it in the secure form above. The key stays on this computer.</p>
              </div>
            )}

            <button className="btn btn-primary w-full py-3" disabled={!canUpload} type="submit">
              <Film size={18} /> {uploading ? 'Extracting audio and processing video…' : 'Upload video'}
            </button>
          </form>
        </Card>

        <div className="space-y-5">
          <Card className="p-5">
            <div className="flex items-center gap-3"><Music2 className="text-mint" /><h2 className="text-xl font-bold">How audio works</h2></div>
            <ol className="mt-4 space-y-3 text-sm text-slate-300">
              <li><span className="mr-2 font-bold text-neon">1.</span>Audio is extracted from the first 20 seconds.</li>
              <li><span className="mr-2 font-bold text-neon">2.</span>The server uploads it privately to your Roblox creator.</li>
              <li><span className="mr-2 font-bold text-neon">3.</span>The returned asset ID is saved with the processed video.</li>
            </ol>
            <p className="mt-4 rounded-lg bg-white/5 p-3 text-xs leading-5 text-slate-400">Automatic uploads use the Open Cloud quota: 100 audio uploads/month for ID-verified creators. The 2,000/month allowance applies to normal Creator Dashboard or Asset Manager imports.</p>
          </Card>

          {result && <Card className="border-mint/30 p-5">
            <div className="flex items-center gap-2 font-bold text-mint"><CheckCircle2 size={20} /> Added successfully</div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-slate-500">Video ID</dt><dd className="mt-1 font-semibold">{result.metadata.id}</dd></div>
              <div><dt className="text-slate-500">Resolution</dt><dd className="mt-1 font-semibold">{result.metadata.width}×{result.metadata.height}</dd></div>
              <div><dt className="text-slate-500">FPS</dt><dd className="mt-1 font-semibold">{result.metadata.fps}</dd></div>
              <div><dt className="text-slate-500">Audio asset</dt><dd className="mt-1 break-all font-semibold">{result.metadata.audioAssetId || 'Silent'}</dd></div>
            </dl>
            <p className="mt-4 text-xs text-slate-400">New Roblox audio may remain silent until moderation finishes and the experience has permission to use it.</p>
          </Card>}
        </div>
      </div>
    </div>
  );
}
