import React from 'react';
import { Card, PageTitle } from '../components/Card.jsx';

const sections = [
  ['How to use Bulk Dev Products', 'Enter your Universe ID, add products, validate the table, run a dry run, then create products through the backend.'],
  ['Roblox Open Cloud API key', 'Create an Open Cloud API key in Creator Dashboard with the required universe and developer product permissions. Keep it server-side.'],
  ['Where to put ROBLOX_API_KEY', 'Copy .env.example to .env at the project root and set ROBLOX_API_KEY=. Never put the key in client code.'],
  ['How to find Universe ID', 'Open your experience in Creator Dashboard and copy the Universe ID from the experience details or URL.'],
  ['Lua ModuleScript export', 'Use the Dev Products export button to download a return table keyed by internalKey. Place it in ServerScriptService or ReplicatedStorage as appropriate.'],
  ['Using generated icons in Roblox', 'Export transparent PNG files, upload them as image assets, and assign the asset IDs to your item UI.']
];

export function Docs() {
  return <div className="mx-auto max-w-5xl px-4 py-14"><PageTitle eyebrow="Docs" title="RoTools docs">Practical notes for product and icon workflows.</PageTitle>{sections.map(([title, text]) => <Card key={title} className="mb-4 p-5"><h2 className="text-xl font-bold">{title}</h2><p className="mt-2 leading-7 text-slate-300">{text}</p></Card>)}</div>;
}
