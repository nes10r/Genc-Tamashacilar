import type {
  Activity, Candidate, Department, Employee, EmploymentType, Evaluation, HrOrder, LeaveRequest, LeaveType, PayrollRun,
  Training, Vacancy, AttendanceRecord,
} from '../../types';
import { addDays, todayISO, toISO, pad, countWorkDays } from '../../lib/utils';
import { isHoliday } from '../../lib/holidays';

export interface DB {
  version: number;
  departments: Department[];
  employees: Employee[];
  leaves: LeaveRequest[];
  attendance: Record<string, AttendanceRecord[]>; // date -> records
  vacancies: Vacancy[];
  candidates: Candidate[];
  payroll: PayrollRun[];
  orders: HrOrder[];
  trainings: Training[];
  evaluations: Evaluation[];
  activity: Activity[];
  readNotifications: string[];
  seq: number;
  me?: import('../../types').UserProfile;
  passwordChangedAt?: string;
}

function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const R = rng(20261120);
const pick = <T,>(a: T[]) => a[Math.floor(R() * a.length)];
const int = (a: number, b: number) => a + Math.floor(R() * (b - a + 1));

const MALE = ['Rəşad', 'Elvin', 'Orxan', 'Tural', 'Kamran', 'Fərid', 'Nicat', 'Vüqar', 'Samir', 'Emil', 'Ruslan', 'Murad', 'Anar', 'Elşən', 'Ramil', 'Cavid', 'Toğrul', 'Ilkin'];
const FEMALE = ['Aysel', 'Günay', 'Leyla', 'Nərmin', 'Səbinə', 'Türkan', 'Ülviyyə', 'Aynur', 'Fidan', 'Lalə', 'Könül', 'Zəhra', 'Nigar', 'Sevinc', 'Gülnar', 'Aytən'];
const LAST = ['Məmmədov', 'Əliyev', 'Həsənov', 'Hüseynov', 'Quliyev', 'Abbasov', 'İsmayılov', 'Rzayev', 'Kərimov', 'Babayev', 'Nəsirov', 'Cəfərov', 'Səfərov', 'Vəliyev', 'Orucov', 'Paşayev'];
const FATHER = ['Əli', 'Vaqif', 'Rafiq', 'Tofiq', 'Elçin', 'Fikrət', 'Mübariz', 'Arif', 'Namiq', 'Zaur', 'İlham', 'Akif'];
const STREETS = ['Nizami küç.', 'Füzuli küç.', 'Ü.Hacıbəyli küç.', 'Azadlıq pr.', 'Nəriman Nərimanov pr.', 'Hüseyn Cavid pr.', 'Bakıxanov küç.', 'Səməd Vurğun küç.'];
const LATIN: Record<string, string> = { ə: 'e', ı: 'i', ö: 'o', ü: 'u', ğ: 'g', ş: 's', ç: 'c', İ: 'i', Ə: 'e', Ü: 'u', Ö: 'o', Ş: 's', Ç: 'c', Ğ: 'g' };
const latin = (s: string) => s.replace(/[əıöüğşçİƏÜÖŞÇĞ]/g, (c) => LATIN[c] ?? c).toLowerCase();

