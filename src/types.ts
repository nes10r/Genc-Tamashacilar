export type ID = string;

export interface Department {
  id: ID;
  name: string;
  headId?: ID;
  color: string;
  description: string;
}

export type EmploymentType = 'Ştat' | 'Müqavilə' | 'Əvəzçilik';
export type EmployeeStatus = 'aktiv' | 'məzuniyyətdə' | 'xəstəlik' | 'işdən çıxıb';

export interface Employee {
  id: ID;
  firstName: string;
  lastName: string;
  fatherName: string;
  gender: 'K' | 'Q';
  position: string;
  departmentId: ID;
  email: string;
  phone: string;
  birthDate: string;
  hireDate: string;
  contractEnd?: string;
  salary: number;
  status: EmployeeStatus;
  employmentType: EmploymentType;
  fin: string;
  address: string;
  education: string;
  title?: string; // fəxri ad
  skills: string[];
  emergencyContact: string;
  notes: string;
  terminatedAt?: string;
}

export type LeaveType = 'Əmək məzuniyyəti' | 'Xəstəlik' | 'Ödənişsiz' | 'Analıq' | 'Təhsil' | 'Yaradıcılıq';
export type LeaveStatus = 'gözləyir' | 'təsdiqləndi' | 'rədd edildi';

export interface LeaveRequest {
  id: ID;
  employeeId: ID;
  type: LeaveType;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: LeaveStatus;
  createdAt: string;
}

export type AttendanceStatus = 'gəldi' | 'gecikdi' | 'gəlmədi' | 'məzuniyyət' | 'ezamiyyət' | 'istirahət' | 'bayram';

export interface AttendanceRecord {
  employeeId: ID;
  date: string;
  status: AttendanceStatus;
  checkIn?: string;
  checkOut?: string;
}

export interface Vacancy {
  id: ID;
  title: string;
  departmentId: ID;
  openings: number;
  status: 'açıq' | 'bağlı';
  salaryRange: string;
  description: string;
  createdAt: string;
}

export type CandidateStage = 'müraciət' | 'müsahibə' | 'dinləmə' | 'təklif' | 'qəbul' | 'imtina';

export interface Candidate {
  id: ID;
  name: string;
  vacancyId: ID;
  email: string;
  phone: string;
  stage: CandidateStage;
  rating: number;
  appliedAt: string;
  notes: string;
}

export interface PayrollItem {
  employeeId: ID;
  base: number;
  bonus: number;
  overtime: number;
}

export type PayrollStatus = 'qaralama' | 'təsdiqləndi' | 'ödənildi';

export interface PayrollRun {
  period: string; // YYYY-MM
  status: PayrollStatus;
  items: PayrollItem[];
  updatedAt: string;
}

export type OrderType = 'İşə qəbul' | 'İşdən azad' | 'Məzuniyyət' | 'Köçürmə' | 'Mükafatlandırma' | 'İntizam' | 'Ezamiyyət';

export interface HrOrder {
  id: ID;
  number: string;
  type: OrderType;
  employeeId: ID;
  date: string;
  content: string;
  status: 'qaralama' | 'imzalandı';
}

export interface Training {
  id: ID;
  title: string;
  category: string;
  trainer: string;
  date: string;
  durationHours: number;
  participants: ID[];
  status: 'planlaşdırılıb' | 'davam edir' | 'tamamlandı';
}

export interface Evaluation {
  id: ID;
  employeeId: ID;
  period: string;
  score: number; // 1-5
  reviewer: string;
  strengths: string;
  improvements: string;
  createdAt: string;
}

export interface Notification {
  id: ID;
  kind: 'leave' | 'contract' | 'birthday' | 'candidate' | 'system';
  title: string;
  text: string;
  link: string;
  date: string;
  read: boolean;
}

export interface Activity {
  id: ID;
  text: string;
  date: string;
  kind: 'employee' | 'leave' | 'recruit' | 'order' | 'payroll' | 'training' | 'system';
}

export interface DashboardData {
  stats: {
    headcount: number;
    presentToday: number;
    workingToday: number;
    onLeave: number;
    openVacancies: number;
    pendingLeaves: number;
    newHires90: number;
    candidates: number;
  };
  byDepartment: { id: ID; name: string; color: string; count: number }[];
  byType: { label: string; count: number }[];
  birthdays: { employee: Employee; date: string; inDays: number }[];
  expiringContracts: { employee: Employee; inDays: number }[];
  pendingLeaves: LeaveRequest[];
  activity: Activity[];
}

export interface SearchResult {
  employees: Employee[];
  vacancies: Vacancy[];
  orders: HrOrder[];
}

export type CalEventType = 'performance' | 'rehearsal' | 'shift' | 'leave' | 'other';

export interface CalEvent {
  id: ID;
  title: string;
  type: CalEventType;
  allDay: boolean;
  /** allDay: YYYY-MM-DD; əks halda YYYY-MM-DDTHH:mm (Bakı vaxtı) */
  start: string;
  /** allDay üçün daxil olmaqla son gün */
  end: string;
  location?: string;
  description?: string;
  participants: ID[];
  recurringEventId?: string;
  htmlLink?: string;
  leaveId?: string;
  source: 'google' | 'local' | 'portal' | 'holiday';
  pending?: boolean;
}

export type CalEventInput = Omit<CalEvent, 'id' | 'source'> & { id?: ID; repeatWeeks?: number };

export interface UserProfile {
  firstName: string;
  lastName: string;
  role: string;
  position: string;
  email: string;
  phone: string;
  avatarColor: string;
  notify: { leaveRequests: boolean; contracts: boolean; birthdays: boolean; candidates: boolean; email: boolean };
  updatedAt?: string;
}
