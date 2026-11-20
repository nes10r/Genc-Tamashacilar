/**
 * Google Calendar API v3 — REST (fetch), pulsuz standart kvota.
 * Kvotaya qənaət: yalnız görünən tarix aralığı sorğulanır, `fields` ilə cavab kiçildilir,
 * nəticələr React Query-də keşlənir, 403 rateLimit / 429 / 5xx üçün eksponensial geri çəkilmə tətbiq edilir.
 */
import { expireToken, getToken } from './gis';
import type { CalEvent, CalEventInput, CalEventType } from '../../types';
import { addDays } from '../../lib/utils';

const BASE = 'https://www.googleapis.com/calendar/v3';
export const TZ = 'Asia/Baku';
const OFFSET = '+04:00'; // Azərbaycanda 2016-cı ildən yay vaxtı tətbiq olunmur

/** Google Calendar hadisə rəngləri (colorId) */
export const GCOLOR: Record<CalEventType, string> = { performance: '11', rehearsal: '3', shift: '7', leave: '10', other: '8' };

export class GoogleError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/* ---- Gündəlik sorğu sayğacı (istifadəçiyə kvota haqqında məlumat üçün) ---- */
const USAGE_KEY = 'gtt-gcal-usage';
export function getUsage(): { date: string; count: number } {
  const today = new Date().toISOString().slice(0, 10);
  try { const u = JSON.parse(localStorage.getItem(USAGE_KEY) || 'null'); if (u?.date === today) return u; } catch { /* */ }
  return { date: today, count: 0 };
}
function countRequest() {
  const u = getUsage();
  try { localStorage.setItem(USAGE_KEY, JSON.stringify({ ...u, count: u.count + 1 })); } catch { /* */ }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function gfetch<T>(path: string, init: RequestInit = {}, attempt = 0): Promise<T> {
  const t = getToken();
  if (!t) throw new GoogleError(401, 'Google sessiyası bitib — yenidən qoşulun');
  countRequest();
  let res: Response;
  try {
    res = await fetch(BASE + path, { ...init, headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) } });
  } catch {
    if (attempt < 2) { await sleep(800 * (attempt + 1)); return gfetch(path, init, attempt + 1); }
    throw new GoogleError(0, 'Google Calendar-a qoşulmaq mümkün olmadı');
  }
  if (res.status === 204) return null as T;
  const body = await res.json().catch(() => ({}));
  if (res.ok) return body as T;
  const reason: string = body?.error?.errors?.[0]?.reason ?? '';
  const retryable = res.status === 429 || res.status >= 500 || (res.status === 403 && /rateLimit/i.test(reason));
  if (retryable && attempt < 4) {
    await sleep(2 ** attempt * 600 + Math.random() * 400);
    return gfetch(path, init, attempt + 1);
  }
  if (res.status === 401) { expireToken(); throw new GoogleError(401, 'Google sessiyası bitib — yenidən qoşulun'); }
  if (res.status === 403 && /rateLimit|quota/i.test(reason)) throw new GoogleError(403, 'Google Calendar kvota limitinə çatıldı. Bir az sonra yenidən cəhd edin.');
  if (res.status === 404) throw new GoogleError(404, 'Təqvim və ya hadisə tapılmadı (təqvim ID-sini yoxlayın)');
  throw new GoogleError(res.status, body?.error?.message || `Google Calendar xətası (${res.status})`);
}

interface GEvent {
  id: string; summary?: string; description?: string; location?: string; htmlLink?: string; recurringEventId?: string; colorId?: string;
  start: { date?: string; dateTime?: string }; end: { date?: string; dateTime?: string };
  extendedProperties?: { private?: Record<string, string> };
}

