import { useState, useEffect, useRef } from 'react';
import { apiClient } from '../api/client';
import { Send, Loader2 } from 'lucide-react';

export default function Playground() {
  const [endpoint, setEndpoint] = useState('/v1/chat/completions');
  const [model, setModel] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [userMessage, setUserMessage] = useState('');
  const [stream, setStream] = useState(true);
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(4096);
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const responseRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    apiClient.getModels().then((data) => {
      setModels(data.data?.map((m: any) => m.id) || []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (responseRef.current) responseRef.current.scrollTop = responseRef.current.scrollHeight;
  }, [response]);

  const handleSend = async () => {
    if (!model || !userMessage) return;
    setLoading(true);
    setResponse('');

    const body: any = {
      model,
      messages: [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        { role: 'user', content: userMessage },
      ],
      stream,
      temperature,
    };

    if (endpoint === '/v1/chat/completions') {
      body.max_completion_tokens = maxTokens;
    } else if (endpoint === '/v1/messages') {
      body.max_tokens = maxTokens;
    } else if (endpoint === '/v1/responses') {
      body.max_output_tokens = maxTokens;
    }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.text();
        setResponse(`Error ${res.status}: ${err}`);
        setLoading(false);
        return;
      }

      if (stream && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (line.startsWith('data: ') && line !== 'data: [DONE]') {
              try {
                const chunk = JSON.parse(line.slice(6));
                const content = chunk.choices?.[0]?.delta?.content ||
                  chunk.delta?.text || chunk.content?.[0]?.text ||
                  chunk.type === 'content_block_delta' ? chunk.delta?.text : '';
                if (content) setResponse((prev) => prev + content);
              } catch {}
            }
          }
        }
      } else {
        const data = await res.json();
        setResponse(JSON.stringify(data, null, 2));
      }
    } catch (err: any) {
      setResponse(`Error: ${err.message}`);
    }
    setLoading(false);
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">API 测试</h2>
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">端点</label>
            <select value={endpoint} onChange={(e) => setEndpoint(e.target.value)} className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
              <option value="/v1/chat/completions">/v1/chat/completions (OpenAI Chat)</option>
              <option value="/v1/messages">/v1/messages (Anthropic Messages)</option>
              <option value="/v1/responses">/v1/responses (OpenAI Responses)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Model (provider/model)</label>
            <input value={model} onChange={(e) => setModel(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              placeholder="例如: openai/gpt-4o" list="model-list" />
            <datalist id="model-list">
              {models.map((m) => <option key={m} value={m} />)}
            </datalist>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">System Prompt</label>
            <textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} rows={2}
              className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">User Message</label>
            <textarea value={userMessage} onChange={(e) => setUserMessage(e.target.value)} rows={4}
              className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white" placeholder="输入你的消息..." />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Temperature: {temperature}</label>
              <input type="range" min="0" max="2" step="0.1" value={temperature} onChange={(e) => setTemperature(parseFloat(e.target.value))} className="w-full" />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max Tokens</label>
              <input type="number" value={maxTokens} onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={stream} onChange={(e) => setStream(e.target.checked)} id="stream" />
            <label htmlFor="stream" className="text-sm text-gray-700 dark:text-gray-300">流式输出</label>
          </div>
          <button onClick={handleSend} disabled={loading || !model || !userMessage}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {loading ? '请求中...' : '发送'}
          </button>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 overflow-auto max-h-[600px]">
          <pre ref={responseRef} className="text-green-400 text-sm whitespace-pre-wrap font-mono">{response || '响应将显示在这里...'}</pre>
        </div>
      </div>
    </div>
  );
}
