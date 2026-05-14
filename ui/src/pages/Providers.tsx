import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import ProviderEditor from '../components/ProviderEditor';

export default function Providers() {
  const [providers, setProviders] = useState<Record<string, any>>({});
  const [editing, setEditing] = useState<{ key: string; data: any } | 'new' | null>(null);
  const [error, setError] = useState('');

  const load = () => {
    apiClient.getProviders().then(setProviders).catch((err) => setError(err.message));
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (key: string, data: any) => {
    try {
      if (editing === 'new') {
        await apiClient.createProvider(key, data);
      } else {
        await apiClient.updateProvider(key, data);
      }
      setEditing(null);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (key: string) => {
    if (!confirm(`Delete provider "${key}"?`)) return;
    try {
      await apiClient.deleteProvider(key);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">厂商管理</h2>
        <button onClick={() => setEditing('new')} className="flex items-center gap-1 bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-indigo-700">
          <Plus className="w-4 h-4" /> 添加厂商
        </button>
      </div>

      {error && <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg p-3 text-sm mb-4">{error}</div>}

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
            <tr>
              <th className="text-left px-4 py-3 font-medium">名称</th>
              <th className="text-left px-4 py-3 font-medium">Key</th>
              <th className="text-left px-4 py-3 font-medium">协议</th>
              <th className="text-left px-4 py-3 font-medium">模型数</th>
              <th className="text-left px-4 py-3 font-medium">Base URL</th>
              <th className="text-right px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {Object.entries(providers).map(([key, p]) => (
              <tr key={key} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-4 py-3 text-gray-900 dark:text-white font-medium">{p.display_name || key}</td>
                <td className="px-4 py-3 text-gray-500">{key}</td>
                <td className="px-4 py-3">
                  <span className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded text-xs">{p.protocol}</span>
                </td>
                <td className="px-4 py-3 text-gray-500">{p.models?.length || 0}</td>
                <td className="px-4 py-3 text-gray-400 font-mono text-xs truncate max-w-[200px]">{p.base_url}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => setEditing({ key, data: p })} className="text-gray-400 hover:text-indigo-500 mr-2"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(key)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
            {Object.keys(providers).length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">暂无厂商，点击"添加厂商"开始</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <ProviderEditor
          initial={editing === 'new' ? undefined : { key: editing.key, ...editing.data }}
          onSave={handleSave}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
