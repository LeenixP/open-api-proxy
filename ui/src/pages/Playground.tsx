import { useState, useEffect, useRef, useMemo } from 'react';
import { apiClient } from '../api/client';
import { Send, Loader2, Copy, Trash2, ArrowDown } from 'lucide-react';
import { useLocale } from '../i18n/LocaleContext';
import type { PlaygroundContext } from '../App';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';

const ENDPOINT_PROTOCOLS: Record<string, string> = {
  '/v1/chat/completions': 'OpenAI Chat',
  '/v1/messages': 'Anthropic Messages',
  '/v1/responses': 'OpenAI Responses',
};

const PROTOCOL_DISPLAY: Record<string, string> = {
  'openai': 'OpenAI Chat',
  'openai-responses': 'OpenAI Responses',
  'anthropic': 'Anthropic Messages',
};

const CONVERSION_KEY_MAP: Record<string, Record<string, string>> = {
  'OpenAI Chat': {
    'Anthropic Messages': 'openai_to_anthropic',
    'OpenAI Responses': 'openai_chat_to_responses',
  },
  'Anthropic Messages': {
    'OpenAI Chat': 'anthropic_to_openai',
    'OpenAI Responses': 'anthropic_to_openai_responses',
  },
  'OpenAI Responses': {
    'OpenAI Chat': 'responses_to_openai_chat',
    'Anthropic Messages': 'openai_to_anthropic_responses',
  },
};

interface ConversionInfo {
  clientProtocol: string;
  clientEndpoint: string;
  providerKey: string | null;
  provider: any;
  modelName: string | null;
  upstreamProtocol: string | null;
  upstreamBaseUrl: string | null;
  needsConversion: boolean;
  conversionKey: string | null;
  conversionEnabled: boolean;
}

interface PlaygroundProps {
  initialContext?: PlaygroundContext | null;
  onContextConsumed?: () => void;
}

