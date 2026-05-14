import { useState } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Providers from './pages/Providers';
import Playground from './pages/Playground';
import Logs from './pages/Logs';
import Settings from './pages/Settings';

type Page = 'dashboard' | 'providers' | 'playground' | 'logs' | 'settings';

export default function App() {
  const [page, setPage] = useState<Page>('dashboard');

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <Dashboard />;
      case 'providers': return <Providers />;
      case 'playground': return <Playground />;
      case 'logs': return <Logs />;
      case 'settings': return <Settings />;
    }
  };

  return (
    <Layout currentPage={page} onNavigate={setPage}>
      {renderPage()}
    </Layout>
  );
}
