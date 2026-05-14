import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { Server, Box, Activity, X } from 'lucide-react';
import { t } from '../i18n/index';

interface Stats {
  providers: number;
  models: number;
  uptime: number;
}

interface ProviderHealth {
  healthy: boolean;
  failures: number;
  inCooldown: boolean;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({ providers: 0, models: 0, uptime: 0 });
  const [providerHealth, setProviderHealth] = useState<Record<string, ProviderHealth>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    setError('');
    Promise.all([apiClient.getProviders(), apiClient.getHealth(), apiClient.getModels()])
      .then(([providers, health, models]) => {
        const pCount = Object.keys(providers).length;
        const mCount = models.data?.length || 0;
        setStats({ providers: pCount, models: mCount, uptime: health.uptime || 0 });
        setProviderHealth(health.providers || {});
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const formatUptime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">{t('dashboard.title')}</h2>
      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg p-3 text-sm mb-4 flex items-center justify-between">
          <span>{error}</span>
          <div className="flex items-center gap-2">
            <button onClick={load} className="text-red-600 dark:text-red-400 underline hover:no-underline">重试</button>
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <StatCard icon={Server} label={t('dashboard.providers')} value={stats.providers} />
            <StatCard icon={Box} label={t('dashboard.models')} value={stats.models} />
            <StatCard icon={Activity} label={t('dashboard.uptime')} value={formatUptime(stats.uptime)} />
          </>
        )}
      </div>
      <ProvidersSummary health={providerHealth} />
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 animate-pulse">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16" />
      </div>
      <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-12" />
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

function ProvidersSummary({ health }: { health: Record<string, ProviderHealth> }) {
  const [providers, setProviders] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.getProviders()
      .then(setProviders)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">{t('dashboard.status')}</h3>
      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3 flex items-center justify-between animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24" />
              <div className="flex items-center gap-3">
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16" />
                <div className="w-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {Object.entries(providers).map(([key, p]) => {
            const h = health[key];
            return (
              <div key={key} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <span className="font-medium text-gray-900 dark:text-white">{p.display_name || key}</span>
                  <span className="text-xs text-gray-400 ml-2">{p.protocol}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">{t('dashboard.modelsCount', { count: p.models?.length || 0 })}</span>
                  <span className={`w-2 h-2 rounded-full ${!h ? 'bg-gray-300' : h.healthy ? 'bg-green-500' : 'bg-red-500'}`} />
                </div>
              </div>
            );
          })}
          {Object.keys(providers).length === 0 && (
            <p className="text-gray-400 text-sm">{t('dashboard.noProviders')}</p>
          )}
        </div>
      )}
    </div>
  );
}
