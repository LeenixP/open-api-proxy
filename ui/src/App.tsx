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

  return (
    <Layout currentPage={page} onNavigate={setPage}>
      <div className={page === 'dashboard' ? '' : 'hidden'}><Dashboard /></div>
      <div className={page === 'providers' ? '' : 'hidden'}><Providers /></div>
      <div className={page === 'playground' ? '' : 'hidden'}><Playground /></div>
      <div className={page === 'logs' ? '' : 'hidden'}><Logs /></div>
      <div className={page === 'settings' ? '' : 'hidden'}><Settings /></div>
    </Layout>
  );
}
