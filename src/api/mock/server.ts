/**
 * Daxili Demo API — real backend-in REST müqaviləsini təqlid edir.
 * Məlumatlar brauzerin localStorage-ında saxlanılır.
 * Real backend hazır olduqda Ayarlar → API bölməsindən "Canlı API" rejiminə keçin.
 */
import type {
  AttendanceRecord, Candidate, DashboardData, Employee, HrOrder, LeaveRequest, Notification,
  PayrollRun, Activity,
} from '../../types';
import { addDays, diffDays, norm, todayISO, parseISO, pad, countWorkDays } from '../../lib/utils';
import { createSeed, genAttendance, isoNow, type DB } from './seed';

const KEY = 'gtt-hr-db';
let db: DB = load();

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DB;
      if (parsed.version === 3) return parsed;
    }
  } catch { /* ignore */ }
  const s = createSeed();
  persist(s);
  return s;
}
function persist(d: DB = db) {
  try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* quota */ }
}
export function resetMockDb() {
  db = createSeed();
  persist();
}

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const nid = (p: string) => `${p}${++db.seq}`;
const log = (text: string, kind: Activity['kind']) => {
  db.activity.unshift({ id: nid('a'), text, date: isoNow(), kind });
  db.activity = db.activity.slice(0, 60);
};
const empName = (id: string) => {
  const e = db.employees.find((x) => x.id === id);
  return e ? `${e.firstName} ${e.lastName}` : 'İşçi';
};
function find<T extends { id: string }>(arr: T[], id: string, label = 'Qeyd'): T {
  const x = arr.find((a) => a.id === id);
  if (!x) throw new HttpError(404, `${label} tapılmadı`);
  return x;
}
function required(body: Record<string, unknown>, fields: string[]) {
  const miss = fields.filter((f) => body[f] === undefined || body[f] === '' || body[f] === null);
  if (miss.length) throw new HttpError(422, `Məcburi sahələr doldurulmayıb: ${miss.join(', ')}`);
}

type Q = URLSearchParams;
type Handler = (p: Record<string, string>, q: Q, body: any) => unknown;
const routes: { method: string; pattern: string; re: RegExp; keys: string[]; h: Handler; doc: string }[] = [];
function route(method: string, pattern: string, doc: string, h: Handler) {
  const keys: string[] = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  routes.push({ method, pattern, re, keys, h, doc });
}

/* ---------------- Health ---------------- */
route('GET', '/health', 'Sistem vəziyyəti', () => ({ status: 'ok', mode: 'mock', time: isoNow() }));

/* ---------------- Dashboard ---------------- */
route('GET', '/dashboard', 'İdarə paneli üçün ümumi göstəricilər', () => {
  const today = todayISO();
  const active = db.employees.filter((e) => e.status !== 'işdən çıxıb');
  const att = attendanceFor(today);
  const working = att.filter((a) => !['istirahət', 'məzuniyyət', 'bayram'].includes(a.status));
  const present = att.filter((a) => a.status === 'gəldi' || a.status === 'gecikdi');
  const now = new Date();
  const birthdays = active
    .map((e) => {
      const b = parseISO(e.birthDate);
      let next = new Date(now.getFullYear(), b.getMonth(), b.getDate());
      if (next < new Date(now.getFullYear(), now.getMonth(), now.getDate())) next = new Date(now.getFullYear() + 1, b.getMonth(), b.getDate());
      const iso = `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`;
      return { employee: e, date: iso, inDays: diffDays(today, iso) };
    })
    .filter((x) => x.inDays <= 30)
    .sort((a, b) => a.inDays - b.inDays);
  const expiringContracts = active
    .filter((e) => e.contractEnd)
    .map((e) => ({ employee: e, inDays: diffDays(today, e.contractEnd!) }))
    .filter((x) => x.inDays <= 60)
    .sort((a, b) => a.inDays - b.inDays);
  const types = ['Ştat', 'Müqavilə', 'Əvəzçilik'];
  const data: DashboardData = {
    stats: {
      headcount: active.length,
      presentToday: present.length,
      workingToday: working.length,
      onLeave: active.filter((e) => e.status === 'məzuniyyətdə' || e.status === 'xəstəlik').length,
      openVacancies: db.vacancies.filter((v) => v.status === 'açıq').reduce((s, v) => s + v.openings, 0),
      pendingLeaves: db.leaves.filter((l) => l.status === 'gözləyir').length,
      newHires90: active.filter((e) => diffDays(e.hireDate, today) <= 90).length,
      candidates: db.candidates.filter((c) => !['qəbul', 'imtina'].includes(c.stage)).length,
    },
    byDepartment: db.departments.map((d) => ({ id: d.id, name: d.name, color: d.color, count: active.filter((e) => e.departmentId === d.id).length })),
    byType: types.map((t) => ({ label: t, count: active.filter((e) => e.employmentType === t).length })),
    birthdays,
    expiringContracts,
    pendingLeaves: db.leaves.filter((l) => l.status === 'gözləyir').sort((a, b) => a.startDate.localeCompare(b.startDate)),
    activity: db.activity.slice(0, 8),
  };
  return data;
});

