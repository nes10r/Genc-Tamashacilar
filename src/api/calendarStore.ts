/**
 * Təqvim məlumat qatı.
 *  • Google rejimi: Google Calendar API (ayrıca "GTT — Teatr təqvimi" və ya seçilmiş təqvim)
 *  • Lokal rejim: Google qoşulmayana qədər hadisələr brauzerdə saxlanılır — portal dərhal istifadəyə hazırdır
 * Məzuniyyətlər portalın özündən (/leaves) götürülür; Google-a yalnız güzgü kimi sinxronlaşdırılır.
 */
import { useEffect, useState } from 'react';
import { useMutation, useQuery, keepPreviousData } from '@tanstack/react-query';
import { queryClient } from './hooks';
import { createEvent, deleteEvent, listEvents, patchEvent } from './google/calendar';
import { getGCalConfig, googleModeActive, onGCalChange } from './google/gis';
import { toast } from '../lib/toast';
import { addDays, todayISO, parseISO, fullName } from '../lib/utils';
import type { CalEvent, CalEventInput, CalEventType, Employee, LeaveRequest } from '../types';

export const TYPE_META: Record<CalEventType, { label: string; color: string }> = {
  performance: { label: 'Tamaşa', color: '#c0392b' },
  rehearsal: { label: 'Məşq', color: '#6a3fa0' },
  shift: { label: 'İş növbəsi', color: '#1f7a8c' },
  leave: { label: 'Məzuniyyət', color: '#2f7d4f' },
  other: { label: 'Digər', color: '#6b6460' },
};
export const LOCATIONS = ['Böyük səhnə', 'Kiçik səhnə', 'Məşq zalı', 'Kukla zalı', 'Dekorasiya sexi', 'Qastrol'];
export const REPERTOIRE = ['«Cırtdan»', '«Məlikməmməd»', '«Şəngülüm, Şüngülüm, Məngülüm»', '«Tıq-tıq xanım»', '«Göyçək Fatma»'];

/* ---------------- Lokal saxlama ---------------- */
const LKEY = 'gtt-calendar-local';
function seedLocal(): CalEvent[] {
  const out: CalEvent[] = [];
  const today = todayISO();
  const monday = addDays(today, -((parseISO(today).getDay() + 6) % 7));
  const actors = Array.from({ length: 14 }, (_, i) => `e${i + 4}`);
  const tech = Array.from({ length: 6 }, (_, i) => `e${i + 28}`);
  let n = 1;
  const add = (date: string, s: string, e: string, title: string, type: CalEventType, location: string, participants: string[], series?: string) =>
    out.push({ id: `loc${n++}`, title, type, allDay: false, start: `${date}T${s}`, end: `${date}T${e}`, location, participants, recurringEventId: series, source: 'local' });
  for (let w = -2; w <= 6; w++) {
    const wk = addDays(monday, w * 7);
    add(addDays(wk, 1), '11:00', '14:00', '«Cırtdan» — məşq', 'rehearsal', 'Məşq zalı', actors.slice(0, 7), 'ser-cirtdan');
    add(addDays(wk, 3), '11:00', '14:00', '«Məlikməmməd» — məşq', 'rehearsal', 'Böyük səhnə', actors.slice(5, 13), 'ser-melik');
    add(addDays(wk, 4), '10:00', '18:00', 'Texniki heyət — dekor montajı', 'shift', 'Böyük səhnə', tech, 'ser-montaj');
    add(addDays(wk, 5), '12:00', '13:30', '«Cırtdan» — tamaşa', 'performance', 'Böyük səhnə', actors.slice(0, 7), 'ser-cirtdan-t');
    add(addDays(wk, 6), '12:00', '13:30', '«Cırtdan» — tamaşa', 'performance', 'Böyük səhnə', actors.slice(0, 7), 'ser-cirtdan-t');
    add(addDays(wk, 6), '17:00', '18:40', '«Məlikməmməd» — tamaşa', 'performance', 'Böyük səhnə', actors.slice(5, 13), 'ser-melik-t');
  }
  return out;
}
function loadLocal(): CalEvent[] {
  try { const raw = localStorage.getItem(LKEY); if (raw) return JSON.parse(raw); } catch { /* */ }
  const s = seedLocal(); saveLocal(s); return s;
}
function saveLocal(list: CalEvent[]) { try { localStorage.setItem(LKEY, JSON.stringify(list)); } catch { /* */ } }
export function resetLocalCalendar() { saveLocal(seedLocal()); queryClient.invalidateQueries({ queryKey: ['calendar'] }); }

const day = (s: string) => s.slice(0, 10);
const overlapsRange = (e: CalEvent, from: string, to: string) => day(e.start) <= to && day(e.end) >= from;

/* ---------------- Rejim ---------------- */
export function useCalendarMode() {
  const [, force] = useState(0);
  useEffect(() => onGCalChange(() => { force((x) => x + 1); queryClient.invalidateQueries({ queryKey: ['calendar'] }); }), []);
  const cfg = getGCalConfig();
  return { mode: googleModeActive() ? ('google' as const) : ('local' as const), calendarId: cfg.calendarId, calendarName: cfg.calendarName };
}

/* ---------------- Sorğular ---------------- */
export function useCalEvents(from: string, to: string) {
  const mode = googleModeActive() ? 'google' : 'local';
  const calId = getGCalConfig().calendarId;
  return useQuery({
    queryKey: ['calendar', mode, calId, from, to],
    queryFn: async (): Promise<CalEvent[]> => {
      if (mode === 'google') {
        const list = await listEvents(calId, from, to);
        return list.filter((e) => !e.leaveId); // məzuniyyət güzgüləri portaldan göstərilir
      }
      return loadLocal().filter((e) => overlapsRange(e, from, to));
    },
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    retry: (n, e: any) => e?.status !== 401 && e?.status !== 404 && n < 1,
  });
}

