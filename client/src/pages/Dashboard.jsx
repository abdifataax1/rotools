import React from 'react';
import { Boxes, Clapperboard, CreditCard, Download } from 'lucide-react';
import { Card, PageTitle } from '../components/Card.jsx';
import { useRouter } from '../utils/router.jsx';

export function Dashboard() {
  const { setRoute } = useRouter();
  const tools = [['Upload Shorts', 'shorts', Clapperboard], ['Open Dev Products', 'products', CreditCard], ['Open 3D Icons', 'icons', Boxes]];
  return (
    <div>
      <PageTitle eyebrow="Dashboard" title="Builder command center">Jump into product setup or model icon exports.</PageTitle>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{tools.map(([label, route, Icon]) => <Card key={label} className="p-5"><Icon className="text-neon" /><h3 className="mt-4 text-xl font-bold">{label}</h3><button className="btn btn-primary mt-5" onClick={() => setRoute(route)}>Open</button></Card>)}</div>
      <div className="mt-6 grid gap-4 lg:grid-cols-[1.3fr_.7fr]">
        <Card className="p-5"><h2 className="text-xl font-bold">Recent exports</h2><div className="mt-4 rounded-xl border border-dashed border-white/10 p-8 text-center text-slate-400"><Download className="mx-auto mb-3" /> CSV, JSON, Lua, PNG, and ZIP exports will appear here.</div></Card>
        <Card className="p-5"><h2 className="text-xl font-bold">Quick stats</h2><div className="mt-4 grid gap-3 text-sm"><span className="rounded-lg bg-white/5 p-3">Products drafted: 12</span><span className="rounded-lg bg-white/5 p-3">Icons exported: 24</span></div></Card>
      </div>
    </div>
  );
}