/* ---------------- Search ---------------- */
route('GET', '/search', 'Qlobal axtarış (?q=)', (_, q) => {
  const term = norm(q.get('q') ?? '');
  if (!term) return { employees: [], vacancies: [], orders: [] };
  return {
    employees: db.employees.filter((e) => norm(`${e.firstName} ${e.lastName} ${e.position} ${e.fin}`).includes(term)).slice(0, 6),
    vacancies: db.vacancies.filter((v) => norm(v.title).includes(term)).slice(0, 3),
    orders: db.orders.filter((o) => norm(`${o.number} ${o.type}`).includes(term)).slice(0, 3),
  };
});

/* ---------------- Departments ---------------- */
route('GET', '/departments', 'Struktur bölmələrinin siyahısı', () => db.departments);
route('POST', '/departments', 'Yeni bölmə', (_, __, b: any) => {
  required(b as any, ['name']);
  const d = { ...b, id: nid('d') };
  db.departments.push(d);
  log(`"${d.name}" bölməsi yaradıldı`, 'system');
  return d;
});
route('PUT', '/departments/:id', 'Bölməni yenilə', (p, _, b) => Object.assign(find(db.departments, p.id, 'Bölmə'), b, { id: p.id }));
route('DELETE', '/departments/:id', 'Bölməni sil', (p) => {
  if (db.employees.some((e) => e.departmentId === p.id && e.status !== 'işdən çıxıb'))
    throw new HttpError(409, 'Bu bölmədə aktiv işçilər var. Əvvəlcə onları başqa bölməyə köçürün.');
  db.departments = db.departments.filter((d) => d.id !== p.id);
  return null;
});