function done(msg: string) {
  toast.success(msg);
  queryClient.invalidateQueries({ queryKey: ['calendar'] });
}
const fail = (e: Error) => toast.error(e.message);

export function useSaveEvent() {
  return useMutation({
    mutationFn: async (e: CalEventInput): Promise<void> => {
      if (googleModeActive()) {
        const cal = getGCalConfig().calendarId;
        if (e.id) await patchEvent(cal, e.id, e); else await createEvent(cal, e);
        return;
      }
      const list = loadLocal();
      if (e.id) {
        saveLocal(list.map((x) => (x.id === e.id ? { ...x, ...e, id: x.id, source: 'local' } : x)));
      } else {
        const weeks = Math.max(1, e.repeatWeeks ?? 1);
        const series = weeks > 1 ? `ser-${Date.now()}` : undefined;
        for (let i = 0; i < weeks; i++) {
          const shift = (s: string) => (e.allDay ? addDays(s, i * 7) : `${addDays(s.slice(0, 10), i * 7)}${s.slice(10)}`);
          list.push({ ...e, id: `loc${Date.now()}${i}`, start: shift(e.start), end: shift(e.end), recurringEventId: series, source: 'local' });
        }
        saveLocal(list);
      }
    },
    onSuccess: (_d, e) => done(e.id ? 'Hadisə yeniləndi' : e.repeatWeeks && e.repeatWeeks > 1 ? `${e.repeatWeeks} həftəlik seriya yaradıldı` : 'Hadisə yaradıldı'),
    onError: fail,
  });
}

export function useDeleteEvent() {
  return useMutation({
    mutationFn: async ({ ev, series }: { ev: CalEvent; series?: boolean }) => {
      if (googleModeActive()) {
        await deleteEvent(getGCalConfig().calendarId, series && ev.recurringEventId ? ev.recurringEventId : ev.id);
        return;
      }
      const list = loadLocal();
      saveLocal(list.filter((x) => (series && ev.recurringEventId ? x.recurringEventId !== ev.recurringEventId : x.id !== ev.id)));
    },
    onSuccess: (_d, v) => done(v.series ? 'Seriya silindi' : 'Hadisə silindi'),
    onError: fail,
  });
}

/* ---------------- Məzuniyyətlərin Google-a sinxronlaşdırılması ---------------- */
export interface SyncResult { created: number; updated: number; deleted: number }

export async function syncLeavesToGoogle(leaves: LeaveRequest[], emps: Employee[], onProgress?: (done: number, total: number) => void): Promise<SyncResult> {
  const cal = getGCalConfig().calendarId;
  const year = new Date().getFullYear();
  const from = `${year}-01-01`, to = `${year + 1}-12-31`;
  const existing = await listEvents(cal, from, to, { privateExtendedProperty: 'gttType=leave' });
  const byLeave = new Map(existing.filter((e) => e.leaveId).map((e) => [e.leaveId!, e]));
  const wanted = leaves.filter((l) => l.status === 'təsdiqləndi' && l.endDate >= from && l.startDate <= to);
  const empName = (id: string) => fullName(emps.find((e) => e.id === id));
  const ops: (() => Promise<unknown>)[] = [];
  const res: SyncResult = { created: 0, updated: 0, deleted: 0 };

  for (const l of wanted) {
    const input: CalEventInput = {
      title: `Məzuniyyət: ${empName(l.employeeId)}`, type: 'leave', allDay: true, start: l.startDate, end: l.endDate,
      description: `${l.type} · ${l.days} iş günü${l.reason ? `\n${l.reason}` : ''}\nHR Portal tərəfindən sinxronlaşdırılıb`,
      participants: [l.employeeId], leaveId: l.id,
    };
    const ex = byLeave.get(l.id);
    if (!ex) { ops.push(() => createEvent(cal, input)); res.created++; }
    else if (ex.start !== l.startDate || ex.end !== l.endDate || ex.title !== input.title) { ops.push(() => patchEvent(cal, ex.id, input)); res.updated++; }
    byLeave.delete(l.id);
  }
  for (const stale of byLeave.values()) { ops.push(() => deleteEvent(cal, stale.id)); res.deleted++; }

  // Kvotaya hörmət: ardıcıl, kiçik fasilələrlə
  for (let i = 0; i < ops.length; i++) {
    await ops[i]();
    onProgress?.(i + 1, ops.length);
    if (i < ops.length - 1) await new Promise((r) => setTimeout(r, 120));
  }
  queryClient.invalidateQueries({ queryKey: ['calendar'] });
  return res;
}

/* ---------------- iCalendar (.ics) ixracı ---------------- */
export function downloadICS(events: CalEvent[], filename: string) {
  const esc = (s = '') => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  const dt = (s: string) => s.replace(/[-:]/g, '') + (s.length > 10 ? '00' : '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//GTT//HR Portal//AZ', 'CALSCALE:GREGORIAN', 'X-WR-TIMEZONE:Asia/Baku'];
  for (const e of events) {
    lines.push('BEGIN:VEVENT', `UID:${e.id}@gtt-hr`, `SUMMARY:${esc(e.title)}`);
    if (e.allDay) lines.push(`DTSTART;VALUE=DATE:${dt(e.start)}`, `DTEND;VALUE=DATE:${dt(addDays(e.end, 1))}`);
    else lines.push(`DTSTART;TZID=Asia/Baku:${dt(e.start)}`, `DTEND;TZID=Asia/Baku:${dt(e.end)}`);
    if (e.location) lines.push(`LOCATION:${esc(e.location)}`);
    lines.push(`CATEGORIES:${TYPE_META[e.type].label}`, 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
