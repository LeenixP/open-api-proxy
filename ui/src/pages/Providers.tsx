import { useState, useEffect, useMemo } from 'react';
import { apiClient } from '../api/client';
import { Plus, Pencil, Trash2, X, Loader2, Eye, EyeOff, Download, Zap, Search, Server, Heart, Copy, Check, Activity } from 'lucide-react';
import ProviderEditor from '../components/ProviderEditor';
import { useLocale } from '../i18n/LocaleContext';
import { formatUptime } from '../lib/utils';
import type { ProviderHealth } from '../types';
import type { PlaygroundContext } from '../App';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/EmptyState';

interface ProvidersProps {
  onTestProvider?: (ctx: PlaygroundContext) => void;
  openEditor?: boolean;
  onEditorOpened?: () => void;
}

export default function Providers({ onTestProvider, openEditor, onEditorOpened }: ProvidersProps) {
  const { t } = useLocale();
  const [providers, setProviders] = useState<Record<string, any>>({});
  const [health, setHealth] = useState<{ uptime: number; providers: Record<string, ProviderHealth> }>({ uptime: 0, providers: {} });
  const [editing, setEditing] = useState<{ key: string; data: any } | 'new' | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
  const [presetsModal, setPresetsModal] = useState(false);
  const [presets, setPresets] = useState<Record<string, any>>({});
  const [presetsLoading, setPresetsLoading] = useState(false);
  const [importingPreset, setImportingPreset] = useState<string | null>(null);
  const [presetError, setPresetError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);

  const proxyEndpoint = `${window.location.protocol}//${window.location.host}`;

  const load = () => {
    setLoading(true);
    setError('');
    Promise.all([apiClient.getProviders(), apiClient.getHealth()])
      .then(([p, h]) => {
        setProviders(p);
        setHealth(h);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (openEditor && !loading) {
      setEditing('new');
      onEditorOpened?.();
    }
  }, [openEditor, loading]);

  const copyEndpoint = () => {
    navigator.clipboard.writeText(proxyEndpoint).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const providerCount = Object.keys(providers).length;
  const healthyCount = Object.values(health.providers || {}).filter((h) => h.healthy).length;

  const filteredProviders = useMemo(() => {
    return Object.entries(providers).filter(([key, p]) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        key.toLowerCase().includes(q) ||
        (p.display_name || '').toLowerCase().includes(q) ||
        (p.base_url || '').toLowerCase().includes(q)
      );
    });
  }, [providers, searchQuery]);

  const handleSave = async (key: string, data: any) => {
    try {
      if (editing === 'new') {
        await apiClient.createProvider(key, data);
      } else {
        await apiClient.updateProvider(key, data);
      }
      setEditing(null);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiClient.deleteProvider(deleteTarget);
      setDeleteTarget(null);
      load();
    } catch (err: any) {
      setError(err.message);
      setDeleteTarget(null);
    }
  };

  const openPresetsModal = async () => {
    setPresetsModal(true);
    setPresetError('');
    setPresetsLoading(true);
    try {
      const data = await apiClient.getPresets();
      setPresets(data);
    } catch (err: any) {
      setPresetError(err.message);
    } finally {
      setPresetsLoading(false);
    }
  };

  const handleImportPreset = async (presetKey: string) => {
    setImportingPreset(presetKey);
    setPresetError('');
    try {
      await apiClient.importPreset(presetKey);
      setImportingPreset(null);
      load();
    } catch (err: any) {
      setPresetError(t('providers.importFailed', { error: err.message }));
      setImportingPreset(null);
    }
  };

  return (
    <div>
      {/* Compact Stats Bar */}
      <div className="flex flex-wrap items-center gap-3 mb-6 px-3 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl">
        {loading ? (
          <div className="flex items-center gap-4 animate-pulse w-full">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16" />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
              <Server className="w-3.5 h-3.5 text-indigo-500" />
              <span>{t('providers.statsProviders')}</span>
              <span className="font-semibold text-gray-900 dark:text-white">{providerCount}</span>
            </div>
            <span className="text-gray-300 dark:text-gray-700">|</span>
            <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
              <Heart className="w-3.5 h-3.5 text-emerald-500" />
              <span>{t('providers.statsHealth')}</span>
              <Badge color={healthyCount === providerCount && providerCount > 0 ? 'green' : providerCount === 0 ? 'gray' : 'amber'}>
                {healthyCount}/{providerCount}
              </Badge>
            </div>
            <span className="text-gray-300 dark:text-gray-700">|</span>
            <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
              <Activity className="w-3.5 h-3.5 text-blue-500" />
              <span>{t('providers.statsUptime')}</span>
              <span className="font-semibold text-gray-900 dark:text-white">{formatUptime(health.uptime || 0)}</span>
            </div>
            <span className="text-gray-300 dark:text-gray-700">|</span>
            <div className="flex items-center gap-1.5 text-sm">
              <span className="text-gray-500 dark:text-gray-400 font-mono text-xs truncate max-w-[200px]">{proxyEndpoint}</span>
              <button
                onClick={copyEndpoint}
                className="text-gray-400 hover:text-indigo-500 transition-colors"
                aria-label={t('providers.copyEndpoint')}
                title={t('providers.copyEndpoint')}
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </>
        )}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg p-3 text-sm mb-4 flex items-center justify-between">
          <span>{error}</span>
          <div className="flex items-center gap-2">
            <button onClick={load} className="text-red-600 dark:text-red-400 underline hover:no-underline">{t('common.retry')}</button>
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {/* Empty State with Presets */}
      {!loading && providerCount === 0 && (
        <EmptyState
          namespace="providers"
          onAddManually={() => setEditing('new')}
          onImported={load}
        />
      )}

      {/* Provider Table (shown when providers exist) */}
      {(loading || providerCount > 0) && (
        <>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t('providers.title')}</h2>
            <div className="flex items-center gap-2">
              <Button onClick={() => openPresetsModal()} size="sm" className="bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-500">
                <Download className="w-4 h-4" /> {t('providers.importPresets')}
              </Button>
              <Button onClick={() => setEditing('new')} size="sm">
                <Plus className="w-4 h-4" /> {t('providers.add')}
              </Button>
            </div>
          </div>

          {/* Search filter */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('providers.searchPlaceholder')}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400"
            />
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-x-auto">
            {loading ? (
              <div className="p-6 space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-4 animate-pulse">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/6" />
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/6" />
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/12" />
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/12" />
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded flex-1" />
                  </div>
                ))}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">{t('providers.name')}</th>
                    <th className="text-left px-4 py-3 font-medium">{t('providers.key')}</th>
                    <th className="text-left px-4 py-3 font-medium">{t('providers.protocol')}</th>
                    <th className="text-left px-4 py-3 font-medium">{t('providers.apiKey')}</th>
                    <th className="text-left px-4 py-3 font-medium">{t('providers.models')}</th>
                    <th className="text-left px-4 py-3 font-medium">{t('providers.baseUrl')}</th>
                    <th className="text-right px-4 py-3 font-medium">{t('providers.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {filteredProviders.map(([key, p]) => (
                    <tr key={key} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-4 py-3 text-gray-900 dark:text-white font-medium">{p.display_name || key}</td>
                      <td className="px-4 py-3 text-gray-500">{key}</td>
                      <td className="px-4 py-3">
                        <span className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded text-xs">{p.protocol}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <span className="text-gray-500 font-mono text-xs max-w-[120px] truncate">
                            {visibleKeys[key] ? p.api_key : '••••••••'}
                          </span>
                          <button
                            onClick={() => setVisibleKeys(prev => ({ ...prev, [key]: !prev[key] }))}
                            className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                            aria-label={visibleKeys[key] ? t('providers.hideKey') : t('providers.showKey')}
                          >
                            {visibleKeys[key] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {(p.models?.length || 0) === 0 ? (
                          <span className="text-gray-400 text-xs">{t('providers.modelsEmpty')}</span>
                        ) : (
                          <div className="flex flex-wrap gap-1 max-w-[220px]">
                            {p.models.slice(0, 3).map((m: string) => (
                              <span key={m} className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded text-xs truncate max-w-[100px]" title={m}>{m}</span>
                            ))}
                            {p.models.length > 3 && (
                              <span className="text-gray-400 text-xs" title={p.models.slice(3).join(', ')}>+{p.models.length - 3}</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-400 font-mono text-xs truncate max-w-[200px]">{p.base_url}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => {
                            const firstModel = p.models?.[0] || '';
                            onTestProvider?.({ providerKey: key, model: firstModel ? `${key}/${firstModel}` : key + '/' });
                          }}
                          className="text-gray-400 hover:text-emerald-500 mr-2"
                          aria-label={t('providers.test', { key })}
                          title={t('providers.test', { key })}
                        >
                          <Zap aria-hidden="true" className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditing({ key, data: p })}
                          className="text-gray-400 hover:text-indigo-500 mr-2"
                          aria-label={t('providers.edit', { key })}
                        >
                          <Pencil aria-hidden="true" className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(key)}
                          className="text-gray-400 hover:text-red-500"
                          aria-label={t('providers.deleteAria', { key })}
                        >
                          <Trash2 aria-hidden="true" className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {providerCount > 0 && filteredProviders.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">{t('providers.noMatch')}</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* Import from Presets modal */}
      <Modal
        open={presetsModal}
        onClose={() => { setPresetsModal(false); setPresetError(''); }}
        title={t('providers.importPresetsTitle')}
        description={t('providers.importPresetsDesc')}
        size="lg"
      >
        {presetError && (
          <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg p-2 text-sm flex items-center justify-between mb-4">
            <span>{presetError}</span>
            <button onClick={() => setPresetError('')} className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Object.entries(presets).map(([presetKey, preset]: [string, any]) => (
            <div key={presetKey} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 flex flex-col hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white">{preset.display_name}</h4>
                  <span className="text-xs text-gray-400 font-mono">{presetKey}</span>
                </div>
                <span className="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs px-1.5 py-0.5 rounded flex-shrink-0 ml-2">{preset.protocol}</span>
              </div>
              <div className="flex flex-wrap gap-1 mb-3 min-h-[24px]">
                {preset.models?.slice(0, 3).map((m: string) => (
                  <span key={m} className="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs px-1.5 py-0.5 rounded truncate max-w-[120px]" title={m}>{m}</span>
                ))}
                {preset.models?.length > 3 && (
                  <span className="text-gray-400 text-xs">+{preset.models.length - 3}</span>
                )}
              </div>
              {preset.website && (
                <a href={preset.website} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-500 dark:text-indigo-400 hover:underline mb-2 truncate" title={preset.website}>
                  {preset.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                </a>
              )}
              <Button
                onClick={() => handleImportPreset(presetKey)}
                disabled={importingPreset === presetKey}
                loading={importingPreset === presetKey}
                size="sm"
                className="mt-auto w-full"
              >
                {importingPreset === presetKey ? t('providers.importing') : t('providers.importPresetBtn')}
              </Button>
            </div>
          ))}
        </div>
        {Object.keys(presets).length === 0 && !presetError && presetsLoading && (
          <div className="text-center py-8 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
            <p className="text-sm">{t('common.loading')}</p>
          </div>
        )}
        {Object.keys(presets).length === 0 && !presetError && !presetsLoading && (
          <div className="text-center py-8 text-gray-400">
            <p className="text-sm">{t('providers.empty')}</p>
          </div>
        )}
      </Modal>

      {/* Delete confirmation modal */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        size="sm"
        hideCloseButton
      >
        <p className="text-gray-900 dark:text-white mb-4">
          {t('providers.deleteConfirm', { key: deleteTarget || '' })}
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
            {t('providers.cancel')}
          </Button>
          <Button variant="danger" onClick={handleDelete}>
            {t('providers.delete')}
          </Button>
        </div>
      </Modal>

      {editing && (
        <ProviderEditor
          initial={editing === 'new' ? undefined : { key: editing.key, ...editing.data }}
          onSave={handleSave}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