export function fromGoogle(g: GEvent): CalEvent {
  const p = g.extendedProperties?.private ?? {};
  const allDay = !!g.start.date;
  return {
    id: g.id,
    title: g.summary ?? '(adsız)',
    type: (p.gttType as CalEventType) ?? 'other',
    allDay,
    start: allDay ? g.start.date! : g.start.dateTime!.slice(0, 16),
    end: allDay ? addDays(g.end.date!, -1) : g.end.dateTime!.slice(0, 16),
    location: g.location, description: g.description,
    participants: p.gttEmployees ? p.gttEmployees.split(',').filter(Boolean) : [],
    recurringEventId: g.recurringEventId, htmlLink: g.htmlLink, leaveId: p.gttLeaveId,
    source: 'google',
  };
}

export function toGoogle(e: CalEventInput, withRecurrence = true) {
  return {
    summary: e.title,
    location: e.location || undefined,
    description: e.description || undefined,
    colorId: GCOLOR[e.type],
    start: e.allDay ? { date: e.start } : { dateTime: `${e.start}:00`, timeZone: TZ },
    end: e.allDay ? { date: addDays(e.end, 1) } : { dateTime: `${e.end}:00`, timeZone: TZ },
    extendedProperties: { private: { gttType: e.type, gttEmployees: e.participants.join(','), ...(e.leaveId ? { gttLeaveId: e.leaveId } : {}) } },
    ...(withRecurrence && e.repeatWeeks && e.repeatWeeks > 1 ? { recurrence: [`RRULE:FREQ=WEEKLY;COUNT=${e.repeatWeeks}`] } : {}),
  };
}

const FIELDS = 'nextPageToken,items(id,summary,description,location,htmlLink,recurringEventId,colorId,start,end,extendedProperties)';
const cal = (id: string) => `/calendars/${encodeURIComponent(id)}`;

export async function listEvents(calendarId: string, from: string, to: string, extra: Record<string, string> = {}): Promise<CalEvent[]> {
  const out: CalEvent[] = [];
  let pageToken = '';
  do {
    const q = new URLSearchParams({
      timeMin: `${from}T00:00:00${OFFSET}`, timeMax: `${addDays(to, 1)}T00:00:00${OFFSET}`,
      singleEvents: 'true', orderBy: 'startTime', maxResults: '2500', timeZone: TZ, fields: FIELDS, ...extra,
      ...(pageToken ? { pageToken } : {}),
    });
    const r = await gfetch<{ items?: GEvent[]; nextPageToken?: string }>(`${cal(calendarId)}/events?${q}`);
    (r.items ?? []).forEach((g) => out.push(fromGoogle(g)));
    pageToken = r.nextPageToken ?? '';
  } while (pageToken);
  return out;
}

export const createEvent = (calendarId: string, e: CalEventInput) =>
  gfetch<GEvent>(`${cal(calendarId)}/events`, { method: 'POST', body: JSON.stringify(toGoogle(e)) }).then(fromGoogle);

export const patchEvent = (calendarId: string, id: string, e: CalEventInput) =>
  gfetch<GEvent>(`${cal(calendarId)}/events/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(toGoogle(e, false)) }).then(fromGoogle);

export const deleteEvent = (calendarId: string, id: string) =>
  gfetch<null>(`${cal(calendarId)}/events/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch((e) => {
    if (e instanceof GoogleError && e.status === 410) return null; // artıq silinib
    throw e;
  });

/** Teatr üçün ayrıca təqvim yaradır (calendar.app.created icazəsi) */
export const createCalendar = (summary: string) =>
  gfetch<{ id: string; summary: string }>('/calendars', { method: 'POST', body: JSON.stringify({ summary, timeZone: TZ, description: 'Gənc Tamaşaçılar Teatrı HR Portal — tamaşalar, məşqlər, iş növbələri, məzuniyyətlər' }) });

/** Təqvimə yazma icazəsini yoxlayır (events.list, 1 nəticə) */
export const verifyCalendar = (calendarId: string) =>
  gfetch<{ summary?: string }>(`${cal(calendarId)}/events?maxResults=1&fields=summary`);
