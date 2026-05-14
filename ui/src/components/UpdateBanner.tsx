import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';

export default function UpdateBanner() {
  const [update, setUpdate] = useState<{ current: string; latest: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiClient.checkUpdate()
      .then((data) => { if (data.hasUpdate) setUpdate(data); })
      .catch(() => {});
  }, []);

  if (!update) return null;

  const handleUpdate = async () => {
    if (!confirm(`确认升级到 ${update.latest}？服务将自动重启。`)) return;
    setLoading(true);
    try {
      await apiClient.executeUpdate();
      setTimeout(() => window.location.reload(), 3000);
    } catch {
      setLoading(false);
    }
  };

  return (
    <div className="bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800 px-4 py-2 flex items-center justify-between text-sm">
      <span className="text-amber-800 dark:text-amber-200">
        新版本 {update.latest} 可用 (当前 {update.current})
      </span>
      <button
        onClick={handleUpdate}
        disabled={loading}
        className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1 rounded text-xs font-medium disabled:opacity-50"
      >
        {loading ? '升级中...' : '立即升级'}
      </button>
    </div>
  );
}
