import { useState, useEffect } from 'react';
import { Plus, Download, Check } from 'lucide-react';
import { apiClient } from '../api/client';
import { useLocale } from '../i18n/LocaleContext';
import Button from './ui/Button';
import type { PresetItem } from '../types';

type EmptyStateNamespace = 'dashboard' | 'providers';

interface EmptyStateProps {
  namespace: EmptyStateNamespace;
  onAddManually: () => void;
  onImported: () => void;
}

export default function EmptyState({ namespace, onAddManually, onImported }: EmptyStateProps) {
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

  const keys = {
    emptyTitle: t(`${namespace}.emptyTitle`),
    emptyDesc: t(`${namespace}.emptyDesc`),
    addManually: namespace === 'dashboard' ? t('dashboard.addManually') : t('providers.emptyAddManually'),
    popularPresets: namespace === 'dashboard' ? t('dashboard.popularPresets') : t('providers.emptyPresetsTitle'),
    presetsHint: namespace === 'dashboard' ? t('dashboard.importPresetHint') : t('providers.emptyPresetsHint'),
    importLabel: namespace === 'dashboard' ? t('dashboard.import') : t('providers.emptyImport'),
    importedLabel: namespace === 'dashboard' ? t('dashboard.imported') : t('providers.emptyImported'),
    importingLabel: namespace === 'dashboard' ? t('dashboard.importing') : t('providers.emptyImporting'),
  };

  return (
    <div>
      {/* Welcome message */}
      <div className="text-center py-8 mb-6">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
          <Download className="w-8 h-8 text-indigo-500" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{keys.emptyTitle}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">{keys.emptyDesc}</p>
        <div className="mt-4">
          <Button onClick={onAddManually}>
            <Plus className="w-4 h-4" />
            {keys.addManually}
          </Button>
        </div>
      </div>

      {/* Popular presets */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">{keys.popularPresets}</h3>
          <span className="text-xs text-gray-400">{keys.presetsHint}</span>
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
                  <p className="text-xs text-gray-400 mb-2">
                    {namespace === 'dashboard'
                      ? t('dashboard.modelsCount', { count: preset.models.length })
                      : t('providers.emptyModelsCount', { count: preset.models.length })}
                  </p>
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
                        {keys.importedLabel}
                      </>
                    ) : isThisImporting ? (
                      keys.importingLabel
                    ) : (
                      <>
                        <Download className="w-3 h-3" />
                        {keys.importLabel}
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
