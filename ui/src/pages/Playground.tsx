import { useState, useEffect, useRef } from 'react';
import { apiClient } from '../api/client';
import { Send, Loader2, Copy, Trash2 } from 'lucide-react';
import { t } from '../i18n';

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
  const [copied, setCopied] = useState(false);
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
                  chunk.delta?.text ||
                  chunk.content?.[0]?.text ||
                  (chunk.type === 'content_block_delta' ? chunk.delta?.text : '');
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
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">{t('playground.title')}</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('playground.endpoint')}</label>
            <select value={endpoint} onChange={(e) => setEndpoint(e.target.value)} className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
              <option value="/v1/chat/completions">/v1/chat/completions (OpenAI Chat)</option>
              <option value="/v1/messages">/v1/messages (Anthropic Messages)</option>
              <option value="/v1/responses">/v1/responses (OpenAI Responses)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('playground.model')}</label>
            <input value={model} onChange={(e) => setModel(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              placeholder={t('playground.modelPlaceholder')} list="model-list" />
            <datalist id="model-list">
              {models.map((m) => <option key={m} value={m} />)}
            </datalist>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('playground.systemPrompt')}</label>
            <textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} rows={2}
              className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('playground.userMessage')}</label>
            <textarea value={userMessage} onChange={(e) => setUserMessage(e.target.value)} rows={4}
              className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white" placeholder={t('playground.userMessagePlaceholder')} />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('playground.temperatureLabel', { value: temperature })}</label>
              <input type="range" min="0" max="2" step="0.1" value={temperature} onChange={(e) => setTemperature(parseFloat(e.target.value))} className="w-full" />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('playground.maxTokens')}</label>
              <input type="number" value={maxTokens} onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={stream} onChange={(e) => setStream(e.target.checked)} id="stream" />
            <label htmlFor="stream" className="text-sm text-gray-700 dark:text-gray-300">{t('playground.stream')}</label>
          </div>
          <button onClick={handleSend} disabled={loading || !model || !userMessage}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {loading ? t('playground.sending') : t('playground.send')}
          </button>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden flex flex-col max-h-[600px]">
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('playground.responseTitle')}</span>
              {loading && stream && (
                <span className="flex items-center gap-1 text-xs text-indigo-500">
                  <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
                  {t('playground.streaming')}
                </span>
              )}
              {loading && !stream && (
                <span className="flex items-center gap-1 text-xs text-indigo-500">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {t('playground.sending')}
                </span>
              )}
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => { navigator.clipboard.writeText(response); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                disabled={!response}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-30 rounded"
                aria-label={t('playground.copyResponse')}
              >
                {copied ? <span className="text-xs text-green-500">{t('playground.copied')}</span> : <Copy className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setResponse('')}
                disabled={!response}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-30 rounded"
                aria-label={t('playground.clearResponse')}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="p-4 overflow-auto flex-1">
            <pre ref={responseRef} className="text-gray-700 dark:text-green-400 text-sm whitespace-pre-wrap font-mono">{response || t('playground.response')}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}
