import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Boxes, Clapperboard, CreditCard, FileText, Files, Gauge, Home, Settings, Sparkles } from 'lucide-react';
import { AppShell } from './components/AppShell.jsx';
import { ToastProvider } from './components/Toast.jsx';
import { Landing } from './pages/Landing.jsx';
import { Dashboard } from './pages/Dashboard.jsx';
import { Docs } from './pages/Docs.jsx';
import { Pricing } from './pages/Pricing.jsx';
import { SettingsPage } from './pages/SettingsPage.jsx';
import { DevProducts } from './tools/DevProducts.jsx';
import { IconGenerator } from './tools/IconGenerator.jsx';
import { ShortsUploader } from './tools/ShortsUploader.jsx';
import { VideoCompiler } from './tools/VideoCompiler.jsx';
import { RouterContext } from './utils/router.jsx';
import './styles.css';

const routes = {
  home: { label: 'Home', icon: Home, public: true, component: Landing },
  dashboard: { label: 'Dashboard', icon: Gauge, component: Dashboard },
  products: { label: 'Dev Products', icon: CreditCard, component: DevProducts },
  icons: { label: '3D Icons', icon: Boxes, component: IconGenerator },
  shorts: { label: 'Video Upload', icon: Clapperboard, component: ShortsUploader },
  combine: { label: 'Combine Videos', icon: Files, component: VideoCompiler },
  docs: { label: 'Docs', icon: FileText, public: true, component: Docs },
  pricing: { label: 'Pricing', icon: Sparkles, public: true, component: Pricing },
  settings: { label: 'Settings', icon: Settings, component: SettingsPage }
};

function App() {
  const initial = window.location.hash.replace('#/', '') || 'home';
  const [route, setRouteState] = useState(routes[initial] ? initial : 'home');
  useEffect(() => {
    const syncRoute = () => {
      const next = window.location.hash.replace('#/', '') || 'home';
      setRouteState(routes[next] ? next : 'home');
    };
    window.addEventListener('hashchange', syncRoute);
    syncRoute();
    return () => window.removeEventListener('hashchange', syncRoute);
  }, []);
  const setRoute = (next) => {
    window.location.hash = `/${next}`;
    setRouteState(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const value = useMemo(() => ({ route, setRoute, routes }), [route]);
  const Page = routes[route].component;

  return (
    <RouterContext.Provider value={value}>
      <ToastProvider>
        <AppShell>
          <Page />
        </AppShell>
      </ToastProvider>
    </RouterContext.Provider>
  );
}

createRoot(document.getElementById('root')).render(<App />);
