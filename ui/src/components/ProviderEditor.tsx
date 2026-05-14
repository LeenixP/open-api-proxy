import { useState } from 'react';
import { X } from 'lucide-react';
import ModelTagInput from './ModelTagInput';
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
  const [error, setError] = useState('');

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
        <form onSubmit={handleSubmit} className="space-y-4">
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('providers.baseUrl')}</label>
            <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              placeholder={t('providers.baseUrlPlaceholder')} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('providers.apiKey')}</label>
            <input value={apiKey} onChange={(e) => setApiKey(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              type="password" placeholder={t('providers.apiKeyPlaceholder')} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('providers.protocol')}</label>
            <select value={protocol} onChange={(e) => setProtocol(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
              <option value="openai">OpenAI Chat Completions</option>
              <option value="openai-responses">OpenAI Responses</option>
              <option value="anthropic">Anthropic Messages</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('providers.modelsList')}</label>
            <ModelTagInput tags={models} onChange={setModels} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg dark:text-gray-400 dark:hover:bg-gray-800">{t('providers.cancel')}</button>
            <button type="submit" className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">{t('providers.save')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
