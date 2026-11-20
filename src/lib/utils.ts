import type { Employee } from '../types';
import { isHoliday } from './holidays';

export const MONTHS = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'İyun', 'İyul', 'Avqust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'];
export const WEEKDAYS = ['Bazar', 'Bazar ertəsi', 'Çərşənbə axşamı', 'Çərşənbə', 'Cümə axşamı', 'Cümə', 'Şənbə'];
export const WEEKDAYS_SHORT = ['B', 'B.e', 'Ç.a', 'Ç', 'C.a', 'C', 'Ş'];

export const pad = (n: number) => String(n).padStart(2, '0');

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export const todayISO = () => toISO(new Date());

export function parseISO(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, n: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function diffDays(a: string, b: string): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86400000);
}

export function fmtDate(iso?: string, withYear = true): string {
  if (!iso) return '—';
  const d = parseISO(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()].toLowerCase()}${withYear ? ' ' + d.getFullYear() : ''}`;
}

export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return `${fmtDate(toISO(d))}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function relTime(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'indicə';
  if (s < 3600) return `${Math.floor(s / 60)} dəq əvvəl`;
  if (s < 86400) return `${Math.floor(s / 3600)} saat əvvəl`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} gün əvvəl`;
  return fmtDate(iso.slice(0, 10));
}

export function periodLabel(period: string): string {
  const [y, m] = period.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

export const money = (n: number) =>
  new Intl.NumberFormat('az-AZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' ₼';

export const fullName = (e?: Pick<Employee, 'firstName' | 'lastName'>) => (e ? `${e.firstName} ${e.lastName}` : 'Naməlum');
export const initials = (e?: Pick<Employee, 'firstName' | 'lastName'>) =>
  e ? (e.firstName[0] + e.lastName[0]).toLocaleUpperCase('az') : '?';

export function age(birth: string): number {
  const b = parseISO(birth);
  const n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
  return a;
}

export function tenure(hire: string): string {
  const days = diffDays(hire, todayISO());
  const y = Math.floor(days / 365);
  const m = Math.floor((days % 365) / 30);
  if (y === 0) return `${m} ay`;
  return m ? `${y} il ${m} ay` : `${y} il`;
}

/** Case/diacritic-insensitive search for Azerbaijani text */
export function norm(s: string): string {
  return s
    .toLocaleLowerCase('az')
    .replace(/ə/g, 'e').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ü/g, 'u')
    .replace(/ğ/g, 'g').replace(/ş/g, 's').replace(/ç/g, 'c');
}

export function countWorkDays(start: string, end: string): number {
  // Teatrda istirahət günü bazar ertəsidir; rəsmi bayram günləri də çıxılır
  let n = 0;
  for (let d = start; d <= end; d = addDays(d, 1)) if (parseISO(d).getDay() !== 1 && !isHoliday(d)) n++;
  return n;
}

export function downloadCSV(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Azərbaycan dövlət sektoru üçün sadələşdirilmiş tutulmalar */
export function calcPayroll(base: number, bonus: number, overtime: number) {
  const gross = base + bonus + overtime;
  const incomeTax = gross <= 2500 ? Math.max(0, gross - 200) * 0.14 : 350 + (gross - 2500) * 0.25;
  const dsmf = gross * 0.03;
  const unemployment = gross * 0.005;
  const medical = Math.min(gross, 8000) * 0.02;
  const deductions = incomeTax + dsmf + unemployment + medical;
  return { gross, incomeTax, dsmf, unemployment, medical, deductions, net: gross - deductions };
}

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
