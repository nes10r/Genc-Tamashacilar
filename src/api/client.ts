import { mockHandle, HttpError } from './mock/server';

export type ApiMode = 'mock' | 'live';
export interface ApiConfig {
  mode: ApiMode;
  baseUrl: string;
  token: string;
}

const CFG_KEY = 'gtt-hr-api';
const ENV_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

export function getApiConfig(): ApiConfig {
  try {
    const raw = localStorage.getItem(CFG_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { mode: ENV_URL ? 'live' : 'mock', baseUrl: ENV_URL, token: '' };
}

export function setApiConfig(cfg: ApiConfig) {
  localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
  window.dispatchEvent(new Event('api-config'));
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Bütün API çağırışları buradan keçir. Rejimdən asılı olaraq Demo API və ya real backend istifadə olunur. */
export async function api<T>(method: string, path: string, body?: unknown, cfg = getApiConfig()): Promise<T> {
  if (cfg.mode === 'mock') {
    try {
      return (await mockHandle(method, path, body)) as T;
    } catch (e) {
      if (e instanceof HttpError) throw new ApiError(e.status, e.message);
      throw e;
    }
  }
  if (!cfg.baseUrl) throw new ApiError(0, 'API ünvanı təyin edilməyib (Ayarlar → API)');
  let res: Response;
  try {
    res = await fetch(cfg.baseUrl.replace(/\/$/, '') + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(cfg.token ? { Authorization: `Bearer ${cfg.token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Serverə qoşulmaq mümkün olmadı. Şəbəkəni və API ünvanını yoxlayın.');
  }
  if (!res.ok) {
    let msg = `Server xətası (${res.status})`;
    try {
      const j = await res.json();
      msg = j.message || j.error || msg;
    } catch { /* not json */ }
    if (res.status === 401) msg = 'Sessiya bitib və ya token etibarsızdır';
    throw new ApiError(res.status, msg);
  }
  if (res.status === 204) return null as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

export const http = {
  get: <T,>(p: string) => api<T>('GET', p),
  post: <T,>(p: string, b?: unknown) => api<T>('POST', p, b ?? {}),
  put: <T,>(p: string, b: unknown) => api<T>('PUT', p, b),
  patch: <T,>(p: string, b: unknown) => api<T>('PATCH', p, b),
  del: <T = null,>(p: string) => api<T>('DELETE', p),
};

export function qs(params: Record<string, string | undefined | null>) {
  const s = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => v && s.set(k, v));
  const str = s.toString();
  return str ? `?${str}` : '';
}