export const DEPARTMENTS: Department[] = [
  { id: 'd1', name: 'Rəhbərlik', color: '#8c1c2b', description: 'Teatrın ümumi idarəetməsi və strateji planlaşdırma' },
  { id: 'd2', name: 'Aktyor truppası', color: '#c8963e', description: 'Dram və uşaq tamaşalarının aktyor heyəti' },
  { id: 'd3', name: 'Rejissorluq hissəsi', color: '#5b3a8c', description: 'Quruluşçu rejissorlar, assistentlər, səhnə müdirləri' },
  { id: 'd4', name: 'Bədii-tərtibat sexi', color: '#2f7d6d', description: 'Dekorasiya, geyim, butafor və qrim' },
  { id: 'd5', name: 'Texniki xidmət', color: '#2b5c9e', description: 'Səs, işıq, səhnə mexanikası' },
  { id: 'd6', name: 'Musiqi hissəsi', color: '#b4572a', description: 'Bəstəkar, konsertmeyster, musiqiçilər' },
  { id: 'd7', name: 'Ədəbi hissə və təhsil', color: '#6b7a2a', description: 'Repertuar, dramaturgiya, uşaqlar üçün təhsil proqramları' },
  { id: 'd8', name: 'Marketinq və tamaşaçı xidməti', color: '#a3376f', description: 'Kassa, reklam, sosial media, inzibatçılar' },
  { id: 'd9', name: 'Maliyyə və inzibati', color: '#4a5560', description: 'Mühasibatlıq, kadrlar, təsərrüfat' },
];

const POSITIONS: Record<string, [string, number][]> = {
  d1: [['Direktor', 2600], ['Bədii rəhbər', 2400], ['Direktor müavini', 2000]],
  d2: [['Aparıcı aktyor', 1350], ['Aktyor', 1050], ['Aktyor', 1050], ['Aktyor', 1050], ['Gənc aktyor', 850], ['Kukla aktyoru', 950]],
  d3: [['Quruluşçu rejissor', 1600], ['Rejissor assistenti', 900], ['Səhnə müdiri', 950]],
  d4: [['Baş rəssam', 1500], ['Dekorator', 850], ['Geyim tikən', 750], ['Qrimçi', 780], ['Butafor', 760]],
  d5: [['Baş texnik', 1200], ['İşıq ustası', 900], ['Səs rejissoru', 950], ['Səhnə montajçısı', 720]],
  d6: [['Musiqi rəhbəri', 1300], ['Konsertmeyster', 950], ['Musiqiçi', 820]],
  d7: [['Ədəbi hissə müdiri', 1200], ['Dramaturq', 1000], ['Təhsil proqramları koordinatoru', 900]],
  d8: [['Marketinq meneceri', 1150], ['SMM mütəxəssisi', 900], ['Kassir', 650], ['İnzibatçı', 680]],
  d9: [['Baş mühasib', 1500], ['Kadrlar üzrə mütəxəssis', 1000], ['Mühasib', 900], ['Təsərrüfat müdiri', 850]],
};
const DEPT_SIZE: Record<string, number> = { d1: 3, d2: 14, d3: 4, d4: 6, d5: 6, d6: 4, d7: 3, d8: 5, d9: 4 };
const SKILLS: Record<string, string[]> = {
  d2: ['Səhnə danışığı', 'Plastika', 'Vokal', 'Kukla teatrı', 'İmprovizasiya', 'Rəqs', 'Pantomima'],
  d3: ['Quruluş', 'Səhnə idarəetməsi', 'Dramaturji təhlil'],
  d4: ['Dekor dizaynı', 'Tikiş', 'Qrim', 'Butafor', '3D modelləmə'],
  d5: ['DMX işıq pultu', 'Səs miksi', 'Səhnə mexanikası', 'Elektrik təhlükəsizliyi'],
  d6: ['Fortepiano', 'Tar', 'Aranjiman', 'Vokal müşayiət'],
  d7: ['Redaktə', 'Uşaq psixologiyası', 'Pedaqogika'],
  d8: ['SMM', 'Dizayn', 'Bilet sistemi', 'Müştəri xidməti'],
  d9: ['1C Mühasibat', 'Əmək qanunvericiliyi', 'Excel'],
  d1: ['Strateji idarəetmə', 'Layihə idarəetməsi'],
};
const TITLES = ['Xalq artisti', 'Əməkdar artist', 'Əməkdar artist', 'Əməkdar incəsənət xadimi'];