/* ---------------- Employees ---------------- */
route('GET', '/employees', 'İşçilər (?search=&departmentId=&status=)', (_, q) => {
  let list = db.employees;
  const s = q.get('search');
  if (s) list = list.filter((e) => norm(`${e.firstName} ${e.lastName} ${e.fatherName} ${e.position} ${e.email} ${e.fin}`).includes(norm(s)));
  const d = q.get('departmentId');
  if (d) list = list.filter((e) => e.departmentId === d);
  const st = q.get('status');
  if (st) list = list.filter((e) => e.status === st);
  return list;
});
route('GET', '/employees/:id', 'İşçi profili', (p) => find(db.employees, p.id, 'İşçi'));
route('POST', '/employees', 'Yeni işçi', (_, __, b: any) => {
  required(b as any, ['firstName', 'lastName', 'position', 'departmentId', 'hireDate']);
  if (b.fin && db.employees.some((e) => e.fin === b.fin)) throw new HttpError(409, `FİN ${b.fin} artıq sistemdə mövcuddur`);
  const e: Employee = { skills: [], notes: '', status: 'aktiv', ...b, id: nid('e') };
  db.employees.push(e);
  log(`${e.firstName} ${e.lastName} işə qəbul edildi (${e.position})`, 'employee');
  return e;
});
route('PUT', '/employees/:id', 'İşçi məlumatlarını yenilə', (p, _, b) => {
  const e = find(db.employees, p.id, 'İşçi');
  if (b.departmentId && b.departmentId !== e.departmentId) log(`${e.firstName} ${e.lastName} başqa bölməyə köçürüldü`, 'employee');
  return Object.assign(e, b, { id: p.id });
});
route('POST', '/employees/:id/terminate', 'İşçini işdən azad et', (p, _, b) => {
  const e = find(db.employees, p.id, 'İşçi');
  e.status = 'işdən çıxıb';
  e.terminatedAt = b?.date ?? todayISO();
  createOrder({ type: 'İşdən azad', employeeId: e.id, date: e.terminatedAt!, content: b?.reason ? `Səbəb: ${b.reason}` : '', status: 'qaralama' });
  log(`${e.firstName} ${e.lastName} işdən azad edildi`, 'employee');
  return e;
});
route('DELETE', '/employees/:id', 'İşçini sil', (p) => {
  find(db.employees, p.id, 'İşçi');
  db.employees = db.employees.filter((e) => e.id !== p.id);
  return null;
});

/* ---------------- Leaves ---------------- */
route('GET', '/leaves', 'Məzuniyyət sorğuları (?status=&employeeId=)', (_, q) => {
  let l = db.leaves;
  if (q.get('status')) l = l.filter((x) => x.status === q.get('status'));
  if (q.get('employeeId')) l = l.filter((x) => x.employeeId === q.get('employeeId'));
  return [...l].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
});
route('POST', '/leaves', 'Yeni məzuniyyət sorğusu', (_, __, b: any) => {
  required(b as any, ['employeeId', 'type', 'startDate', 'endDate']);
  if (b.endDate < b.startDate) throw new HttpError(422, 'Bitmə tarixi başlama tarixindən əvvəl ola bilməz');
  const overlap = db.leaves.find((l) => l.employeeId === b.employeeId && l.status !== 'rədd edildi' && l.startDate <= b.endDate && l.endDate >= b.startDate);
  if (overlap) throw new HttpError(409, 'Bu işçinin həmin tarixlərdə artıq məzuniyyət sorğusu var');
  const l: LeaveRequest = { reason: '', ...b, days: countWorkDays(b.startDate, b.endDate), status: b.status ?? 'gözləyir', id: nid('l'), createdAt: isoNow() };
  db.leaves.push(l);
  log(`${empName(l.employeeId)} üçün məzuniyyət sorğusu yaradıldı (${l.days} gün)`, 'leave');
  return l;
});
route('PATCH', '/leaves/:id', 'Sorğunu təsdiqlə / rədd et', (p, _, b: { status: LeaveRequest['status'] }) => {
  const l = find(db.leaves, p.id, 'Sorğu');
  l.status = b.status;
  const t = todayISO();
  const e = db.employees.find((x) => x.id === l.employeeId);
  if (b.status === 'təsdiqləndi') {
    if (e && l.startDate <= t && l.endDate >= t) e.status = l.type === 'Xəstəlik' ? 'xəstəlik' : 'məzuniyyətdə';
    if (l.type !== 'Xəstəlik') createOrder({ type: 'Məzuniyyət', employeeId: l.employeeId, date: t, content: '', status: 'qaralama' });
    delete db.attendance[t];
  }
  log(`${empName(l.employeeId)} — məzuniyyət sorğusu ${b.status === 'təsdiqləndi' ? 'təsdiqləndi' : 'rədd edildi'}`, 'leave');
  return l;
});
route('DELETE', '/leaves/:id', 'Sorğunu sil', (p) => { db.leaves = db.leaves.filter((l) => l.id !== p.id); return null; });

