import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import type { AppConfig } from '../api/client';
import { X, Check } from 'lucide-react';
import { useLocale } from '../i18n/LocaleContext';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';

export default function Settings() {
  const { t } = useLocale();
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [statusType, setStatusType] = useState<'success' | 'error'>('success');
  const [importing, setImporting] = useState(false);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [pendingImport, setPendingImport] = useState<AppConfig | null>(null);

  const showStatus = (msg: string, type: 'success' | 'error' = 'success') => {
    setStatusMessage(msg);
    setStatusType(type);
    if (type === 'success') setTimeout(() => setStatusMessage(''), 3000);
  };

  const loadConfig = () => {
    setError(null);
    apiClient.getConfig().then(setConfig).catch((err: Error) => {
      setError(err.message);
    });
  };

  useEffect(() => {
    loadConfig();
    apiClient.checkUpdate().then(setUpdateInfo).catch(() => {});
  }, []);

  const handleSave = async () => {
    if (!config) return;
    try {
      await apiClient.updateConfig(config);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      showStatus(t('settings.saveFailed', { error: err.message }), 'error');
    }
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'config-export.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target?.result as string) as AppConfig;
        setPendingImport(imported);
        setShowImportConfirm(true);
      } catch (err: any) {
        showStatus(t('settings.importFailed', { error: err.message }), 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleConfirmImport = async () => {
    if (!pendingImport) return;
    setShowImportConfirm(false);
    setImporting(true);
    try {
      await apiClient.updateConfig(pendingImport);
      setConfig(pendingImport);
      showStatus(t('settings.importSuccess'));
    } catch (err: any) {
      showStatus(t('settings.importFailed', { error: err.message }), 'error');
    } finally {
      setImporting(false);
      setPendingImport(null);
    }
  };

  const handleCancelImport = () => {
    setShowImportConfirm(false);
    setPendingImport(null);
  };

  if (!config) {
    if (error) {
      return (
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-red-600 dark:text-red-400 text-sm mb-4">{t('settings.loadError')}: {error}</p>
          <Button variant="secondary" onClick={loadConfig}>{t('common.retry')}</Button>
        </div>
      );
    }
    return (
      <div className="animate-pulse">
        <div className="h-7 w-40 bg-gray-200 dark:bg-gray-700 rounded mb-6" />
        <div className="space-y-6 max-w-2xl">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
              <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-3" />
              <div className="grid grid-cols-2 gap-4">
                <div className="h-9 bg-gray-200 dark:bg-gray-700 rounded-lg" />
                <div className="h-9 bg-gray-200 dark:bg-gray-700 rounded-lg" />
              </div>
            </div>
          ))}
          <div className="h-10 w-24 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">{t('settings.title')}</h2>

      {statusMessage && (
        <div className={`rounded-lg p-3 text-sm mb-4 flex items-center justify-between ${
          statusType === 'success'
            ? 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400'
            : 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400'
        }`}>
          <span>{statusMessage}</span>
          <button onClick={() => setStatusMessage('')} className="opacity-60 hover:opacity-100"><X className="w-4 h-4" /></button>
        </div>
      )}

      {importing && (
        <div className="rounded-lg p-3 text-sm mb-4 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
          {t('common.loading')}
        </div>
      )}

      <div className="space-y-6 max-w-2xl">
        <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
          <h3 className="font-medium text-gray-900 dark:text-white mb-3">{t('settings.server')}</h3>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('settings.port')}
              type="number"
              value={config.server?.port || 6312}
              onChange={(e) => setConfig({ ...config, server: { ...config.server, port: parseInt(e.target.value) || 6312 } })}
            />
            <Input
              label={t('settings.host')}
              value={config.server?.host || '0.0.0.0'}
              onChange={(e) => setConfig({ ...config, server: { ...config.server, host: e.target.value } })}
            />
          </div>
        </section>

        <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
          <h3 className="font-medium text-gray-900 dark:text-white mb-3">{t('settings.proxy')}</h3>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('settings.timeout')}
              type="number"
              value={config.proxy?.timeout || 120000}
              onChange={(e) => setConfig({ ...config, proxy: { ...config.proxy, timeout: parseInt(e.target.value) || 120000 } })}
            />
            <Select
              label={t('settings.logLevel')}
              value={config.logging?.level || 'info'}
              onChange={(e) => setConfig({ ...config, logging: { ...config.logging, level: e.target.value } })}
            >
              <option value="debug">debug</option>
              <option value="info">info</option>
              <option value="warn">warn</option>
              <option value="error">error</option>
            </Select>
          </div>
        </section>

        <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
          <h3 className="font-medium text-gray-900 dark:text-white mb-3">{t('settings.conversions')}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { key: 'anthropic_to_openai', label: 'Anthropic → OpenAI Chat' },
              { key: 'openai_to_anthropic', label: 'OpenAI Chat → Anthropic' },
              { key: 'anthropic_to_openai_responses', label: 'Anthropic → OpenAI Responses' },
              { key: 'openai_to_anthropic_responses', label: 'OpenAI → Anthropic Responses' },
              { key: 'openai_chat_to_responses', label: 'OpenAI Chat → Responses' },
              { key: 'responses_to_openai_chat', label: 'Responses → OpenAI Chat' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.conversions?.[key as keyof typeof config.conversions] ?? true}
                  onChange={(e) => setConfig({
                    ...config,
                    conversions: { ...config.conversions, [key]: e.target.checked }
                  })}
                  className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
              </label>
            ))}
          </div>
        </section>

        <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
          <h3 className="font-medium text-gray-900 dark:text-white mb-3">{t('settings.version')}</h3>
          <p className="text-sm text-gray-500 mb-2">
            {t('settings.currentVersion')}: {updateInfo?.current || '-'}
            {updateInfo?.hasUpdate ? ` -> ${updateInfo.latest} (${t('settings.newVersion')})` : ` (${t('settings.latestVersion')})`}
          </p>
        </section>

        <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
          <h3 className="font-medium text-gray-900 dark:text-white mb-3">{t('settings.importExport')}</h3>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={handleExport}>
              {t('settings.export')}
            </Button>
            <label className="inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-colors px-4 py-2 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer">
              {t('settings.import')}
              <input type="file" accept=".json,.yaml" onChange={handleImport} className="hidden" />
            </label>
          </div>
          <p className="text-xs text-gray-500 mt-2">{t('settings.importExportHint')}</p>
        </section>

        <Button onClick={handleSave}>
          {saved ? <><Check className="w-4 h-4 inline-block" /> {t('settings.saved')}</> : t('settings.save')}
        </Button>
      </div>

      <Modal
        open={showImportConfirm}
        onClose={handleCancelImport}
        title={t('settings.importConfirmTitle')}
        size="sm"
      >
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          {t('settings.importConfirm')}
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={handleCancelImport}>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" onClick={handleConfirmImport}>
            {t('common.confirm')}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
