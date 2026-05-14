const BASE = '';

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(BASE + url, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(err.error?.message || res.statusText);
  }
  return res.json();
}

export const apiClient = {
  getConfig: () => api<any>('/api/config'),
  updateConfig: (config: any) => api<any>('/api/config', { method: 'PUT', body: JSON.stringify(config) }),
  getProviders: () => api<Record<string, any>>('/api/providers'),
  createProvider: (key: string, data: any) => api<any>('/api/providers', { method: 'POST', body: JSON.stringify({ key, ...data }) }),
  updateProvider: (key: string, data: any) => api<any>(`/api/providers/${key}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProvider: (key: string) => api<any>(`/api/providers/${key}`, { method: 'DELETE' }),
  getHealth: () => api<any>('/api/health'),
  getLogs: () => api<any[]>('/api/logs'),
  checkUpdate: () => api<{ current: string; latest: string; hasUpdate: boolean }>('/api/update/check'),
  executeUpdate: () => api<any>('/api/update/execute', { method: 'POST' }),
  getModels: () => api<{ object: string; data: Array<{ id: string }> }>('/v1/models'),
};
