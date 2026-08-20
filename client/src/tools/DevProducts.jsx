import React, { useEffect, useState } from 'react';
import { Copy, Download, Play, Plus, Trash2, Upload } from 'lucide-react';
import { Card, PageTitle } from '../components/Card.jsx';
import { fromCsv, toCsv } from '../utils/csv.js';
import { downloadText, loadLocal, readFileText, saveLocal } from '../utils/storage.js';
import { luaMapping, sampleProducts, validateProducts } from '../utils/products.js';
import { useToast } from '../components/Toast.jsx';

const fields = ['internalKey', 'name', 'description', 'robuxPrice', 'rewardType', 'rewardItem', 'rewardAmount', 'productId', 'status', 'error'];

export function DevProducts() {
  const [products, setProducts] = useState(() => loadLocal('rbx.products', sampleProducts));
  const [universeId, setUniverseId] = useState(() => loadLocal('rbx.universeId', ''));
  const [dryRun, setDryRun] = useState(true);
  const [delayMs, setDelayMs] = useState(650);
  const [loading, setLoading] = useState(false);
  const { push } = useToast();
  useEffect(() => saveLocal('rbx.products', products), [products]);
  useEffect(() => saveLocal('rbx.universeId', universeId), [universeId]);
  const setField = (index, key, value) => setProducts((old) => old.map((p, i) => i === index ? { ...p, [key]: value } : p));
  async function importFile(file, type) {
    const text = await readFileText(file);
    setProducts(type === 'csv' ? fromCsv(text) : JSON.parse(text));
    push('Products imported.');
  }
  async function createProducts(retryOnly = false) {
    const validated = validateProducts(retryOnly ? products.filter((p) => p.status === 'failed') : products);
    if (!universeId) return push('Universe ID is required.', 'error');
    if (validated.some((p) => p.error)) return setProducts(validateProducts(products));
    setLoading(true);
    try {
      const res = await fetch('/api/devproducts/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ universeId, dryRun, delayMs: Number(delayMs), products: validated }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      setProducts((old) => old.map((p) => data.results.find((r) => r.internalKey === p.internalKey) || p));
      push(dryRun ? 'Dry run completed.' : 'Product creation completed.');
    } catch (error) {
      push(error.message, 'error');
    } finally {
      setLoading(false);
    }
  }
  return (
    <div>
      <PageTitle eyebrow="Bulk Developer Products" title="Create product tables with backend-safe Open Cloud calls">Validate, dry run, create, retry, and export Lua reward mappings without exposing your API key.</PageTitle>
      <Card className="mb-4 p-4"><div className="grid gap-3 lg:grid-cols-[1fr_auto_auto_auto]"><input className="field" placeholder="Universe ID" value={universeId} onChange={(e) => setUniverseId(e.target.value)} /><label className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm"><input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} /> Dry run</label><input className="field w-44" type="number" min="0" value={delayMs} onChange={(e) => setDelayMs(e.target.value)} placeholder="Delay ms" /><button className="btn-primary" disabled={loading} onClick={() => createProducts(false)}><Play size={16} /> Create products</button></div></Card>
      <div className="mb-4 flex flex-wrap gap-2"><button className="btn-ghost" onClick={() => setProducts([...products, { internalKey: 'new_product', name: 'New Product', description: '', robuxPrice: 19, rewardType: 'Coins', rewardItem: 'Coins', rewardAmount: 100, productId: '', status: 'draft', error: '' }])}><Plus size={16} /> Add product</button><label className="btn-ghost cursor-pointer"><Upload size={16} /> Import CSV<input className="hidden" type="file" accept=".csv" onChange={(e) => e.target.files[0] && importFile(e.target.files[0], 'csv')} /></label><label className="btn-ghost cursor-pointer"><Upload size={16} /> Import JSON<input className="hidden" type="file" accept=".json" onChange={(e) => e.target.files[0] && importFile(e.target.files[0], 'json')} /></label><button className="btn-ghost" onClick={() => downloadText('dev-products.csv', toCsv(products), 'text/csv')}><Download size={16} /> CSV</button><button className="btn-ghost" onClick={() => downloadText('dev-products.json', JSON.stringify(products, null, 2))}>JSON</button><button className="btn-ghost" onClick={() => downloadText('ProductRewards.lua', luaMapping(products), 'text/plain')}>Lua ModuleScript</button><button className="btn-ghost" onClick={() => downloadText('product-map.json', JSON.stringify(Object.fromEntries(products.map((p) => [p.internalKey, p])), null, 2))}>JSON mapping</button><button className="btn-ghost" onClick={() => createProducts(true)}>Retry failed</button></div>
      <Card className="overflow-x-auto p-2"><table className="tool-table min-w-[1400px]"><thead><tr>{fields.map((f) => <th key={f}>{f}</th>)}<th>Actions</th></tr></thead><tbody>{products.map((p, i) => <tr key={`${p.internalKey}-${i}`}>{fields.map((f) => <td key={f}><input className={`field ${f === 'error' && p[f] ? 'border-rose/60' : ''}`} value={p[f] ?? ''} onChange={(e) => setField(i, f, e.target.value)} readOnly={f === 'error'} /></td>)}<td><div className="flex gap-2"><button className="btn-ghost px-2" onClick={() => setProducts([...products, { ...p, internalKey: `${p.internalKey}_copy` }])}><Copy size={15} /></button><button className="btn-ghost px-2 text-rose" onClick={() => setProducts(products.filter((_, x) => x !== i))}><Trash2 size={15} /></button></div></td></tr>)}</tbody></table></Card>
    </div>
  );
}
