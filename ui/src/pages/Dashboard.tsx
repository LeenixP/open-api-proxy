import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { Server, Box, Activity, Heart, Plus, Play, Download, Check, Zap, ArrowRight } from 'lucide-react';
import { useLocale } from '../i18n/LocaleContext';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import type { PlaygroundContext } from '../App';

type Page = 'dashboard' | 'providers' | 'playground' | 'logs' | 'settings';

interface DashboardProps {
  onNavigate?: (page: Page) => void;
  onTestProvider?: (ctx: PlaygroundContext) => void;
  onAddProvider?: () => void;
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

export default function Dashboard({ onNavigate, onTestProvider, onAddProvider }: DashboardProps) {
  const { t } = useLocale();
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
            <StatCard icon={Heart} label={t('dashboard.status')} value={`${healthyCount}/${providerCount}`} />
          </>
        )}
      </div>

      {/* No providers: show empty state */}
      {!loading && providerCount === 0 && (
        <EmptyState onNavigate={onNavigate} onImported={load} />
      )}

      {/* Section 2: Provider Health Overview (compact) */}
      {!loading && providerCount > 0 && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">{t('dashboard.status')}</h3>
            <button
              onClick={() => onNavigate?.('providers')}
              className="inline-flex items-center gap-1 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              {t('dashboard.viewAll')}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(providers).slice(0, 6).map(([key, p]) => {
              const ph = health.providers?.[key];
              const isHealthy = ph?.healthy;
              const healthBadgeColor = ph === undefined ? 'gray' : isHealthy ? 'green' : 'red';
              const healthLabel = isHealthy ? 'Healthy' : ph ? 'Down' : 'Unknown';
              const modelCount2 = p.models?.length || 0;
              return (
                <div key={key} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium text-sm text-gray-900 dark:text-white truncate">{p.display_name || key}</span>
                    <Badge color={healthBadgeColor}>{healthLabel}</Badge>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-gray-400">{t('dashboard.modelsCount', { count: modelCount2 })}</span>
                    <button
                      onClick={() => {
                        const firstModel = p.models?.[0] || '';
                        onTestProvider?.({ providerKey: key, model: firstModel ? `${key}/${firstModel}` : key + '/' });
                      }}
                      className="text-gray-400 hover:text-emerald-500 p-1 rounded"
                      aria-label={t('dashboard.testProvider', { name: p.display_name || key })}
                      title={t('dashboard.testProvider', { name: p.display_name || key })}
                    >
                      <Zap className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {providerCount > 6 && (
            <p className="mt-2 text-xs text-gray-400">
              {t('dashboard.andMore', { count: providerCount - 6 })}
            </p>
          )}
        </section>
      )}

      {/* Section 3: Quick Actions */}
      {!loading && providerCount > 0 && (
        <section>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">{t('dashboard.quickActions')}</h3>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => onAddProvider?.()}>
              <Plus className="w-4 h-4" />
              {t('dashboard.addProvider')}
            </Button>
            <Button variant="secondary" onClick={() => onNavigate?.('playground')}>
              <Play className="w-4 h-4" />
              {t('dashboard.apiTest')}
            </Button>
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

/* ------------------------------------------------------------------ */
/* Empty State                                                         */
/* ------------------------------------------------------------------ */

function EmptyState({ onNavigate, onImported }: { onNavigate?: (page: Page) => void; onImported: () => void }) {
  const { t } = useLocale();
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
          <Button onClick={() => onNavigate?.('providers')}>
            <Plus className="w-4 h-4" />
            {t('dashboard.addManually')}
          </Button>
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
