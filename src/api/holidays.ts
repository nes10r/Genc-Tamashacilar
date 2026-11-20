import { useQuery } from '@tanstack/react-query';
import { getApiConfig } from './client';
import { cacheHolidays, cachedMeta, localHolidays, translateHoliday, type Holiday } from '../lib/holidays';

/**
 * Bayram günləri — holidayapi.com
 *  • Demo rejimi: birbaşa https://holidayapi.com/v1/holidays?key=…&country=AZ&year=… (açar Ayarlarda)
 *  • Canlı rejim: backend proksi GET {API}/holidays?year=… (açar serverdə saxlanılır, brauzerə çıxmır)
 * Uğursuz olarsa daxili rəsmi siyahı istifadə olunur.
 */
const KEY_STORE = 'gtt-holiday-key';
const ENV_KEY = (import.meta.env.VITE_HOLIDAY_API_KEY as string | undefined) ?? '';

export const getHolidayKey = () => { try { return localStorage.getItem(KEY_STORE) || ENV_KEY; } catch { return ENV_KEY; } };
export const setHolidayKey = (k: string) => { try { localStorage.setItem(KEY_STORE, k.trim()); } catch { /* */ } };

interface ApiHoliday { name: string; date: string; observed?: string; public: boolean; country: string; uuid: string }
interface ApiResponse { status: number; error?: string; warning?: string; holidays?: ApiHoliday[]; requests?: { used: number; available: number; resets: string } }

export interface HolidayResult {
  year: number;
  holidays: Holiday[];
  source: 'api' | 'proxy' | 'local';
  message?: string;
  requests?: ApiResponse['requests'];
}

const ERRORS: Record<number, string> = {
  400: 'Sorğu parametrləri səhvdir',
  401: 'API açarı etibarsızdır',
  402: 'Holiday API planınız bu ili dəstəkləmir (402)',
  403: 'Yalnız HTTPS sorğularına icazə verilir',
  429: 'Aylıq sorğu limiti bitib',
  500: 'Holiday API server xətası',
};

function normalize(list: ApiHoliday[]): Holiday[] {
  return list
    .filter((h) => h.public !== false)
    .map((h) => ({ date: h.date, observed: h.observed && h.observed !== h.date ? h.observed : undefined, name: translateHoliday(h.name), originalName: h.name, public: h.public, source: 'api' as const }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function fetchHolidays(year: number, opts: { force?: boolean } = {}): Promise<HolidayResult> {
  const meta = cachedMeta(year);
  if (!opts.force && meta && meta.holidays[0]?.source === 'api' && Date.now() - new Date(meta.fetchedAt).getTime() < 7 * 86400e3)
    return { year, holidays: meta.holidays, source: 'api', message: 'Keşdən' };

  const cfg = getApiConfig();
  try {
    let res: Response;
    let source: HolidayResult['source'];
    if (cfg.mode === 'live' && cfg.baseUrl) {
      source = 'proxy';
      res = await fetch(`${cfg.baseUrl.replace(/\/$/, '')}/holidays?country=AZ&year=${year}`, {
        headers: { Accept: 'application/json', ...(cfg.token ? { Authorization: `Bearer ${cfg.token}` } : {}) },
      });
    } else {
      const key = getHolidayKey();
      if (!key) return { year, holidays: localHolidays(year), source: 'local', message: 'Holiday API açarı daxil edilməyib — daxili siyahı göstərilir' };
      source = 'api';
      res = await fetch(`https://holidayapi.com/v1/holidays?key=${encodeURIComponent(key)}&country=AZ&year=${year}&public=true`);
    }
    const body = (await res.json().catch(() => ({}))) as ApiResponse;
    if (!res.ok || !body.holidays) throw new Error(body.error || ERRORS[res.status] || `Xəta (${res.status})`);
    const holidays = normalize(body.holidays);
    cacheHolidays(year, holidays);
    return { year, holidays, source, requests: body.requests, message: body.warning };
  } catch (e) {
    const msg = e instanceof TypeError ? 'Holiday API-ya qoşulmaq mümkün olmadı (şəbəkə/CORS)' : (e as Error).message;
    return { year, holidays: meta?.holidays ?? localHolidays(year), source: 'local', message: `${msg} — daxili siyahı göstərilir` };
  }
}

export const useHolidays = (year: number) =>
  useQuery({ queryKey: ['holidays', year], queryFn: () => fetchHolidays(year), staleTime: 3600_000 });
