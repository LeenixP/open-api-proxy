import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { useLocale } from '../i18n/LocaleContext';

export default function UpdateBanner() {
  const { t } = useLocale();
  const [update, setUpdate] = useState<{ current: string; latest: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [authKey, setAuthKey] = useState('');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient.checkUpdate()
      .then((data) => { if (data.hasUpdate) setUpdate(data); })
      .catch(() => {});
  }, []);

  if (!update) return null;

  const doUpdate = async (token?: string) => {
    setLoading(true);
    setError('');
    try {
      await apiClient.executeUpdate(token || undefined);
      setSuccess(true);
      setShowAuthPrompt(false);
      setTimeout(() => window.location.reload(), 3000);
    } catch (err) {
      setLoading(false);
      const msg = (err as Error).message;
      if (msg.includes('Authentication required') || msg.includes('401')) {
        setShowAuthPrompt(true);
      } else {
        setError(msg);
      }
    }
  };

  const handleUpdate = async () => {
    // Try without auth first
    await doUpdate();
  };

  const handleAuthSubmit = async () => {
    if (!authKey.trim()) return;
    await doUpdate(authKey.trim());
  };

  return (
    <div className="bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800 px-4 py-2 text-sm">
      {showAuthPrompt ? (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-amber-800 dark:text-amber-200">
            {t('update.authRequired')}
          </span>
          <input
            type="password"
            value={authKey}
            onChange={(e) => setAuthKey(e.target.value)}
            placeholder={t('update.authPlaceholder')}
            className="border border-amber-300 dark:border-amber-700 rounded px-2 py-0.5 text-xs bg-white dark:bg-gray-800 dark:text-gray-200"
            onKeyDown={(e) => { if (e.key === 'Enter') handleAuthSubmit(); }}
            autoFocus
          />
          <button
            onClick={handleAuthSubmit}
            disabled={loading || !authKey.trim()}
            className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1 rounded text-xs font-medium disabled:opacity-50"
          >
            {loading ? t('update.upgrading') : t('update.upgrade')}
          </button>
          <button
            onClick={() => setShowAuthPrompt(false)}
            className="text-amber-600 dark:text-amber-400 hover:underline text-xs"
          >
            {t('common.close')}
          </button>
        </div>
      ) : success ? (
        <div className="flex items-center justify-between">
          <span className="text-green-700 dark:text-green-300 font-medium">
            {t('update.success')}
          </span>
        </div>
      ) : (
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="text-amber-800 dark:text-amber-200">
            {t('update.available', { latest: update.latest, current: update.current })}
          </span>
          <div className="flex items-center gap-2">
            {error && (
              <span className="text-red-600 dark:text-red-400 text-xs">{error}</span>
            )}
            <button
              onClick={handleUpdate}
              disabled={loading}
              className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1 rounded text-xs font-medium disabled:opacity-50"
            >
              {loading ? t('update.upgrading') : t('update.upgrade')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
