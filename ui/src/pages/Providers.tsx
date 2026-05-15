import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { Plus, Pencil, Trash2, X, Loader2, Eye, EyeOff, Download } from 'lucide-react';
import ProviderEditor from '../components/ProviderEditor';
import { t } from '../i18n';

export default function Providers() {
  const [providers, setProviders] = useState<Record<string, any>>({});
  const [editing, setEditing] = useState<{ key: string; data: any } | 'new' | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
  const [presetsModal, setPresetsModal] = useState(false);
  const [presets, setPresets] = useState<Record<string, any>>({});
  const [importingPreset, setImportingPreset] = useState<string | null>(null);
  const [presetError, setPresetError] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    apiClient.getProviders()
      .then(setProviders)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

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
    try {
      const data = await apiClient.getPresets();
      setPresets(data);
    } catch (err: any) {
      setPresetError(err.message);
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
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t('providers.title')}</h2>
        <div className="flex items-center gap-2">
          <button onClick={() => openPresetsModal()} className="flex items-center gap-1 bg-emerald-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-emerald-700">
            <Download className="w-4 h-4" /> {t('providers.importPresets')}
          </button>
          <button onClick={() => setEditing('new')} className="flex items-center gap-1 bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-indigo-700">
            <Plus className="w-4 h-4" /> {t('providers.add')}
          </button>
        </div>
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

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
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
              {Object.entries(providers).map(([key, p]) => (
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
              {Object.keys(providers).length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">{t('providers.empty')}</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Import from Presets modal */}
      {presetsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('providers.importPresetsTitle')}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{t('providers.importPresetsDesc')}</p>
              </div>
              <button onClick={() => { setPresetsModal(false); setPresetError(''); }} className="text-gray-400 hover:text-gray-600" aria-label={t('common.close')}><X className="w-5 h-5" /></button>
            </div>
            {presetError && (
              <div className="mx-5 mt-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg p-2 text-sm flex items-center justify-between">
                <span>{presetError}</span>
                <button onClick={() => setPresetError('')} className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
              </div>
            )}
            <div className="p-5 overflow-auto flex-1">
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
                    <button
                      onClick={() => handleImportPreset(presetKey)}
                      disabled={importingPreset === presetKey}
                      className="mt-auto w-full text-xs bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-1"
                    >
                      {importingPreset === presetKey ? (
                        <><Loader2 className="w-3 h-3 animate-spin" /> {t('providers.importing')}</>
                      ) : (
                        t('providers.importPresetBtn')
                      )}
                    </button>
                  </div>
                ))}
              </div>
              {Object.keys(presets).length === 0 && !presetError && (
                <div className="text-center py-8 text-gray-400">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                  <p className="text-sm">{t('common.loading')}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Custom delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl p-6 max-w-sm w-full">
            <p className="text-gray-900 dark:text-white mb-4">
              {t('providers.deleteConfirm', { key: deleteTarget })}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg dark:text-gray-400 dark:hover:bg-gray-800"
              >
                {t('providers.cancel')}
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                {t('providers.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

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