function genEmployees(): Employee[] {
  const list: Employee[] = [];
  const today = todayISO();
  let n = 1;
  for (const d of DEPARTMENTS) {
    for (let i = 0; i < DEPT_SIZE[d.id]; i++) {
      const g: 'K' | 'Q' = R() < 0.5 ? 'K' : 'Q';
      const first = g === 'K' ? pick(MALE) : pick(FEMALE);
      const last = pick(LAST) + (g === 'Q' ? 'a' : '');
      const father = pick(FATHER) + (g === 'K' ? ' oğlu' : ' qızı');
      const [position, salary] = POSITIONS[d.id][i % POSITIONS[d.id].length];
      const birth = `${int(1964, 2001)}-${pad(int(1, 12))}-${pad(int(1, 28))}`;
      const hire = addDays(today, -int(40, 365 * 22));
      const type: EmploymentType = d.id === 'd2' || d.id === 'd1' ? (R() < 0.85 ? 'Ştat' : 'Müqavilə') : pick(['Ştat', 'Ştat', 'Ştat', 'Müqavilə', 'Əvəzçilik']);
      const senior = position.includes('Aparıcı') || position.includes('Bədii') || position.includes('Quruluşçu') || position.includes('Baş rəssam');
      list.push({
        id: `e${n}`,
        firstName: first, lastName: last, fatherName: father, gender: g,
        position, departmentId: d.id,
        email: `${latin(first)}.${latin(last)}@gtt.az`,
        phone: `+994 ${pick(['50', '51', '55', '70', '77'])} ${int(200, 999)} ${pad(int(10, 99))} ${pad(int(10, 99))}`,
        birthDate: birth, hireDate: hire,
        contractEnd: type !== 'Ştat' ? addDays(today, int(-5, 240)) : undefined,
        salary: salary + int(0, 6) * 25,
        status: 'aktiv',
        employmentType: type,
        fin: Array.from({ length: 7 }, () => '0123456789ABCDEFGHJKLMNPRSTUVXYZ'[int(0, 31)]).join(''),
        address: `Bakı, ${pick(STREETS)} ${int(1, 140)}`,
        education: pick(['ADMİU, Aktyor sənəti', 'ADMİU, Rejissorluq', 'Bakı Musiqi Akademiyası', 'ADU, Filologiya', 'UNEC, Mühasibat', 'Rəssamlıq Akademiyası', 'Texniki peşə məktəbi', 'BDU, Jurnalistika']),
        title: senior && R() < 0.75 ? pick(TITLES) : d.id === 'd2' && R() < 0.2 ? 'Əməkdar artist' : undefined,
        skills: Array.from(new Set([pick(SKILLS[d.id]), pick(SKILLS[d.id]), pick(SKILLS[d.id])])),
        emergencyContact: `${pick([...MALE, ...FEMALE])} — +994 50 ${int(200, 999)} ${pad(int(10, 99))} ${pad(int(10, 99))}`,
        notes: '',
      });
      n++;
    }
  }
  // birthdays soon for dashboard
  const soon = (offset: number, idx: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    list[idx].birthDate = `${int(1975, 1998)}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  soon(0, 5); soon(3, 12); soon(9, 22); soon(17, 31);
  return list;
}

function workDays(s: string, e: string) { return countWorkDays(s, e); }

export function createSeed(): DB {
  const today = todayISO();
  const employees = genEmployees();
  const departments = DEPARTMENTS.map((d) => ({ ...d, headId: employees.find((e) => e.departmentId === d.id)?.id }));
  const types: LeaveType[] = ['Əmək məzuniyyəti', 'Əmək məzuniyyəti', 'Xəstəlik', 'Ödənişsiz', 'Təhsil', 'Yaradıcılıq'];
  const leaves: LeaveRequest[] = [];
  let li = 1;
  const mk = (emp: Employee, start: string, len: number, status: LeaveRequest['status'], type?: LeaveType) => {
    const end = addDays(start, len - 1);
    leaves.push({
      id: `l${li++}`, employeeId: emp.id, type: type ?? pick(types), startDate: start, endDate: end,
      days: workDays(start, end), status, reason: pick(['Ailə ilə istirahət', 'Müalicə', 'Şəxsi səbəblər', 'Festivalda iştirak', 'İmtahan sessiyası', 'Mövsümlərarası istirahət']),
      createdAt: new Date(Date.now() - int(1, 20) * 86400000).toISOString(),
    });
  };
  // current leaves
  [3, 15, 27].forEach((i) => { mk(employees[i], addDays(today, -int(1, 6)), int(8, 18), 'təsdiqləndi', 'Əmək məzuniyyəti'); employees[i].status = 'məzuniyyətdə'; });
  mk(employees[19], addDays(today, -2), 7, 'təsdiqləndi', 'Xəstəlik'); employees[19].status = 'xəstəlik';
  // pending
  [8, 24, 36, 41].forEach((i) => mk(employees[i], addDays(today, int(5, 40)), int(5, 21), 'gözləyir'));
  // history
  for (let k = 0; k < 22; k++) mk(pick(employees), addDays(today, -int(20, 330)), int(3, 21), R() < 0.9 ? 'təsdiqləndi' : 'rədd edildi');
  // future approved
  for (let k = 0; k < 5; k++) mk(pick(employees), addDays(today, int(10, 60)), int(5, 14), 'təsdiqləndi', 'Əmək məzuniyyəti');

  // one terminated employee
  employees[44].status = 'işdən çıxıb';
  employees[44].terminatedAt = addDays(today, -40);

  const vacancies: Vacancy[] = [
    { id: 'v1', title: 'Kukla aktyoru', departmentId: 'd2', openings: 2, status: 'açıq', salaryRange: '850–1000 ₼', description: 'Kukla teatrı təcrübəsi olan, uşaq auditoriyası ilə işləməyi sevən aktyor axtarırıq.', createdAt: addDays(today, -18) },
    { id: 'v2', title: 'İşıq ustası', departmentId: 'd5', openings: 1, status: 'açıq', salaryRange: '850–950 ₼', description: 'DMX pultlarla iş təcrübəsi, növbəli iş qrafikinə hazır olmaq.', createdAt: addDays(today, -9) },
    { id: 'v3', title: 'Təhsil proqramları koordinatoru', departmentId: 'd7', openings: 1, status: 'açıq', salaryRange: '900–1100 ₼', description: 'Məktəblərlə əməkdaşlıq, teatr dərsləri və master-klassların təşkili.', createdAt: addDays(today, -4) },
    { id: 'v4', title: 'Geyim tikən', departmentId: 'd4', openings: 1, status: 'bağlı', salaryRange: '700–800 ₼', description: 'Səhnə geyimlərinin tikilməsi və təmiri.', createdAt: addDays(today, -60) },
  ];
  const cNames = ['Nurlan Əsədov', 'Səidə Kazımova', 'Ayan Rüstəmli', 'Elnur Qasımov', 'Fəridə Bağırova', 'Rauf Zeynalov', 'Mələk Hacıyeva', 'Kənan Əhmədov', 'Xəyal Mirzəyev', 'Gülşən Nağıyeva', 'Pərvin Şükürova', 'Arzu Məlikova'];
  const stages: Candidate['stage'][] = ['müraciət', 'müraciət', 'müsahibə', 'dinləmə', 'dinləmə', 'təklif', 'müraciət', 'müsahibə', 'imtina', 'müraciət', 'qəbul', 'müsahibə'];
  const candidates: Candidate[] = cNames.map((name, i) => ({
    id: `c${i + 1}`, name, vacancyId: ['v1', 'v1', 'v1', 'v2', 'v1', 'v2', 'v3', 'v3', 'v1', 'v3', 'v4', 'v2'][i],
    email: latin(name.split(' ')[0]) + '@mail.az', phone: `+994 55 ${int(200, 999)} ${pad(int(10, 99))} ${pad(int(10, 99))}`,
    stage: stages[i], rating: int(2, 5), appliedAt: addDays(today, -int(1, 25)),
    notes: pick(['Portfoliosu güclüdür.', 'Uşaq teatrı təcrübəsi var.', 'Dinləmədə yaxşı səhnə hərəkəti göstərdi.', '', 'Tövsiyə məktubu təqdim edib.']),
  }));

  const orders: HrOrder[] = [];
  let on = 1;
  const year = new Date().getFullYear();
  employees.filter((e) => e.hireDate > addDays(today, -200)).forEach((e) => {
    orders.push({ id: `o${on}`, number: `${on}/K-${year}`, type: 'İşə qəbul', employeeId: e.id, date: e.hireDate, status: 'imzalandı', content: '' });
    on++;
  });
  leaves.filter((l) => l.status === 'təsdiqləndi' && l.type === 'Əmək məzuniyyəti').slice(0, 6).forEach((l) => {
    orders.push({ id: `o${on}`, number: `${on}/M-${year}`, type: 'Məzuniyyət', employeeId: l.employeeId, date: addDays(l.startDate, -3), status: 'imzalandı', content: '' });
    on++;
  });
  orders.push({ id: `o${on}`, number: `${on}/K-${year}`, type: 'Mükafatlandırma', employeeId: 'e5', date: addDays(today, -1), status: 'qaralama', content: '' }); on++;
  orders.push({ id: `o${on}`, number: `${on}/K-${year}`, type: 'İşdən azad', employeeId: employees[44].id, date: employees[44].terminatedAt!, status: 'imzalandı', content: '' }); on++;

  const trainings: Training[] = [
    { id: 't1', title: 'Uşaq auditoriyası ilə ünsiyyət psixologiyası', category: 'Peşəkar inkişaf', trainer: 'Dr. Nərgiz Əlizadə', date: addDays(today, 6), durationHours: 8, participants: employees.filter((e) => e.departmentId === 'd2').slice(0, 9).map((e) => e.id), status: 'planlaşdırılıb' },
    { id: 't2', title: 'Səhnədə yanğın təhlükəsizliyi və təxliyə', category: 'Əmək təhlükəsizliyi', trainer: 'FHN təlimatçısı', date: addDays(today, -12), durationHours: 4, participants: employees.slice(0, 30).map((e) => e.id), status: 'tamamlandı' },
    { id: 't3', title: 'Müasir işıq texnologiyaları (LED, DMX)', category: 'Texniki', trainer: 'Stage Tech Academy', date: addDays(today, -1), durationHours: 16, participants: employees.filter((e) => e.departmentId === 'd5').map((e) => e.id), status: 'davam edir' },
    { id: 't4', title: 'Kukla teatrında hərəkət ustalığı — master-klass', category: 'Yaradıcı', trainer: 'Beynəlxalq UNIMA eksperti', date: addDays(today, 21), durationHours: 12, participants: employees.filter((e) => e.departmentId === 'd2').slice(5, 12).map((e) => e.id), status: 'planlaşdırılıb' },
    { id: 't5', title: 'İlk tibbi yardım', category: 'Əmək təhlükəsizliyi', trainer: 'Qızıl Aypara', date: addDays(today, -45), durationHours: 6, participants: employees.slice(20, 40).map((e) => e.id), status: 'tamamlandı' },
  ];

  const evaluations: Evaluation[] = employees.slice(0, 26).filter(() => R() < 0.7).map((e, i) => ({
    id: `ev${i + 1}`, employeeId: e.id, period: `${year - 1}/${year} mövsümü`, score: int(3, 5), reviewer: 'Bədii rəhbər',
    strengths: pick(['Rola dərin yanaşma', 'Komanda işi', 'Məsuliyyət və dəqiqlik', 'Yaradıcı təşəbbüskarlıq']),
    improvements: pick(['Vaxt idarəetməsi', 'Səhnə danışığı', 'Sənədləşmə', 'Yeni texnologiyalara uyğunlaşma']),
    createdAt: addDays(today, -int(10, 120)),
  }));

  const now = Date.now();
  const activity: Activity[] = [
    { id: 'a1', text: 'Nurlan Əsədov "Kukla aktyoru" vakansiyasına müraciət etdi', date: new Date(now - 3600e3 * 2).toISOString(), kind: 'recruit' },
    { id: 'a2', text: `${employees[8].firstName} ${employees[8].lastName} məzuniyyət sorğusu göndərdi`, date: new Date(now - 3600e3 * 5).toISOString(), kind: 'leave' },
    { id: 'a3', text: '"Səhnədə yanğın təhlükəsizliyi" təlimi tamamlandı', date: new Date(now - 86400e3 * 2).toISOString(), kind: 'training' },
    { id: 'a4', text: 'Oktyabr ayı əmək haqqı cədvəli təsdiqləndi', date: new Date(now - 86400e3 * 4).toISOString(), kind: 'payroll' },
    { id: 'a5', text: 'Mükafatlandırma əmri layihəsi hazırlandı', date: new Date(now - 86400e3 * 1).toISOString(), kind: 'order' },
  ];

  const prev = new Date(); prev.setMonth(prev.getMonth() - 1);
  const prevPeriod = `${prev.getFullYear()}-${pad(prev.getMonth() + 1)}`;
  const payroll: PayrollRun[] = [{
    period: prevPeriod, status: 'ödənildi', updatedAt: new Date(now - 86400e3 * 4).toISOString(),
    items: employees.filter((e) => e.status !== 'işdən çıxıb').map((e) => ({ employeeId: e.id, base: e.salary, bonus: R() < 0.2 ? int(1, 4) * 50 : 0, overtime: e.departmentId === 'd5' && R() < 0.5 ? int(2, 6) * 20 : 0 })),
  }];

  return {
    version: 3, departments, employees, leaves, attendance: {}, vacancies, candidates, payroll, orders, trainings, evaluations,
    activity, readNotifications: [], seq: 1000,
  };
}

/** Deterministik davamiyyət — tarix üçün ilk dəfə sorğulananda yaradılır */
export function genAttendance(db: DB, date: string): AttendanceRecord[] {
  const r = rng(Number(date.replace(/-/g, '')));
  const isMonday = new Date(date + 'T00:00:00').getDay() === 1;
  return db.employees
    .filter((e) => e.hireDate <= date && (!e.terminatedAt || e.terminatedAt > date))
    .map((e) => {
      const leave = db.leaves.find((l) => l.employeeId === e.id && l.status === 'təsdiqləndi' && l.startDate <= date && l.endDate >= date);
      if (isHoliday(date)) return { employeeId: e.id, date, status: 'bayram' as const };
      if (isMonday) return { employeeId: e.id, date, status: 'istirahət' as const };
      if (leave) return { employeeId: e.id, date, status: 'məzuniyyət' as const };
      const x = r();
      if (x < 0.06) return { employeeId: e.id, date, status: 'gəlmədi' as const };
      if (x < 0.08) return { employeeId: e.id, date, status: 'ezamiyyət' as const };
      const late = x < 0.18;
      const h = late ? 10 : 9;
      return {
        employeeId: e.id, date, status: late ? ('gecikdi' as const) : ('gəldi' as const),
        checkIn: `${pad(late ? 10 : h - (r() < 0.5 ? 1 : 0))}:${pad(Math.floor(r() * 60))}`,
        checkOut: `${pad(18 + Math.floor(r() * 4))}:${pad(Math.floor(r() * 60))}`,
      };
    });
}

export const isoNow = () => new Date().toISOString();
export { toISO };