/* ---------------- Attendance ---------------- */
function attendanceFor(date: string): AttendanceRecord[] {
  if (date > todayISO()) return [];
  if (!db.attendance[date]) db.attendance[date] = genAttendance(db, date);
  return db.attendance[date];
}
route('GET', '/attendance', 'Davamiyyət (?date=YYYY-MM-DD və ya ?month=YYYY-MM)', (_, q) => {
  const month = q.get('month');
  if (month) {
    const [y, m] = month.split('-').map(Number);
    const days = new Date(y, m, 0).getDate();
    const out: AttendanceRecord[] = [];
    for (let d = 1; d <= days; d++) out.push(...attendanceFor(`${month}-${pad(d)}`));
    return out;
  }
  return attendanceFor(q.get('date') ?? todayISO());
});
route('PUT', '/attendance', 'Davamiyyəti yadda saxla (toplu)', (_, __, b: { date: string; records: AttendanceRecord[] }) => {
  const existing = attendanceFor(b.date);
  for (const r of b.records) {
    const i = existing.findIndex((x) => x.employeeId === r.employeeId);
    if (i >= 0) existing[i] = { ...r, date: b.date }; else existing.push({ ...r, date: b.date });
  }
  return existing;
});

/* ---------------- Recruitment ---------------- */
route('GET', '/vacancies', 'Vakansiyalar', () => db.vacancies);
route('POST', '/vacancies', 'Yeni vakansiya', (_, __, b: any) => {
  required(b as any, ['title', 'departmentId']);
  const v = { status: 'açıq' as const, openings: 1, ...b, id: nid('v'), createdAt: todayISO() };
  db.vacancies.push(v);
  log(`"${v.title}" vakansiyası elan edildi`, 'recruit');
  return v;
});
route('PUT', '/vacancies/:id', 'Vakansiyanı yenilə', (p, _, b) => Object.assign(find(db.vacancies, p.id, 'Vakansiya'), b, { id: p.id }));
route('DELETE', '/vacancies/:id', 'Vakansiyanı sil', (p) => {
  db.vacancies = db.vacancies.filter((v) => v.id !== p.id);
  db.candidates = db.candidates.filter((c) => c.vacancyId !== p.id);
  return null;
});
route('GET', '/candidates', 'Namizədlər (?vacancyId=)', (_, q) => (q.get('vacancyId') ? db.candidates.filter((c) => c.vacancyId === q.get('vacancyId')) : db.candidates));
route('POST', '/candidates', 'Yeni namizəd', (_, __, b: any) => {
  required(b as any, ['name', 'vacancyId']);
  const c: Candidate = { stage: 'müraciət', rating: 3, notes: '', email: '', phone: '', ...b, id: nid('c'), appliedAt: todayISO() };
  db.candidates.push(c);
  log(`${c.name} namizəd kimi əlavə edildi`, 'recruit');
  return c;
});
route('PATCH', '/candidates/:id', 'Namizədi yenilə (mərhələ, reytinq, qeyd)', (p, _, b: Partial<Candidate>) => {
  const c = find(db.candidates, p.id, 'Namizəd');
  if (b.stage && b.stage !== c.stage) log(`${c.name} → "${b.stage}" mərhələsinə keçdi`, 'recruit');
  return Object.assign(c, b, { id: p.id });
});
route('DELETE', '/candidates/:id', 'Namizədi sil', (p) => { db.candidates = db.candidates.filter((c) => c.id !== p.id); return null; });

