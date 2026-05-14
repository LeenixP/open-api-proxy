import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';

export default function Settings() {
  const [config, setConfig] = useState<any>(null);
  const [saved, setSaved] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<any>(null);

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
      alert('Save failed: ' + err.message);
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
        alert('Config imported successfully');
      } catch (err: any) {
        alert('Import failed: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  if (!config) return <div className="text-gray-400">加载中...</div>;

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">系统设置</h2>

      <div className="space-y-6 max-w-2xl">
        <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
          <h3 className="font-medium text-gray-900 dark:text-white mb-3">服务器</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">端口</label>
              <input type="number" value={config.server?.port || 6312}
                onChange={(e) => setConfig({ ...config, server: { ...config.server, port: parseInt(e.target.value) || 6312 } })}
                className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Host</label>
              <input value={config.server?.host || '0.0.0.0'}
                onChange={(e) => setConfig({ ...config, server: { ...config.server, host: e.target.value } })}
                className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
            </div>
          </div>
        </section>

        <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
          <h3 className="font-medium text-gray-900 dark:text-white mb-3">代理参数</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">超时 (ms)</label>
              <input type="number" value={config.proxy?.timeout || 120000}
                onChange={(e) => setConfig({ ...config, proxy: { ...config.proxy, timeout: parseInt(e.target.value) || 120000 } })}
                className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">日志级别</label>
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
          <h3 className="font-medium text-gray-900 dark:text-white mb-3">版本更新</h3>
          <p className="text-sm text-gray-500 mb-2">
            当前版本: {updateInfo?.current || '-'}
            {updateInfo?.hasUpdate ? ` -> ${updateInfo.latest} (新版本可用)` : ' (已是最新)'}
          </p>
        </section>

        <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
          <h3 className="font-medium text-gray-900 dark:text-white mb-3">配置导入/导出</h3>
          <div className="flex gap-3">
            <button onClick={handleExport} className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700">
              导出配置
            </button>
            <label className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer">
              导入配置
              <input type="file" accept=".json,.yaml" onChange={handleImport} className="hidden" />
            </label>
          </div>
        </section>

        <button onClick={handleSave} className="bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-indigo-700">
          {saved ? '✓ 已保存' : '保存设置'}
        </button>
      </div>
    </div>
  );
}
