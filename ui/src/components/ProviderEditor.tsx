import { useState, useEffect } from 'react';
import { Eye, EyeOff, ChevronDown } from 'lucide-react';
import ModelTagInput from './ModelTagInput';
import { apiClient } from '../api/client';
import { useLocale } from '../i18n/LocaleContext';
import Modal from './ui/Modal';
import Input from './ui/Input';
import Select from './ui/Select';
import Button from './ui/Button';

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
  const { t } = useLocale();
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
    <Modal
      open={true}
      onClose={onClose}
      title={initial?.key ? t('providers.edit', { key: initial.key }) : t('providers.new')}
      size="md"
    >
      {error && <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg p-2 text-sm mb-4">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{t('providers.basicInfo')}</h4>
          <Input
            label={t('providers.keyLabel')}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            disabled={!!initial?.key}
            placeholder={t('providers.keyPlaceholder')}
            required
          />
          <Input
            label={t('providers.displayName')}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={t('providers.displayNamePlaceholder')}
          />
          <Select
            label={t('providers.protocol')}
            value={protocol}
            onChange={(e) => setProtocol(e.target.value)}
          >
            <option value="openai">{t('providers.protocolDesc.openai')}</option>
            <option value="openai-responses">{t('providers.protocolDesc.openai-responses')}</option>
            <option value="anthropic">{t('providers.protocolDesc.anthropic')}</option>
          </Select>
        </div>

        {/* Connection */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{t('providers.connection')}</h4>
          <Input
            label={t('providers.baseUrl')}
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={t('providers.baseUrlPlaceholder')}
            required
          />
          <Input
            label={t('providers.apiKey')}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            type={showApiKey ? 'text' : 'password'}
            placeholder={t('providers.apiKeyPlaceholder')}
            required
            trailingIcon={
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="text-gray-400 hover:text-gray-600"
                aria-label={showApiKey ? t('providers.hideKey') : t('providers.showKey')}
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
          />
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
          <Button type="button" variant="ghost" onClick={onClose}>{t('providers.cancel')}</Button>
          <Button type="submit">{t('providers.save')}</Button>
        </div>
      </form>
    </Modal>
  );
}