export default function Playground({ initialContext, onContextConsumed }: PlaygroundProps) {
  const { t } = useLocale();
  const [endpoint, setEndpoint] = useState('/v1/chat/completions');
  const [model, setModel] = useState('');
  const [selectedProviderKey, setSelectedProviderKey] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [userMessage, setUserMessage] = useState('');
  const [stream, setStream] = useState(true);
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(4096);
  const [response, setResponse] = useState('');
  const [responseIsError, setResponseIsError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [providers, setProviders] = useState<Record<string, any>>({});
  const [config, setConfig] = useState<any>(null);
  const responseRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    apiClient.getProviders().then(setProviders).catch(() => {});
    apiClient.getConfig().then(setConfig).catch(() => {});
    apiClient.getModels().then((data) => {
      setModels(data.data?.map((m: any) => m.id) || []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (initialContext && Object.keys(providers).length > 0) {
      setSelectedProviderKey(initialContext.providerKey);
      setModel(initialContext.model);
      const slashIdx = initialContext.model.indexOf('/');
      if (slashIdx > 0) {
        setSelectedModelName(initialContext.model.substring(slashIdx + 1));
      }
      onContextConsumed?.();
    }
  }, [initialContext, providers]);

  useEffect(() => {
    if (responseRef.current) responseRef.current.scrollTop = responseRef.current.scrollHeight;
  }, [response]);

  const conversionInfo: ConversionInfo = useMemo(() => {
    const clientProtocol = ENDPOINT_PROTOCOLS[endpoint] || endpoint;

    let providerKey = selectedProviderKey;
    let modelName: string | null = model || null;

    const slashIdx = model.indexOf('/');
    if (slashIdx > 0) {
      const parsed = model.substring(0, slashIdx);
      if (providers[parsed]) {
        providerKey = parsed;
      }
      modelName = model.substring(slashIdx + 1) || null;
    }

    if (!providerKey || !providers[providerKey]) {
      return {
        clientProtocol,
        clientEndpoint: endpoint,
        providerKey: providerKey || null,
        provider: null,
        modelName,
        upstreamProtocol: null,
        upstreamBaseUrl: null,
        needsConversion: false,
        conversionKey: null,
        conversionEnabled: true,
      };
    }

    const provider = providers[providerKey];
    const upstreamProtocol = PROTOCOL_DISPLAY[provider.protocol] || provider.protocol;
    const needsConversion = clientProtocol !== upstreamProtocol;

    let conversionKey: string | null = null;
    if (needsConversion) {
      conversionKey = CONVERSION_KEY_MAP[clientProtocol]?.[upstreamProtocol] || null;
    }

    const conversionEnabled = conversionKey ? (config?.conversions?.[conversionKey] ?? true) : true;

    return {
      clientProtocol,
      clientEndpoint: endpoint,
      providerKey,
      provider,
      modelName,
      upstreamProtocol,
      upstreamBaseUrl: provider.base_url,
      needsConversion,
      conversionKey,
      conversionEnabled,
    };
  }, [endpoint, model, selectedProviderKey, providers, config]);

  const [selectedModelName, setSelectedModelName] = useState('');

  const handleProviderChange = (providerKey: string) => {
    setSelectedProviderKey(providerKey);
    setSelectedModelName('');
    if (providerKey && providers[providerKey]) {
      const providerModels = providers[providerKey].models || [];
      if (providerModels.length > 0) {
        setSelectedModelName(providerModels[0]);
        setModel(`${providerKey}/${providerModels[0]}`);
      } else {
        setModel(providerKey + '/');
      }
    } else {
      setModel('');
    }
  };

  const handleModelDropdownChange = (modelName: string) => {
    setSelectedModelName(modelName);
    if (selectedProviderKey && modelName) {
      setModel(`${selectedProviderKey}/${modelName}`);
    }
  };

  const handleModelChange = (value: string) => {
    setModel(value);
    const slashIdx = value.indexOf('/');
    if (slashIdx > 0) {
      const pKey = value.substring(0, slashIdx);
      if (providers[pKey]) {
        setSelectedProviderKey(pKey);
        setSelectedModelName(value.substring(slashIdx + 1));
      }
    }
  };

  const formatErrorMessage = (status: number, body: string): string => {
    let parsedMessage = '';
    try {
      const errJson = JSON.parse(body);
      parsedMessage = errJson.error?.message || errJson.message || '';
    } catch {
      // Not JSON, use raw text if short enough
      if (body.length < 500) parsedMessage = body;
    }

    if (status === 401) {
      return t('playground.error401') + (parsedMessage ? `\n${parsedMessage}` : '');
    }
    return t('playground.errorStatus', { status, message: parsedMessage || body || String(status) });
  };

  const handleSend = async () => {
    if (!model || !userMessage) return;
    setLoading(true);
    setResponse('');
    setResponseIsError(false);

    let body: any;

    if (endpoint === '/v1/messages') {
      // Anthropic Messages API: system is a top-level field, not in messages array
      body = {
        model,
        messages: [{ role: 'user', content: userMessage }],
        stream,
        max_tokens: maxTokens,
      };
      if (systemPrompt) {
        body.system = systemPrompt;
      }
    } else if (endpoint === '/v1/responses') {
      // OpenAI Responses API: uses `input` instead of `messages`
      body = {
        model,
        input: userMessage,
        stream,
        max_output_tokens: maxTokens,
      };
      if (systemPrompt) {
        body.instructions = systemPrompt;
      }
    } else {
      // OpenAI Chat Completions API
      body = {
        model,
        messages: [
          ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
          { role: 'user', content: userMessage },
        ],
        stream,
        temperature,
        max_completion_tokens: maxTokens,
      };
    }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        setResponse(formatErrorMessage(res.status, errText));
        setResponseIsError(true);
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
                  (chunk.type === 'content_block_delta' ? chunk.delta?.text : '') ||
                  (chunk.type === 'response.output_text.delta' ? chunk.delta : '');
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
      setResponseIsError(true);
    }
    setLoading(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(response);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = () => {
    setResponse('');
    setResponseIsError(false);
  };

  const selectedProviderModels: string[] = selectedProviderKey && providers[selectedProviderKey]
    ? (providers[selectedProviderKey].models || [])
    : [];

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{t('playground.title')}</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{t('playground.helperText')}</p>

      {/* Conversion Path Panel */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{t('playground.conversionPath')}</h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-baseline gap-2 text-gray-600 dark:text-gray-400">
            <span className="shrink-0 font-medium w-20">{t('playground.clientProtocol')}:</span>
            <span>{conversionInfo.clientProtocol} <span className="text-gray-400">({endpoint})</span></span>
          </div>

          {conversionInfo.providerKey && conversionInfo.provider ? (
            <>
              <div className="flex justify-center text-gray-300 dark:text-gray-600">
                <ArrowDown className="w-4 h-4" />
              </div>

              <div className="flex items-baseline gap-2 text-gray-600 dark:text-gray-400">
                <span className="shrink-0 font-medium w-20">{t('playground.proxyConversion')}:</span>
                {conversionInfo.needsConversion ? (
                  conversionInfo.conversionEnabled ? (
                    <span>{conversionInfo.clientProtocol} &rarr; {conversionInfo.upstreamProtocol}</span>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400">
                      {conversionInfo.clientProtocol} &rarr; {conversionInfo.upstreamProtocol}
                      <span className="ml-1 text-xs">({t('playground.disabledConversion')})</span>
                    </span>
                  )
                ) : (
                  <span className="text-green-600 dark:text-green-400">{t('playground.noConversion')}</span>
                )}
              </div>

              <div className="flex justify-center text-gray-300 dark:text-gray-600">
                <ArrowDown className="w-4 h-4" />
              </div>

              <div className="flex items-baseline gap-2 text-gray-600 dark:text-gray-400">
                <span className="shrink-0 font-medium w-20">{t('playground.upstreamService')}:</span>
                <span>
                  {conversionInfo.provider.display_name || conversionInfo.providerKey}
                  <span className="text-gray-400 ml-1">({conversionInfo.upstreamBaseUrl})</span>
                </span>
              </div>

              {conversionInfo.modelName && (
                <div className="flex items-baseline gap-2 text-gray-600 dark:text-gray-400">
                  <span className="shrink-0 font-medium w-20">{t('playground.targetModel')}:</span>
                  <span className="font-mono">{conversionInfo.modelName}</span>
                </div>
              )}
            </>
          ) : (
            <div className="flex justify-center py-1">
              <span className="text-gray-400 text-xs">{t('playground.noProviderHint')}</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Form */}
        <div className="space-y-4">
          {/* Endpoint Selector */}
          <Select
            id="endpoint"
            label={t('playground.endpoint')}
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
          >
            <option value="/v1/chat/completions">/v1/chat/completions (OpenAI Chat)</option>
            <option value="/v1/messages">/v1/messages (Anthropic Messages)</option>
            <option value="/v1/responses">/v1/responses (OpenAI Responses)</option>
          </Select>

          {/* Provider Selector */}
          <Select
            id="provider"
            label={t('playground.selectProvider')}
            value={selectedProviderKey}
            onChange={(e) => handleProviderChange(e.target.value)}
          >
            <option value="">{t('playground.selectProvider')}</option>
            {Object.entries(providers).map(([key, p]) => (
              <option key={key} value={key}>{p.display_name || key} ({key})</option>
            ))}
          </Select>

          {/* Model Dropdown (when provider is selected and has models) */}
          {selectedProviderModels.length > 0 && (
            <Select
              id="model-dropdown"
              label={t('playground.selectModel')}
              onChange={(e) => handleModelDropdownChange(e.target.value)}
              value={selectedModelName}
            >
              <option value="">{t('playground.selectModel')}</option>
              {selectedProviderModels.map((m: string) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </Select>
          )}

          {/* Model Input */}
          <Input
            id="model-input"
            label={t('playground.model')}
            value={model}
            onChange={(e) => handleModelChange(e.target.value)}
            placeholder={t('playground.modelPlaceholder')}
            list="model-list"
          />
          <datalist id="model-list">
            {models.map((m) => <option key={m} value={m} />)}
          </datalist>

          {/* System Prompt */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('playground.systemPrompt')}</label>
            <textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} rows={2}
              className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
          </div>

          {/* User Message */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('playground.userMessage')}</label>
            <textarea value={userMessage} onChange={(e) => setUserMessage(e.target.value)} rows={4}
              onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); handleSend(); } }}
              className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white" placeholder={t('playground.userMessagePlaceholder')} />
          </div>

          {/* Temperature + Max Tokens */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label htmlFor="temperature" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('playground.temperatureLabel', { value: temperature })}</label>
              <input id="temperature" type="range" min="0" max="2" step="0.1" value={temperature} onChange={(e) => setTemperature(parseFloat(e.target.value))} className="w-full" />
            </div>
            <div className="flex-1">
              <Input
                id="max-tokens"
                label={t('playground.maxTokens')}
                type="number"
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value))}
              />
            </div>
          </div>

          {/* Stream + Send */}
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={stream} onChange={(e) => setStream(e.target.checked)} id="stream" />
            <label htmlFor="stream" className="text-sm text-gray-700 dark:text-gray-300">{t('playground.stream')}</label>
          </div>
          <Button onClick={handleSend} disabled={loading || !model || !userMessage}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {loading ? t('playground.sending') : t('playground.send')}
          </Button>
        </div>

        {/* Right Column: Response Panel */}
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
                onClick={handleCopy}
                disabled={!response}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-30 rounded"
                aria-label={t('playground.copyResponse')}
              >
                {copied ? <span className="text-xs text-green-500">{t('playground.copied')}</span> : <Copy className="w-4 h-4" />}
              </button>
              <button
                onClick={handleClear}
                disabled={!response}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-30 rounded"
                aria-label={t('playground.clearResponse')}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="p-4 overflow-auto flex-1">
            <pre ref={responseRef} className={`text-sm whitespace-pre-wrap font-mono ${
              responseIsError
                ? 'text-red-600 dark:text-red-400'
                : 'text-gray-700 dark:text-green-400'
            }`}>{response || t('playground.response')}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}
