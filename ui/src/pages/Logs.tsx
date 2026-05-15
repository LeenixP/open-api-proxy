import { useState, useEffect, useRef, useCallback } from 'react';
import { apiClient } from '../api/client';
import { useLocale } from '../i18n/LocaleContext';

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';
type LevelFilter = 'all' | 'info' | 'warn' | 'error';

const MAX_RETRIES = 5;
const MAX_BACKOFF = 30000;

export default function Logs() {
  const { t } = useLocale();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<LevelFilter>('all');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [backoffSeconds, setBackoffSeconds] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const connect = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
    }

    const es = new EventSource('/api/logs/stream');
    esRef.current = es;

    es.onopen = () => {
      setConnectionStatus('connected');
      retryCountRef.current = 0;
      setBackoffSeconds(0);
    };

    es.onmessage = (e) => {
      try {
        const entry = JSON.parse(e.data);
        if (entry.type !== 'heartbeat' && entry.timestamp) {
          setLogs((prev) => [...prev.slice(-199), entry]);
        }
      } catch {}
    };

    es.onerror = () => {
      es.close();
      esRef.current = null;

      if (retryCountRef.current >= MAX_RETRIES) {
        setConnectionStatus('disconnected');
        setBackoffSeconds(0);
        return;
      }

      setConnectionStatus('reconnecting');
      const backoff = Math.min(1000 * Math.pow(2, retryCountRef.current), MAX_BACKOFF);
      retryCountRef.current += 1;
      setBackoffSeconds(Math.ceil(backoff / 1000));

      // Countdown ticker
      if (countdownRef.current) clearInterval(countdownRef.current);
      countdownRef.current = setInterval(() => {
        setBackoffSeconds((prev) => {
          if (prev <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      retryTimerRef.current = setTimeout(() => {
        if (countdownRef.current) clearInterval(countdownRef.current);
        connect();
      }, backoff);
    };
  }, []);

  const handleReconnect = () => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    retryCountRef.current = 0;
    setBackoffSeconds(0);
    connect();
  };

  const handleRetryLogs = () => {
    setLoadError(null);
    apiClient.getLogs().then((data) => {
      if (Array.isArray(data) && data.length > 0) {
        setLogs(data.slice(-200));
      }
    }).catch((err: Error) => {
      setLoadError(err.message || 'Failed to load logs');
    });
  };

  useEffect(() => {
    // Load initial log history
    apiClient.getLogs().then((data) => {
      if (Array.isArray(data) && data.length > 0) {
        setLogs(data.slice(-200));
      }
    }).catch((err: Error) => {
      setLoadError(err.message || 'Failed to load logs');
    });

    // Start SSE connection
    connect();

    return () => {
      if (esRef.current) esRef.current.close();
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [connect]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  const filteredLogs = filter === 'all' ? logs : logs.filter((l) => l.level === filter);

  const statusColor = connectionStatus === 'connected'
    ? 'text-green-600 dark:text-green-400'
    : connectionStatus === 'reconnecting'
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-red-600 dark:text-red-400';

  const statusLabel = connectionStatus === 'connected'
    ? t('logs.connected')
    : connectionStatus === 'reconnecting'
      ? backoffSeconds > 0
        ? t('logs.reconnectingIn', { seconds: backoffSeconds })
        : t('logs.reconnecting')
      : t('logs.disconnected');

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t('logs.title')}</h2>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-medium ${statusColor}`}>{statusLabel}</span>
          {(connectionStatus === 'disconnected' || connectionStatus === 'reconnecting') && (
            <button onClick={handleReconnect} className="text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-200 font-medium">
              {t('logs.reconnectNow')}
            </button>
          )}
          <button onClick={() => setLogs([])} className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            {t('logs.clear')}
          </button>
        </div>
      </div>

      {/* Level Filter */}
      <div className="flex gap-1 mb-4">
        {(['all', 'error', 'warn', 'info'] as LevelFilter[]).map((level) => (
          <button
            key={level}
            onClick={() => setFilter(level)}
            aria-pressed={filter === level}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              filter === level
                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
            }`}
          >
            {level === 'all' ? t('logs.filterAll') : level}
          </button>
        ))}
      </div>

      <div ref={containerRef} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 h-[500px] overflow-auto font-mono text-xs">
        {filteredLogs.map((entry, i) => (
          <div key={i} className="flex gap-3 py-0.5">
            <span className="text-gray-500 dark:text-gray-400 shrink-0">{new Date(entry.timestamp).toLocaleTimeString()}</span>
            <span className={`shrink-0 w-10 ${entry.level === 'error' ? 'text-red-600 dark:text-red-400' : entry.level === 'warn' ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'}`}>{entry.level}</span>
            <span className="text-gray-700 dark:text-gray-300">{entry.message}</span>
          </div>
        ))}
        {filteredLogs.length === 0 && (
          loadError ? (
            <div className="flex flex-col items-center gap-2 py-8">
              <span className="text-red-500 dark:text-red-400">{t('logs.loadError')}{loadError ? `: ${loadError}` : ''}</span>
              <button onClick={handleRetryLogs} className="text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-200 font-medium">
                {t('common.retry')}
              </button>
            </div>
          ) : (
            <span className="text-gray-400 dark:text-gray-500">{t('logs.waiting')}</span>
          )
        )}
      </div>
    </div>
  );
}
