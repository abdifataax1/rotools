import React, { useState } from 'react';
import { Download, RefreshCw, Trash2, Upload } from 'lucide-react';
import { Card, PageTitle } from '../components/Card.jsx';
import { downloadText, readFileText } from '../utils/storage.js';
import { useToast } from '../components/Toast.jsx';

export function SettingsPage() {
  const [health, setHealth] = useState('Not checked');
  const { push } = useToast();
  async function checkHealth() {
    const res = await fetch('/api/health');
    const data = await res.json();
    setHealth(data.ok ? 'Backend online' : 'Backend unavailable');
  }
  async function importWorkspace(file) {
    const data = JSON.parse(await readFileText(file));
    Object.entries(data).forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value)));
    push('Workspace imported.');
  }
  function exportWorkspace() {
    const data = {};
    Object.keys(localStorage).forEach((key) => { data[key] = JSON.parse(localStorage.getItem(key)); });
    downloadText('rotools-workspace.json', JSON.stringify(data, null, 2));
  }
  return <div><PageTitle eyebrow="Settings" title="Workspace settings">Local preferences, backend status, and app data portability.</PageTitle><Card className="p-5"><div className="grid gap-4 md:grid-cols-2"><button className="btn-ghost">Theme toggle placeholder</button><button className="btn-primary" onClick={checkHealth}><RefreshCw size={16} /> Check backend status</button><button className="btn-ghost" onClick={exportWorkspace}><Download size={16} /> Export local app data</button><label className="btn-ghost cursor-pointer"><Upload size={16} /> Import local app data<input type="file" className="hidden" accept=".json" onChange={(e) => e.target.files[0] && importWorkspace(e.target.files[0])} /></label><button className="btn-ghost text-rose" onClick={() => { localStorage.clear(); push('Local data cleared.'); }}><Trash2 size={16} /> Clear local data</button><div className="rounded-lg bg-white/5 p-3 text-sm text-slate-300">API backend status: {health}</div></div></Card></div>;
}
