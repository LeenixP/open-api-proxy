import { ReactNode, useState } from 'react';
import { LayoutDashboard, Server, Play, ScrollText, Settings, Menu, X } from 'lucide-react';
import UpdateBanner from './UpdateBanner';
import { t } from '../i18n';

type Page = 'dashboard' | 'providers' | 'playground' | 'logs' | 'settings';

interface Props {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  children: ReactNode;
}

const navItems: Array<{ id: Page; i18nKey: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'dashboard', i18nKey: 'nav.dashboard', icon: LayoutDashboard },
  { id: 'providers', i18nKey: 'nav.providers', icon: Server },
  { id: 'playground', i18nKey: 'nav.playground', icon: Play },
  { id: 'logs', i18nKey: 'nav.logs', icon: ScrollText },
  { id: 'settings', i18nKey: 'nav.settings', icon: Settings },
];

export default function Layout({ currentPage, onNavigate, children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleNav = (id: Page) => {
    onNavigate(id);
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-60 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col transition-transform duration-200 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="p-5 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">{t('app.title')}</h1>
            <p className="text-xs text-gray-500 mt-1">{t('app.subtitle')}</p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            aria-label="关闭侧边栏"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ id, i18nKey, icon: Icon }) => (
            <button
              key={id}
              onClick={() => handleNav(id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                currentPage === id
                  ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-medium'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t(i18nKey)}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar with hamburger for mobile */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            aria-label="打开菜单"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-sm font-medium text-gray-900 dark:text-white">{t('app.title')}</span>
        </div>
        <UpdateBanner />
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
