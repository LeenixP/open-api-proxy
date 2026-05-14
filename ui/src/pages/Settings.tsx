import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { X } from 'lucide-react';
import { t } from '../i18n';

export default function Settings() {
  const [config, setConfig] = useState<any>(null);
  const [saved, setSaved] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [statusType, setStatusType] = useState<'success' | 'error'>('success');

  const showStatus = (msg: string, type: 'success' | 'error' = 'success') => {
    setStatusMessage(msg);
    setStatusType(type);
    if (type === 'success') setTimeout(() => setStatusMessage(''), 3000);
  };

  useEffect(() => {
    apiClient.getConfig().then(setConfig).catch(() => {});
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
    reader.onload = async (ev) => {
      try {
        const imported = JSON.parse(ev.target?.result as string);
        await apiClient.updateConfig(imported);
        setConfig(imported);
        showStatus(t('settings.importSuccess'));
      } catch (err: any) {
        showStatus(t('settings.importFailed', { error: err.message }), 'error');
      }
    };
    reader.readAsText(file);
  };

  if (!config) return <div className="text-gray-400">{t('settings.loading')}</div>;

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

      <div className="space-y-6 max-w-2xl">
        <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
          <h3 className="font-medium text-gray-900 dark:text-white mb-3">{t('settings.server')}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">{t('settings.port')}</label>
              <input type="number" value={config.server?.port || 6312}
                onChange={(e) => setConfig({ ...config, server: { ...config.server, port: parseInt(e.target.value) || 6312 } })}
                className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">{t('settings.host')}</label>
              <input value={config.server?.host || '0.0.0.0'}
                onChange={(e) => setConfig({ ...config, server: { ...config.server, host: e.target.value } })}
                className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
            </div>
          </div>
        </section>

        <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
          <h3 className="font-medium text-gray-900 dark:text-white mb-3">{t('settings.proxy')}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">{t('settings.timeout')}</label>
              <input type="number" value={config.proxy?.timeout || 120000}
                onChange={(e) => setConfig({ ...config, proxy: { ...config.proxy, timeout: parseInt(e.target.value) || 120000 } })}
                className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">{t('settings.logLevel')}</label>
              <select value={config.logging?.level || 'info'}
                onChange={(e) => setConfig({ ...config, logging: { ...config.logging, level: e.target.value } })}
                className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                <option value="debug">debug</option>
                <option value="info">info</option>
                <option value="warn">warn</option>
                <option value="error">error</option>
              </select>
            </div>
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
                  checked={config.conversions?.[key] ?? true}
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
            <button onClick={handleExport} className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700">
              {t('settings.export')}
            </button>
            <label className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer">
              {t('settings.import')}
              <input type="file" accept=".json,.yaml" onChange={handleImport} className="hidden" />
            </label>
          </div>
          <p className="text-xs text-gray-500 mt-2">{t('settings.importExportHint')}</p>
        </section>

        <button onClick={handleSave} className="bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-indigo-700">
          {saved ? `✓ ${t('settings.saved')}` : t('settings.save')}
        </button>
      </div>
    </div>
  );
}
