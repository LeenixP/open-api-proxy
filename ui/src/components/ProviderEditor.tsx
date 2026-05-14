import { useState } from 'react';
import { X } from 'lucide-react';
import ModelTagInput from './ModelTagInput';

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
  const [key, setKey] = useState(initial?.key || '');
  const [displayName, setDisplayName] = useState(initial?.display_name || '');
  const [baseUrl, setBaseUrl] = useState(initial?.base_url || '');
  const [apiKey, setApiKey] = useState(initial?.api_key || '');
  const [protocol, setProtocol] = useState(initial?.protocol || 'openai');
  const [models, setModels] = useState<string[]>(initial?.models || []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(key, { display_name: displayName, base_url: baseUrl, api_key: apiKey, protocol, models });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {initial?.key ? '编辑厂商' : '添加厂商'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Key (唯一标识)</label>
            <input value={key} onChange={(e) => setKey(e.target.value)} disabled={!!initial?.key}
              className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white disabled:opacity-50"
              placeholder="例如: openai, deepseek" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">显示名称</label>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              placeholder="例如: OpenAI" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Base URL</label>
            <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              placeholder="https://api.openai.com/v1" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">API Key</label>
            <input value={apiKey} onChange={(e) => setApiKey(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              type="password" placeholder="sk-... 或 ${ENV_VAR}" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">协议</label>
            <select value={protocol} onChange={(e) => setProtocol(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
              <option value="openai">OpenAI Chat Completions</option>
              <option value="openai-responses">OpenAI Responses</option>
              <option value="anthropic">Anthropic Messages</option>
              <option value="gemini">Google Gemini</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">模型列表</label>
            <ModelTagInput tags={models} onChange={setModels} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg dark:text-gray-400 dark:hover:bg-gray-800">取消</button>
            <button type="submit" className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">保存</button>
          </div>
        </form>
      </div>
    </div>
  );
}
