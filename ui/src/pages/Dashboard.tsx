import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { Server, Box, Activity, Heart, Plus, Play, Download, Check } from 'lucide-react';
import { t } from '../i18n/index';

type Page = 'dashboard' | 'providers' | 'playground' | 'logs' | 'settings';

interface DashboardProps {
  onNavigate?: (page: Page) => void;
}

interface ProviderData {
  display_name: string;
  protocol: string;
  models: string[];
  base_url: string;
  api_key: string;
}

interface ProviderHealth {
  healthy: boolean;
  failures: number;
  inCooldown: boolean;
}

interface PresetItem {
  display_name: string;
  base_url: string;
  api_key: string;
  protocol: string;
  website?: string;
  models: string[];
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const [providers, setProviders] = useState<Record<string, ProviderData>>({});
  const [health, setHealth] = useState<{ uptime: number; providers: Record<string, ProviderHealth> }>({ uptime: 0, providers: {} });
  const [models, setModels] = useState<Array<{ id: string }>>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    setError('');
    Promise.all([apiClient.getProviders(), apiClient.getHealth(), apiClient.getModels()])
      .then(([p, h, m]) => {
        setProviders(p);
        setHealth(h);
        setModels(m.data || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const providerCount = Object.keys(providers).length;
  const modelCount = models.length;
  const healthyCount = Object.values(health.providers || {}).filter((h) => h.healthy).length;

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">{t('dashboard.title')}</h2>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg p-3 text-sm mb-4 flex items-center justify-between">
          <span>{error}</span>
          <div className="flex items-center gap-2">
            <button onClick={load} className="text-red-600 dark:text-red-400 underline hover:no-underline">{t('common.retry')}</button>
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-600" aria-label={t('common.close')}>
              <span className="text-lg leading-none">&times;</span>
            </button>
          </div>
        </div>
      )}

      {/* Section 1: Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {loading ? (
          <>
            <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
          </>
        ) : (
          <>
            <StatCard icon={Server} label={t('dashboard.providers')} value={providerCount} />
            <StatCard icon={Box} label={t('dashboard.models')} value={modelCount} />
            <StatCard icon={Activity} label={t('dashboard.uptime')} value={formatUptime(health.uptime || 0)} />
            <StatCard icon={Heart} label={t('dashboard.healthyCount', { healthy: healthyCount, total: providerCount })} value={`${healthyCount}/${providerCount}`} />
          </>
        )}
      </div>

      {/* No providers: show empty state */}
      {!loading && providerCount === 0 && (
        <EmptyState onNavigate={onNavigate} onImported={load} />
      )}

      {/* Section 2: Models Overview */}
      {!loading && providerCount > 0 && (
        <section className="mb-8">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">{t('dashboard.modelOverview')}</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {Object.entries(providers).map(([key, p]) => (
              <ProviderModelCard
                key={key}
                providerKey={key}
                provider={p}
                health={health.providers?.[key]}
              />
            ))}
          </div>
        </section>
      )}

      {/* Section 3: Quick Actions */}
      {!loading && providerCount > 0 && (
        <section>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">{t('dashboard.quickActions')}</h3>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => onNavigate?.('providers')}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t('dashboard.addProvider')}
            </button>
            <button
              onClick={() => onNavigate?.('playground')}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <Play className="w-4 h-4" />
              {t('dashboard.apiTest')}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                     */
/* ------------------------------------------------------------------ */

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

function ProviderModelCard({ providerKey, provider, health }: { providerKey: string; provider: ProviderData; health?: ProviderHealth }) {
  const models = provider.models || [];
  const isHealthy = health?.healthy;
  const healthColor = health === undefined ? 'bg-gray-300' : isHealthy ? 'bg-green-500' : 'bg-red-500';

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-gray-900 dark:text-white truncate">{provider.display_name || providerKey}</span>
          <span className="shrink-0 text-xs px-1.5 py-0.5 rounded font-mono bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
            {provider.protocol}
          </span>
        </div>
        <span className={`shrink-0 ml-2 w-2.5 h-2.5 rounded-full ${healthColor}`} title={isHealthy ? 'Healthy' : health ? 'Unhealthy' : 'Unknown'} />
      </div>

      {/* Models as chips */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {models.map((m) => (
          <span
            key={m}
            className="inline-flex px-2 py-0.5 rounded-md text-xs font-mono bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
          >
            {m}
          </span>
        ))}
        {models.length === 0 && (
          <span className="text-xs text-gray-400 dark:text-gray-500 italic">{t('dashboard.noModels')}</span>
        )}
      </div>

      {/* Footer: model count */}
      <p className="text-xs text-gray-400 dark:text-gray-500">
        {t('dashboard.modelsCount', { count: models.length })}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Empty State                                                         */
/* ------------------------------------------------------------------ */

function EmptyState({ onNavigate, onImported }: { onNavigate?: (page: Page) => void; onImported: () => void }) {
  const [presets, setPresets] = useState<Record<string, PresetItem>>({});
  const [presetsLoading, setPresetsLoading] = useState(true);
  const [importingKey, setImportingKey] = useState<string | null>(null);
  const [importedKeys, setImportedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    apiClient.getPresets()
      .then(setPresets)
      .catch(() => {})
      .finally(() => setPresetsLoading(false));
  }, []);

  const handleImport = (key: string) => {
    setImportingKey(key);
    apiClient.importPreset(key)
      .then(() => {
        setImportedKeys((prev) => new Set(prev).add(key));
        onImported();
      })
      .catch(() => {})
      .finally(() => setImportingKey(null));
  };

  return (
    <div>
      {/* Welcome message */}
      <div className="text-center py-8 mb-6">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
          <Download className="w-8 h-8 text-indigo-500" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{t('dashboard.emptyTitle')}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">{t('dashboard.emptyDesc')}</p>
        <div className="mt-4">
          <button
            onClick={() => onNavigate?.('providers')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t('dashboard.addManually')}
          </button>
        </div>
      </div>

      {/* Popular presets */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">{t('dashboard.popularPresets')}</h3>
          <span className="text-xs text-gray-400">{t('dashboard.importPresetHint')}</span>
        </div>

        {presetsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-3 animate-pulse">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20 mb-2" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16 mb-2" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-32" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {Object.entries(presets).map(([key, preset]) => {
              const isImported = importedKeys.has(key);
              const isThisImporting = importingKey === key;
              return (
                <div key={key} className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-3 flex flex-col">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm text-gray-900 dark:text-white truncate">{preset.display_name}</span>
                    <span className="shrink-0 text-[10px] px-1 py-0.5 rounded font-mono bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 ml-2">
                      {preset.protocol}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mb-2">{t('dashboard.modelsCount', { count: preset.models.length })}</p>
                  <button
                    onClick={() => handleImport(key)}
                    disabled={isImported || isThisImporting}
                    className={`mt-auto inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      isImported
                        ? 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 cursor-default'
                        : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50'
                    }`}
                  >
                    {isImported ? (
                      <>
                        <Check className="w-3 h-3" />
                        {t('dashboard.imported')}
                      </>
                    ) : isThisImporting ? (
                      t('dashboard.importing')
                    ) : (
                      <>
                        <Download className="w-3 h-3" />
                        {t('dashboard.import')}
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function formatUptime(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/* Add missing i18n key to en/zh — inline fallback handled by t() */
