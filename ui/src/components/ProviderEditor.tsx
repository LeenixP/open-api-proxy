import { useState, useEffect } from 'react';
import { X, Eye, EyeOff, ChevronDown } from 'lucide-react';
import ModelTagInput from './ModelTagInput';
import { apiClient } from '../api/client';
import { t } from '../i18n';

interface ProviderData {
  key?: string;
  display_name: string;
  base_url: string;
  api_key: string;
  protocol: string;
  models: string[];
}

interface Props {
  initial?: ProviderData;
  onSave: (key: string, data: any) => void;
  onClose: () => void;
}

export default function ProviderEditor({ initial, onSave, onClose }: Props) {
  const [key, setKey] = useState(initial?.key || '');
  const [displayName, setDisplayName] = useState(initial?.display_name || '');
  const [baseUrl, setBaseUrl] = useState(initial?.base_url || '');
  const [apiKey, setApiKey] = useState(initial?.api_key || '');
  const [protocol, setProtocol] = useState(initial?.protocol || 'openai');
  const [models, setModels] = useState<string[]>(initial?.models || []);
  const [showApiKey, setShowApiKey] = useState(false);
  const [presetsData, setPresetsData] = useState<Record<string, any>>({});
  const [showModelImport, setShowModelImport] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient.getPresets().then(setPresetsData).catch(() => {});
  }, []);

  const addModel = (model: string) => {
    if (models.includes(model)) return;
    setModels([...models, model]);
  };

  const protocolPresetModels = [...new Set(
    Object.values(presetsData)
      .filter((p: any) => p.protocol === protocol)
      .flatMap((p: any) => p.models || [])
  )];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (models.length === 0) {
      setError(t('providers.validation.noModels'));
      return;
    }
    onSave(key, { display_name: displayName, base_url: baseUrl, api_key: apiKey, protocol, models });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div role="dialog" aria-modal="true" className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {initial?.key ? t('providers.edit', { key: initial.key }) : t('providers.new')}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label={t('common.close')}><X className="w-5 h-5" /></button>
        </div>
        {error && <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg p-2 text-sm mb-4">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{t('providers.basicInfo')}</h4>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('providers.keyLabel')}</label>
              <input value={key} onChange={(e) => setKey(e.target.value)} disabled={!!initial?.key}
                className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white disabled:opacity-50"
                placeholder={t('providers.keyPlaceholder')} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('providers.displayName')}</label>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                placeholder={t('providers.displayNamePlaceholder')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('providers.protocol')}</label>
              <select value={protocol} onChange={(e) => setProtocol(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                <option value="openai">{t('providers.protocolDesc.openai')}</option>
                <option value="openai-responses">{t('providers.protocolDesc.openai-responses')}</option>
                <option value="anthropic">{t('providers.protocolDesc.anthropic')}</option>
              </select>
            </div>
          </div>

          {/* Connection */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{t('providers.connection')}</h4>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('providers.baseUrl')}</label>
              <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                placeholder={t('providers.baseUrlPlaceholder')} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('providers.apiKey')}</label>
              <div className="relative">
                <input value={apiKey} onChange={(e) => setApiKey(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 pr-10 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  type={showApiKey ? 'text' : 'password'} placeholder={t('providers.apiKeyPlaceholder')} required />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label={showApiKey ? t('providers.hideKey') : t('providers.showKey')}
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Models */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{t('providers.modelsSection')}</h4>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('providers.modelsList')}</label>
              <ModelTagInput tags={models} onChange={setModels} />
            </div>
            {protocolPresetModels.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowModelImport(!showModelImport)}
                  className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
                >
                  {t('providers.importModels')} <ChevronDown className={`w-3 h-3 transition-transform ${showModelImport ? 'rotate-180' : ''}`} />
                </button>
                {showModelImport && (
                  <div className="absolute z-10 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-2 w-full max-h-48 overflow-auto">
                    <div className="flex flex-wrap gap-1">
                      {protocolPresetModels.map((model) => (
                        <button
                          key={model}
                          type="button"
                          onClick={() => { addModel(model); setShowModelImport(false); }}
                          disabled={models.includes(model)}
                          className="px-2 py-1 text-xs rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed"
                          title={model}
                        >
                          {model}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            {Object.keys(presetsData).length > 0 && protocolPresetModels.length === 0 && (
              <p className="text-xs text-gray-400">{t('providers.noPresetModels')}</p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg dark:text-gray-400 dark:hover:bg-gray-800">{t('providers.cancel')}</button>
            <button type="submit" className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">{t('providers.save')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
