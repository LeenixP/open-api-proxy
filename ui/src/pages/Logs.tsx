import { useState, useEffect, useRef } from 'react';

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

export default function Logs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const es = new EventSource('/api/logs/stream');

    es.onmessage = (e) => {
      try {
        const entry = JSON.parse(e.data);
        if (entry.type !== 'heartbeat' && entry.timestamp) {
          setLogs((prev) => [...prev.slice(-199), entry]);
        }
      } catch {}
    };

    es.onerror = () => { es.close(); };

    return () => es.close();
  }, []);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">实时日志</h2>
        <button onClick={() => setLogs([])} className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          清空
        </button>
      </div>
      <div ref={containerRef} className="bg-gray-900 rounded-xl p-4 h-[500px] overflow-auto font-mono text-xs">
        {logs.map((entry, i) => (
          <div key={i} className="flex gap-3 py-0.5">
            <span className="text-gray-500 shrink-0">{new Date(entry.timestamp).toLocaleTimeString()}</span>
            <span className={`shrink-0 w-10 ${entry.level === 'error' ? 'text-red-400' : entry.level === 'warn' ? 'text-amber-400' : 'text-gray-400'}`}>{entry.level}</span>
            <span className="text-gray-300">{entry.message}</span>
          </div>
        ))}
        {logs.length === 0 && <span className="text-gray-500">等待日志...</span>}
      </div>
    </div>
  );
}
