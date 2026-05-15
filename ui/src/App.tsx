import { useState, useEffect, useCallback } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Providers from './pages/Providers';
import Playground from './pages/Playground';
import Logs from './pages/Logs';
import Settings from './pages/Settings';
import { LocaleProvider } from './i18n/LocaleContext';

type Page = 'dashboard' | 'providers' | 'playground' | 'logs' | 'settings';

const validPages: Page[] = ['dashboard', 'providers', 'playground', 'logs', 'settings'];

function getPageFromHash(): Page {
  const hash = window.location.hash.replace('#', '');
  if (validPages.includes(hash as Page)) return hash as Page;
  return 'dashboard';
}

export interface PlaygroundContext {
  providerKey: string;
  model: string;
}

export default function App() {
  const [page, setPage] = useState<Page>(getPageFromHash);
  const [playgroundContext, setPlaygroundContext] = useState<PlaygroundContext | null>(null);
  const [providersOpenEditor, setProvidersOpenEditor] = useState(false);

  useEffect(() => {
    window.location.hash = page;
  }, [page]);

  const onHashChange = useCallback(() => {
    setPage(getPageFromHash());
  }, []);

  useEffect(() => {
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [onHashChange]);

  const navigateToPlayground = (ctx: PlaygroundContext) => {
    setPlaygroundContext(ctx);
    setPage('playground');
  };

  const navigateToProviders = (openEditor?: boolean) => {
    setProvidersOpenEditor(openEditor || false);
    setPage('providers');
  };

  const handleNavigate = (p: Page) => {
    if (p !== 'playground') setPlaygroundContext(null);
    if (p !== 'providers') setProvidersOpenEditor(false);
    setPage(p);
  };

  return (
    <LocaleProvider>
      <Layout currentPage={page} onNavigate={handleNavigate}>
        {page === 'dashboard' && (
          <Dashboard
            onNavigate={handleNavigate}
            onTestProvider={navigateToPlayground}
            onAddProvider={() => navigateToProviders(true)}
          />
        )}
        {page === 'providers' && (
          <Providers
            onTestProvider={navigateToPlayground}
            openEditor={providersOpenEditor}
            onEditorOpened={() => setProvidersOpenEditor(false)}
          />
        )}
        {page === 'playground' && (
          <Playground initialContext={playgroundContext} onContextConsumed={() => setPlaygroundContext(null)} />
        )}
        {page === 'logs' && <Logs />}
        {page === 'settings' && <Settings />}
      </Layout>
    </LocaleProvider>
  );
}
