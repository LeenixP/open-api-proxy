type Locale = 'zh' | 'en';

const messages: Record<Locale, Record<string, string>> = {
  zh: {
    // Navigation
    'nav.dashboard': '仪表盘',
    'nav.providers': '厂商管理',
    'nav.playground': 'API 测试',
    'nav.logs': '日志',
    'nav.settings': '设置',
    'app.title': 'open-api-proxy',
    'app.subtitle': 'LLM API 统一网关',

    // Dashboard
    'dashboard.title': '仪表盘',
    'dashboard.providers': '厂商数',
    'dashboard.models': '模型数',
    'dashboard.uptime': '运行时间',
    'dashboard.status': '厂商状态',
    'dashboard.noProviders': '暂无厂商。请在"厂商管理"页面添加。',
    'dashboard.modelsCount': '{count} 个模型',

    // Providers
    'providers.title': '厂商管理',
    'providers.add': '添加厂商',
    'providers.name': '名称',
    'providers.key': 'Key',
    'providers.protocol': '协议',
    'providers.models': '模型数',
    'providers.baseUrl': 'Base URL',
    'providers.actions': '操作',
    'providers.empty': '暂无厂商，点击"添加厂商"开始',
    'providers.deleteConfirm': '确定要删除厂商 "{key}" 吗？此操作不可恢复。',
    'providers.edit': '编辑 {key}',
    'providers.new': '新建厂商',
    'providers.save': '保存',
    'providers.cancel': '取消',

    // Playground
    'playground.title': 'API 测试',
    'playground.endpoint': '端点',
    'playground.model': 'Model (provider/model)',
    'playground.modelPlaceholder': '例如: openai/gpt-4o',
    'playground.systemPrompt': 'System Prompt',
    'playground.userMessage': 'User Message',
    'playground.userMessagePlaceholder': '输入你的消息...',
    'playground.temperature': 'Temperature',
    'playground.maxTokens': 'Max Tokens',
    'playground.stream': '流式输出',
    'playground.send': '发送',
    'playground.sending': '请求中...',
    'playground.response': '响应将显示在这里...',
    'playground.copy': '复制',
    'playground.clear': '清空',

    // Logs
    'logs.title': '日志',
    'logs.clear': '清空',
    'logs.waiting': '等待日志...',
    'logs.autoScroll': '自动滚动',

    // Settings
    'settings.title': '系统设置',
    'settings.server': '服务器',
    'settings.port': '端口',
    'settings.host': 'Host',
    'settings.proxy': '代理参数',
    'settings.timeout': '超时 (ms)',
    'settings.logLevel': '日志级别',
    'settings.version': '版本更新',
    'settings.currentVersion': '当前版本',
    'settings.latestVersion': '已是最新',
    'settings.newVersion': '新版本可用',
    'settings.import': '导入配置',
    'settings.export': '导出配置',
    'settings.importExportHint': '导出为 JSON 格式（服务端使用 YAML 存储）',
    'settings.save': '保存设置',
    'settings.saved': '已保存',
    'settings.loading': '加载中...',
    'settings.conversions': '协议转换',

    // Common
    'common.retry': '重试',
    'common.close': '关闭',
    'common.loading': '加载中...',
    'common.error': '出错了',
  },
  en: {
    'nav.dashboard': 'Dashboard',
    'nav.providers': 'Providers',
    'nav.playground': 'Playground',
    'nav.logs': 'Logs',
    'nav.settings': 'Settings',
    'app.title': 'open-api-proxy',
    'app.subtitle': 'LLM API Gateway',

    'dashboard.title': 'Dashboard',
    'dashboard.providers': 'Providers',
    'dashboard.models': 'Models',
    'dashboard.uptime': 'Uptime',
    'dashboard.status': 'Provider Status',
    'dashboard.noProviders': 'No providers. Add one in "Providers" page.',
    'dashboard.modelsCount': '{count} models',

    'providers.title': 'Providers',
    'providers.add': 'Add Provider',
    'providers.name': 'Name',
    'providers.key': 'Key',
    'providers.protocol': 'Protocol',
    'providers.models': 'Models',
    'providers.baseUrl': 'Base URL',
    'providers.actions': 'Actions',
    'providers.empty': 'No providers. Click "Add Provider" to start.',
    'providers.deleteConfirm': 'Delete provider "{key}"? This cannot be undone.',
    'providers.edit': 'Edit {key}',
    'providers.new': 'New Provider',
    'providers.save': 'Save',
    'providers.cancel': 'Cancel',

    'playground.title': 'API Playground',
    'playground.endpoint': 'Endpoint',
    'playground.model': 'Model (provider/model)',
    'playground.modelPlaceholder': 'e.g. openai/gpt-4o',
    'playground.systemPrompt': 'System Prompt',
    'playground.userMessage': 'User Message',
    'playground.userMessagePlaceholder': 'Enter your message...',
    'playground.temperature': 'Temperature',
    'playground.maxTokens': 'Max Tokens',
    'playground.stream': 'Stream',
    'playground.send': 'Send',
    'playground.sending': 'Sending...',
    'playground.response': 'Response will appear here...',
    'playground.copy': 'Copy',
    'playground.clear': 'Clear',

    'logs.title': 'Logs',
    'logs.clear': 'Clear',
    'logs.waiting': 'Waiting for logs...',
    'logs.autoScroll': 'Auto-scroll',

    'settings.title': 'Settings',
    'settings.server': 'Server',
    'settings.port': 'Port',
    'settings.host': 'Host',
    'settings.proxy': 'Proxy',
    'settings.timeout': 'Timeout (ms)',
    'settings.logLevel': 'Log Level',
    'settings.version': 'Version',
    'settings.currentVersion': 'Current version',
    'settings.latestVersion': 'Up to date',
    'settings.newVersion': 'New version available',
    'settings.import': 'Import Config',
    'settings.export': 'Export Config',
    'settings.importExportHint': 'Export as JSON (server uses YAML storage)',
    'settings.save': 'Save Settings',
    'settings.saved': 'Saved',
    'settings.loading': 'Loading...',
    'settings.conversions': 'Protocol Conversions',

    'common.retry': 'Retry',
    'common.close': 'Close',
    'common.loading': 'Loading...',
    'common.error': 'Error',
  },
};

// Detect browser language, default to zh
function detectLocale(): Locale {
  if (typeof navigator !== 'undefined') {
    const lang = navigator.language.toLowerCase();
    if (lang.startsWith('zh')) return 'zh';
  }
  return 'zh'; // Default to Chinese
}

let currentLocale: Locale = detectLocale();

export function t(key: string, params?: Record<string, string | number>): string {
  let msg = messages[currentLocale]?.[key] || messages.en[key] || key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      msg = msg.replace(`{${k}}`, String(v));
    }
  }
  return msg;
}

export function setLocale(locale: Locale): void {
  currentLocale = locale;
}

export function getLocale(): Locale {
  return currentLocale;
}
