/**
 * Google Identity Services (GIS) — OAuth 2.0 token axını, tam brauzerdə.
 * Server və ya client secret tələb olunmur; yalnız pulsuz "Web application" OAuth Client ID lazımdır.
 */
declare global {
  interface Window { google?: any }
}

/**
 * calendar.app.created — tətbiqin yaratdığı ayrıca təqvimi idarə etmək
 * calendar.events      — mövcud təqvimdə (ID ilə) hadisələri oxumaq/yazmaq
 */
export const GCAL_SCOPES = 'https://www.googleapis.com/auth/calendar.app.created https://www.googleapis.com/auth/calendar.events';

const CFG_KEY = 'gtt-gcal';
const TOKEN_KEY = 'gtt-gcal-token';
const ENV_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? '';

export interface GCalConfig {
  clientId: string;
  calendarId: string;
  calendarName?: string;
  consented?: boolean;
  userHint?: string;
}

export function getGCalConfig(): GCalConfig {
  try {
    const raw = localStorage.getItem(CFG_KEY);
    if (raw) { const c = JSON.parse(raw); return { ...c, clientId: c.clientId || ENV_CLIENT_ID }; }
  } catch { /* */ }
  return { clientId: ENV_CLIENT_ID, calendarId: '' };
}

export function setGCalConfig(patch: Partial<GCalConfig>) {
  const next = { ...getGCalConfig(), ...patch };
  try { localStorage.setItem(CFG_KEY, JSON.stringify(next)); } catch { /* */ }
  emit();
  return next;
}

interface Token { access_token: string; expires_at: number }
let token: Token | null = (() => {
  try { const t = JSON.parse(sessionStorage.getItem(TOKEN_KEY) || 'null'); return t && t.expires_at > Date.now() ? t : null; } catch { return null; }
})();

const listeners = new Set<() => void>();
function emit() { listeners.forEach((l) => l()); }
export function onGCalChange(l: () => void) { listeners.add(l); return () => void listeners.delete(l); }

export function getToken(): string | null {
  if (token && token.expires_at > Date.now() + 30_000) return token.access_token;
  return null;
}
export function expireToken() {
  token = null;
  try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* */ }
  emit();
}

export type GCalStatus = 'not-configured' | 'disconnected' | 'expired' | 'connected';
export function gcalStatus(): GCalStatus {
  const c = getGCalConfig();
  if (!c.clientId) return 'not-configured';
  if (!c.consented || !c.calendarId) return getToken() ? 'connected' : 'disconnected';
  return getToken() ? 'connected' : 'expired';
}
/** Google təqvimi seçilib və istifadəçi icazə veribsə — portal Google rejimində işləyir */
export const googleModeActive = () => { const c = getGCalConfig(); return !!(c.clientId && c.consented && c.calendarId); };

let gisPromise: Promise<void> | null = null;
function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisPromise) return gisPromise;
  gisPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { gisPromise = null; reject(new Error('Google kitabxanası yüklənmədi (internet bağlantısını yoxlayın)')); };
    document.head.appendChild(s);
  });
  return gisPromise;
}

/** İstifadəçi klikindən çağırılmalıdır (popup bloklanmasın deyə) */
export async function connectGoogle(): Promise<void> {
  const cfg = getGCalConfig();
  if (!cfg.clientId) throw new Error('Əvvəlcə Google OAuth Client ID daxil edin');
  await loadGis();
  await new Promise<void>((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: cfg.clientId,
      scope: GCAL_SCOPES,
      hint: cfg.userHint,
      callback: (resp: any) => {
        if (resp.error) return reject(new Error(resp.error_description || resp.error));
        if (!window.google.accounts.oauth2.hasGrantedAllScopes(resp, ...GCAL_SCOPES.split(' ')))
          return reject(new Error('Təqvimə giriş icazəsi verilmədi. Bütün icazələri qeyd edin.'));
        token = { access_token: resp.access_token, expires_at: Date.now() + Number(resp.expires_in) * 1000 };
        try { sessionStorage.setItem(TOKEN_KEY, JSON.stringify(token)); } catch { /* */ }
        setGCalConfig({ consented: true });
        resolve();
      },
      error_callback: (err: any) => reject(new Error(err?.type === 'popup_closed' ? 'Giriş pəncərəsi bağlandı' : err?.message || 'Google girişi alınmadı')),
    });
    client.requestAccessToken({ prompt: cfg.consented ? '' : 'consent' });
  });
}

export function disconnectGoogle() {
  const t = token?.access_token;
  if (t && window.google?.accounts?.oauth2) window.google.accounts.oauth2.revoke(t, () => undefined);
  expireToken();
  setGCalConfig({ consented: false, calendarId: '', calendarName: '' });
}
