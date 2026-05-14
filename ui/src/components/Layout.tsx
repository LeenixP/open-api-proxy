import { ReactNode } from 'react';
import { LayoutDashboard, Server, Play, ScrollText, Settings } from 'lucide-react';
import UpdateBanner from './UpdateBanner';

type Page = 'dashboard' | 'providers' | 'playground' | 'logs' | 'settings';

interface Props {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  children: ReactNode;
}

const navItems: Array<{ id: Page; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'dashboard', label: '仪表盘', icon: LayoutDashboard },
  { id: 'providers', label: '厂商管理', icon: Server },
  { id: 'playground', label: 'API 测试', icon: Play },
  { id: 'logs', label: '日志', icon: ScrollText },
  { id: 'settings', label: '设置', icon: Settings },
];

export default function Layout({ currentPage, onNavigate, children }: Props) {
  return (
    <div className="min-h-screen flex">
      <aside className="w-60 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col">
        <div className="p-5 border-b border-gray-200 dark:border-gray-800">
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">open-api-proxy</h1>
          <p className="text-xs text-gray-500 mt-1">LLM API 统一网关</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                currentPage === id
                  ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-medium'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <UpdateBanner />
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
