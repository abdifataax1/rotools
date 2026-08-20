import React from 'react';
import { ArrowRight, Box, CheckCircle2, Download, FileJson, PackagePlus, Sparkles, Upload } from 'lucide-react';
import { useRouter } from '../utils/router.jsx';
import { Card } from '../components/Card.jsx';

const featureCards = [
  ['Bulk Dev Products', PackagePlus, 'Validate product tables, dry run requests, create products through the backend, and export reward mappings.'],
  ['3D Icon Generator', Box, 'Render model icons with transparent PNG export, adjustable camera, lighting, and clean outlines.']
];

export function Landing() {
  const { setRoute } = useRouter();
  return (
    <div>
      <section className="relative mx-auto grid min-h-[calc(100vh-64px)] max-w-7xl items-center gap-10 px-4 py-16 lg:grid-cols-[1.05fr_.95fr]">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-neon/30 bg-neon/10 px-3 py-1 text-sm text-neon"><Sparkles size={15} /> Roblox creator ops, simplified</div>
          <h1 className="max-w-4xl text-5xl font-extrabold tracking-tight md:text-7xl">RoTools</h1>
          <p className="mt-6 max-w-2xl text-xl leading-8 text-slate-200">Bulk Roblox developer products and 3D item icons in one toolkit.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button className="btn-primary rounded-full" onClick={() => setRoute('dashboard')}>Start Building <ArrowRight size={17} /></button>
            <button className="btn-ghost rounded-full" onClick={() => setRoute('products')}>View Tools</button>
          </div>
          <div className="mt-10 grid grid-cols-2 gap-3 text-sm text-slate-300 sm:grid-cols-4">
            {['Roblox Studio', 'Blender', 'Three.js', 'Roblox Open Cloud'].map((label) => <div key={label} className="rounded-xl border border-white/10 bg-white/[.03] px-3 py-3 text-center">{label}</div>)}
          </div>
        </div>
        <div className="grid gap-4">
          {featureCards.map(([title, Icon, text]) => (
            <Card key={title} className="p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-neon"><Icon /></div>
              <h3 className="text-xl font-bold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">{text}</p>
            </Card>
          ))}
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 py-14">
        <div className="grid gap-4 md:grid-cols-3">
          {['Import your data', 'Create and render', 'Export to Roblox'].map((step, i) => <Card key={step} className="p-6"><span className="text-neon">0{i + 1}</span><h3 className="mt-3 text-xl font-bold">{step}</h3></Card>)}
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 py-14">
        <h2 className="mb-6 text-3xl font-extrabold">Focused tools for Roblox production</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {['Developer product bulk creation', 'Backend-only Open Cloud calls', 'Lua ModuleScript export', 'JSON reward mapping', '3D model icon rendering', 'Transparent PNG export', 'CSV/JSON import', 'ZIP downloads'].map((item) => <Card key={item} className="flex items-center gap-3 p-4"><CheckCircle2 className="text-mint" size={18} /> <span className="text-sm">{item}</span></Card>)}
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 py-14">
        <h2 className="mb-6 text-3xl font-extrabold">Example gallery</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {[Upload, FileJson, Download].map((Icon, i) => <Card key={i} className="min-h-56 p-6"><Icon className="text-neon" /><div className="mt-16 rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300">{['CSV product table', 'Lua reward mapping', 'Transparent item icon'][i]}</div></Card>)}
        </div>
      </section>
      <section className="mx-auto max-w-4xl px-4 py-14">
        <h2 className="mb-6 text-3xl font-extrabold">FAQ</h2>
        {['Does this expose my Roblox API key?', 'Can I use it without Open Cloud?', 'Can icons export with transparency?'].map((q, i) => <Card key={q} className="mb-3 p-5"><h3 className="font-bold">{q}</h3><p className="mt-2 text-sm text-slate-300">{['No. Product creation is sent through the backend only.', 'Yes. The 3D icon generator works locally, and product tables can be edited without creating products.', 'Yes. PNG export supports transparent backgrounds.'][i]}</p></Card>)}
      </section>
      <footer className="border-t border-white/10 px-4 py-8 text-sm text-slate-400"><div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-3"><span>RoTools</span><span>Docs · Discord placeholder · Privacy · Terms</span></div></footer>
    </div>
  );
}