/* ---------------- Payroll ---------------- */
route('GET', '/payroll/:period', 'Aylıq əmək haqqı cədvəli (yoxdursa yaradılır)', (p) => {
  let run = db.payroll.find((r) => r.period === p.period);
  if (!run) {
    run = {
      period: p.period, status: 'qaralama', updatedAt: isoNow(),
      items: db.employees.filter((e) => e.status !== 'işdən çıxıb').map((e) => ({ employeeId: e.id, base: e.salary, bonus: 0, overtime: 0 })),
    };
    db.payroll.push(run);
  }
  return run;
});
route('PUT', '/payroll/:period', 'Əmək haqqı cədvəlini yenilə / statusunu dəyiş', (p, _, b: Partial<PayrollRun>) => {
  const run = db.payroll.find((r) => r.period === p.period);
  if (!run) throw new HttpError(404, 'Cədvəl tapılmadı');
  if (run.status === 'ödənildi' && b.items) throw new HttpError(409, 'Ödənilmiş cədvəl dəyişdirilə bilməz');
  if (b.status && b.status !== run.status) log(`${p.period} dövrü üzrə əmək haqqı: ${b.status}`, 'payroll');
  return Object.assign(run, b, { period: p.period, updatedAt: isoNow() });
});
route('GET', '/payroll', 'Bütün dövrlər', () => db.payroll.map((r) => ({ period: r.period, status: r.status, updatedAt: r.updatedAt })));

/* ---------------- Orders ---------------- */
function createOrder(b: Omit<HrOrder, 'id' | 'number'>): HrOrder {
  const n = db.orders.length + 1;
  const suffix = b.type === 'Məzuniyyət' ? 'M' : b.type === 'Ezamiyyət' ? 'E' : 'K';
  const o: HrOrder = { ...b, id: nid('o'), number: `${n}/${suffix}-${new Date().getFullYear()}` };
  db.orders.push(o);
  return o;
}
route('GET', '/orders', 'Kadr əmrləri (?type=&employeeId=)', (_, q) => {
  let o = db.orders;
  if (q.get('type')) o = o.filter((x) => x.type === q.get('type'));
  if (q.get('employeeId')) o = o.filter((x) => x.employeeId === q.get('employeeId'));
  return [...o].sort((a, b) => b.date.localeCompare(a.date));
});
route('POST', '/orders', 'Yeni əmr', (_, __, b: any) => {
  required(b as any, ['type', 'employeeId', 'date']);
  const o = createOrder({ content: '', status: 'qaralama', ...b });
  log(`${o.type} əmri hazırlandı — ${empName(o.employeeId)}`, 'order');
  return o;
});
route('PATCH', '/orders/:id', 'Əmri yenilə / imzala', (p, _, b) => {
  const o = find(db.orders, p.id, 'Əmr');
  if (b.status === 'imzalandı' && o.status !== 'imzalandı') log(`${o.number} nömrəli əmr imzalandı`, 'order');
  return Object.assign(o, b, { id: p.id });
});
route('DELETE', '/orders/:id', 'Əmri sil', (p) => {
  const o = find(db.orders, p.id, 'Əmr');
  if (o.status === 'imzalandı') throw new HttpError(409, 'İmzalanmış əmr silinə bilməz');
  db.orders = db.orders.filter((x) => x.id !== p.id);
  return null;
});

