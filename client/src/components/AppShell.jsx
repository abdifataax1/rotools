import React from 'react';
import { Blocks, Menu } from 'lucide-react';
import { useRouter } from '../utils/router.jsx';

export function AppShell({ children }) {
  const { route, setRoute, routes } = useRouter();
  const appRoutes = ['dashboard', 'shorts', 'combine', 'products', 'icons', 'docs', 'settings'];
  const isTool = route !== 'home' && route !== 'pricing';
  return (
    <div className="relative min-h-screen overflow-hidden orbital-bg">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-ink/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <button className="flex items-center gap-3" onClick={() => setRoute('home')}>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-neon text-slate-950 shadow-glow"><Blocks size={21} /></span>
            <span className="text-base font-extrabold">RoTools</span>
          </button>
          <nav className="hidden items-center gap-1 md:flex">
            {['home', 'dashboard', 'shorts', 'combine', 'products', 'icons', 'pricing', 'docs'].map((key) => (
              <button key={key} onClick={() => setRoute(key)} className={`rounded-lg px-3 py-2 text-sm ${route === key ? 'bg-white/10 text-white' : 'text-slate-300 hover:text-white'}`}>{routes[key].label}</button>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <button className="hidden rounded-full border border-white/10 bg-white/[.04] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/20 hover:bg-white/10 sm:inline-flex">Login</button>
            <button className="rounded-full bg-neon px-4 py-2 text-sm font-bold text-slate-950 shadow-glow transition hover:bg-white" onClick={() => setRoute('dashboard')}>Launch app</button>
            <button className="btn-ghost md:hidden"><Menu size={17} /></button>
          </div>
        </div>
      </header>
      <div className={isTool ? 'mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[250px_1fr]' : ''}>
        {isTool && (
          <aside className="glass h-fit rounded-2xl p-3 lg:sticky lg:top-24">
            {appRoutes.map((key) => {
              const Icon = routes[key].icon;
              return <button key={key} onClick={() => setRoute(key)} className={`mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm ${route === key ? 'bg-neon/15 text-neon' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}><Icon size={17} /> {routes[key].label}</button>;
            })}
          </aside>
        )}
        <main className={isTool ? 'min-w-0' : ''}>{children}</main>
      </div>
    </div>
  );
}
