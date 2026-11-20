/**
 * Bayram günləri üçün sinxron keş.
 * Mənbə: holidayapi.com (src/api/holidays.ts yükləyir və bura yazır).
 * API əlçatan olmadıqda Azərbaycan Əmək Məcəlləsinin 105-ci maddəsinə əsaslanan daxili siyahı istifadə olunur.
 */
export interface Holiday {
  date: string; // YYYY-MM-DD
  name: string; // azərbaycanca
  originalName?: string;
  observed?: string;
  public: boolean;
  source: 'api' | 'local';
  approximate?: boolean;
}

const CACHE_KEY = 'gtt-holidays';
const p = (n: number) => String(n).padStart(2, '0');

/** holidayapi.com ingiliscə adlarının tərcüməsi */
const NAME_AZ: [RegExp, string][] = [
  [/second day of new year|new year.*holiday|day after new year/i, 'Yeni il (2-ci gün)'],
  [/new year/i, 'Yeni il bayramı'],
  [/mourning|martyrs/i, 'Ümumxalq Hüzn Günü'],
  [/women/i, 'Beynəlxalq Qadınlar Günü'],
  [/novruz|nowruz|novruz/i, 'Novruz bayramı'],
  [/second day of eid al-fitr|eid al-fitr.*2|ramadan.*second/i, 'Ramazan bayramı (2-ci gün)'],
  [/eid al-fitr|ramadan/i, 'Ramazan bayramı'],
  [/second day of eid al-adha|eid al-adha.*2|sacrifice.*second/i, 'Qurban bayramı (2-ci gün)'],
  [/eid al-adha|sacrifice|kurban|qurban/i, 'Qurban bayramı'],
  [/fascism/i, 'Faşizm üzərində Qələbə Günü'],
  [/independence|republic/i, 'Müstəqillik Günü'],
  [/salvation/i, 'Milli Qurtuluş Günü'],
  [/armed forces/i, 'Silahlı Qüvvələr Günü'],
  [/victory/i, 'Zəfər Günü'],
  [/flag/i, 'Dövlət Bayrağı Günü'],
  [/constitution/i, 'Konstitusiya Günü'],
  [/revival|national revival/i, 'Milli Dirçəliş Günü'],
  [/solidarity/i, 'Dünya Azərbaycanlılarının Həmrəyliyi Günü'],
];

export function translateHoliday(name: string): string {
  const ord = name.match(/(second|third|fourth|fifth) day/i)?.[1]?.toLowerCase();
  const n = { second: 2, third: 3, fourth: 4, fifth: 5 }[ord ?? ''] as number | undefined;
  const suf = (k: number) => (k === 3 || k === 4 ? 'cü' : 'ci');
  if (/novruz|nowruz/i.test(name)) return n ? `Novruz bayramı (${n}-${suf(n)} gün)` : 'Novruz bayramı';
  for (const [re, az] of NAME_AZ) if (re.test(name)) return az;
  return name;
}

/** Dini bayramların tarixləri hər il Qafqaz Müsəlmanları İdarəsi tərəfindən elan olunur — təxmini */
const RELIGIOUS: Record<number, [string, string][]> = {
  2025: [['03-30', 'Ramazan bayramı'], ['03-31', 'Ramazan bayramı (2-ci gün)'], ['06-06', 'Qurban bayramı'], ['06-07', 'Qurban bayramı (2-ci gün)']],
  2026: [['03-20', 'Ramazan bayramı'], ['03-21', 'Ramazan bayramı (2-ci gün)'], ['05-27', 'Qurban bayramı'], ['05-28', 'Qurban bayramı (2-ci gün)']],
  2027: [['03-10', 'Ramazan bayramı'], ['03-11', 'Ramazan bayramı (2-ci gün)'], ['05-16', 'Qurban bayramı'], ['05-17', 'Qurban bayramı (2-ci gün)']],
};

export function localHolidays(year: number): Holiday[] {
  const fixed: [string, string][] = [
    ['01-01', 'Yeni il bayramı'], ['01-02', 'Yeni il bayramı (2-ci gün)'], ['01-20', 'Ümumxalq Hüzn Günü'],
    ['03-08', 'Beynəlxalq Qadınlar Günü'],
    ['03-20', 'Novruz bayramı'], ['03-21', 'Novruz bayramı (2-ci gün)'], ['03-22', 'Novruz bayramı (3-cü gün)'], ['03-23', 'Novruz bayramı (4-cü gün)'], ['03-24', 'Novruz bayramı (5-ci gün)'],
    ['05-09', 'Faşizm üzərində Qələbə Günü'], ['05-28', 'Müstəqillik Günü'], ['06-15', 'Milli Qurtuluş Günü'],
    ['06-26', 'Silahlı Qüvvələr Günü'], ['11-08', 'Zəfər Günü'], ['11-09', 'Dövlət Bayrağı Günü'],
    ['12-31', 'Dünya Azərbaycanlılarının Həmrəyliyi Günü'],
  ];
  const list: Holiday[] = fixed.map(([md, name]) => ({ date: `${year}-${md}`, name, public: true, source: 'local' }));
  (RELIGIOUS[year] ?? []).forEach(([md, name]) => list.push({ date: `${year}-${md}`, name, public: true, source: 'local', approximate: true }));
  return list.sort((a, b) => a.date.localeCompare(b.date));
}

type Cache = Record<string, { fetchedAt: string; holidays: Holiday[] }>;
let mem: Cache | null = null;
function readCache(): Cache {
  if (mem) return mem;
  try { mem = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); } catch { mem = {}; }
  return mem!;
}

export function cacheHolidays(year: number, holidays: Holiday[]) {
  const c = readCache();
  c[year] = { fetchedAt: new Date().toISOString(), holidays };
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch { /* */ }
}
export function clearHolidayCache() {
  mem = {};
  try { localStorage.removeItem(CACHE_KEY); } catch { /* */ }
}
export function cachedMeta(year: number) {
  return readCache()[year];
}

/** API-dan alınıbsa onu, yoxdursa daxili siyahını qaytarır */
export function holidaysFor(year: number): Holiday[] {
  return readCache()[year]?.holidays ?? localHolidays(year);
}

/** Əgər bayram başqa günə keçirilibsə (observed), qeyri-iş günü həm də həmin gündür */
export function holidayOn(iso: string): Holiday | undefined {
  const y = Number(iso.slice(0, 4));
  return holidaysFor(y).find((h) => h.date === iso || h.observed === iso);
}
export const isHoliday = (iso: string) => !!holidayOn(iso);

export function holidaysBetween(start: string, end: string): Holiday[] {
  const out: Holiday[] = [];
  for (let y = Number(start.slice(0, 4)); y <= Number(end.slice(0, 4)); y++)
    holidaysFor(y).forEach((h) => { const d = h.observed ?? h.date; if (d >= start && d <= end) out.push(h); });
  return out;
}

export function upcomingHolidays(fromISO: string, n = 4): Holiday[] {
  const y = Number(fromISO.slice(0, 4));
  return [...holidaysFor(y), ...holidaysFor(y + 1)].filter((h) => h.date >= fromISO).slice(0, n);
}

export const isoOf = (d: Date) => `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