/* ---------------- Training & Evaluation ---------------- */
route('GET', '/trainings', 'Təlimlər', () => [...db.trainings].sort((a, b) => b.date.localeCompare(a.date)));
route('POST', '/trainings', 'Yeni təlim', (_, __, b: any) => {
  required(b as any, ['title', 'date']);
  const t = { participants: [], status: 'planlaşdırılıb' as const, ...b, id: nid('t') };
  db.trainings.push(t);
  log(`"${t.title}" təlimi planlaşdırıldı`, 'training');
  return t;
});
route('PUT', '/trainings/:id', 'Təlimi yenilə', (p, _, b) => Object.assign(find(db.trainings, p.id, 'Təlim'), b, { id: p.id }));
route('DELETE', '/trainings/:id', 'Təlimi sil', (p) => { db.trainings = db.trainings.filter((t) => t.id !== p.id); return null; });
route('GET', '/evaluations', 'Qiymətləndirmələr (?employeeId=)', (_, q) =>
  (q.get('employeeId') ? db.evaluations.filter((e) => e.employeeId === q.get('employeeId')) : db.evaluations).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
route('POST', '/evaluations', 'Yeni qiymətləndirmə', (_, __, b: any) => {
  required(b as any, ['employeeId', 'score', 'period']);
  const ev = { ...b, id: nid('ev'), createdAt: todayISO() };
  db.evaluations.push(ev);
  log(`${empName(ev.employeeId)} qiymətləndirildi (${ev.score}/5)`, 'training');
  return ev;
});
route('DELETE', '/evaluations/:id', 'Qiymətləndirməni sil', (p) => { db.evaluations = db.evaluations.filter((e) => e.id !== p.id); return null; });

/* ---------------- Notifications & activity ---------------- */
route('GET', '/notifications', 'Bildirişlər', () => {
  const today = todayISO();
  const list: Notification[] = [];
  db.leaves.filter((l) => l.status === 'gözləyir').forEach((l) =>
    list.push({ id: `n-l-${l.id}`, kind: 'leave', title: 'Yeni məzuniyyət sorğusu', text: `${empName(l.employeeId)} — ${l.days} gün (${l.type})`, link: '/leaves', date: l.createdAt, read: false }));
  db.employees.filter((e) => e.status !== 'işdən çıxıb' && e.contractEnd && diffDays(today, e.contractEnd) <= 30).forEach((e) => {
    const d = diffDays(today, e.contractEnd!);
    list.push({ id: `n-c-${e.id}-${e.contractEnd}`, kind: 'contract', title: d < 0 ? 'Müqavilə müddəti bitib' : 'Müqavilə müddəti bitir', text: `${e.firstName} ${e.lastName} — ${d < 0 ? `${-d} gün əvvəl bitib` : `${d} gün qalıb`}`, link: `/employees/${e.id}`, date: addDays(e.contractEnd!, -30) + 'T09:00:00', read: false });
  });
  db.employees.filter((e) => e.status !== 'işdən çıxıb' && e.birthDate.slice(5) === today.slice(5)).forEach((e) =>
    list.push({ id: `n-b-${e.id}-${today}`, kind: 'birthday', title: 'Bu gün ad günüdür 🎉', text: `${e.firstName} ${e.lastName} təbrik etməyi unutmayın`, link: `/employees/${e.id}`, date: today + 'T08:00:00', read: false }));
  db.candidates.filter((c) => c.stage === 'müraciət' && diffDays(c.appliedAt, today) <= 3).forEach((c) =>
    list.push({ id: `n-r-${c.id}`, kind: 'candidate', title: 'Yeni namizəd müraciəti', text: c.name, link: '/recruitment', date: c.appliedAt + 'T10:00:00', read: false }));
  return list.map((n) => ({ ...n, read: db.readNotifications.includes(n.id) })).sort((a, b) => b.date.localeCompare(a.date));
});
route('POST', '/notifications/read', 'Bildirişləri oxunmuş qeyd et ({ids})', (_, __, b: { ids: string[] }) => {
  db.readNotifications = Array.from(new Set([...db.readNotifications, ...b.ids]));
  return null;
});
route('GET', '/activity', 'Son fəaliyyətlər', () => db.activity);

/* ---------------- Dispatcher ---------------- */
export const mockRoutes = routes.map(({ method, pattern, doc }) => ({ method, pattern, doc }));

export async function mockHandle(method: string, url: string, body?: unknown): Promise<unknown> {
  await new Promise((r) => setTimeout(r, 120 + Math.random() * 260));
  const [path, qs] = url.split('?');
  const q = new URLSearchParams(qs);
  for (const r of routes) {
    if (r.method !== method) continue;
    const m = path.match(r.re);
    if (!m) continue;
    const params: Record<string, string> = {};
    r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
    const result = r.h(params, q, body ? structuredClone(body) : undefined);
    if (method !== 'GET' || path === '/dashboard' || path.startsWith('/attendance') || path.startsWith('/payroll')) persist();
    return result === undefined || result === null ? null : structuredClone(result);
  }
  throw new HttpError(404, `Endpoint tapılmadı: ${method} ${path}`);
}
