import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { Server, Box, Activity } from 'lucide-react';

interface Stats {
  providers: number;
  models: number;
  uptime: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({ providers: 0, models: 0, uptime: 0 });
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([apiClient.getProviders(), apiClient.getHealth(), apiClient.getModels()])
      .then(([providers, health, models]) => {
        const pCount = Object.keys(providers).length;
        const mCount = models.data?.length || 0;
        setStats({ providers: pCount, models: mCount, uptime: health.uptime || 0 });
      })
      .catch((err) => setError(err.message));
  }, []);

  const formatUptime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">仪表盘</h2>
      {error && <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg p-3 text-sm mb-4">{error}</div>}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard icon={Server} label="厂商数" value={stats.providers} />
        <StatCard icon={Box} label="模型数" value={stats.models} />
        <StatCard icon={Activity} label="运行时间" value={formatUptime(stats.uptime)} />
      </div>
      <ProvidersSummary />
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | number }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5 text-indigo-500" />
        <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
      </div>
      <p className="text-2xl font-bold mt-2 text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}

function ProvidersSummary() {
  const [providers, setProviders] = useState<Record<string, any>>({});
  const [healthMap, setHealthMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    apiClient.getProviders().then(setProviders).catch(() => {});
  }, []);

  const checkHealth = async (key: string, baseUrl: string) => {
    try {
      await fetch(baseUrl + '/models', { signal: AbortSignal.timeout(5000) });
      setHealthMap((prev) => ({ ...prev, [key]: true }));
    } catch {
      setHealthMap((prev) => ({ ...prev, [key]: false }));
    }
  };

  useEffect(() => {
    Object.entries(providers).forEach(([key, p]) => { checkHealth(key, p.base_url); });
  }, [providers]);

  return (
    <div>
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">厂商状态</h3>
      <div className="space-y-2">
        {Object.entries(providers).map(([key, p]) => {
          const health = healthMap[key];
          return (
            <div key={key} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3 flex items-center justify-between">
              <div>
                <span className="font-medium text-gray-900 dark:text-white">{p.display_name || key}</span>
                <span className="text-xs text-gray-400 ml-2">{p.protocol}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">{p.models?.length || 0} 个模型</span>
                <span className={`w-2 h-2 rounded-full ${health === undefined ? 'bg-gray-300' : health ? 'bg-green-500' : 'bg-red-500'}`} />
              </div>
            </div>
          );
        })}
        {Object.keys(providers).length === 0 && (
          <p className="text-gray-400 text-sm">暂无厂商。请在"厂商管理"页面添加。</p>
        )}
      </div>
    </div>
  );
}
