import React from 'react';
import { Check } from 'lucide-react';
import { Card, PageTitle } from '../components/Card.jsx';

export function Pricing() {
  return <div className="mx-auto max-w-7xl px-4 py-14"><PageTitle eyebrow="Pricing" title="Pick your builder lane">Payments are placeholders for now.</PageTitle><div className="grid gap-4 md:grid-cols-3">{['Free', 'Pro', 'Studio'].map((tier, i) => <Card key={tier} className="p-6"><h2 className="text-2xl font-bold">{tier}</h2><p className="mt-2 text-slate-300">{['Local tools for solo creators.', 'More exports and batch workflows.', 'Team-ready Roblox production ops.'][i]}</p><div className="my-6 text-4xl font-extrabold">{i === 0 ? '$0' : 'Soon'}</div>{['Dev products', '3D icons'].map((x) => <p key={x} className="mb-2 flex gap-2 text-sm text-slate-300"><Check size={16} className="text-mint" /> {x}</p>)}</Card>)}</div></div>;
}
