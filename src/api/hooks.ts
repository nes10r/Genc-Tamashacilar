import { QueryClient, MutationCache, useMutation, useQuery, keepPreviousData } from '@tanstack/react-query';
import { http, qs } from './client';
import { toast } from '../lib/toast';
import type {
  AttendanceRecord, Candidate, DashboardData, Department, Employee, Evaluation, HrOrder, LeaveRequest, Notification,
  PayrollRun, SearchResult, Training, Vacancy, Activity,
} from '../types';

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: { success?: string; invalidates?: string[] };
  }
}

export const queryClient: QueryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
  mutationCache: new MutationCache({
    onSuccess: (_d, _v, _c, m) => {
      if (m.meta?.success) toast.success(m.meta.success);
      // Hər dəyişiklikdən sonra əlaqəli siyahılar + dashboard yenilənir
      const keys = [...(m.meta?.invalidates ?? []), 'dashboard', 'notifications', 'activity'];
      keys.forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
    },
    onError: (e) => toast.error((e as Error).message || 'Xəta baş verdi'),
  }),
});

/* ---------- Queries ---------- */
export const useDashboard = () => useQuery({ queryKey: ['dashboard'], queryFn: () => http.get<DashboardData>('/dashboard') });
export const useSearch = (q: string) =>
  useQuery({ queryKey: ['search', q], queryFn: () => http.get<SearchResult>('/search' + qs({ q })), enabled: q.trim().length > 1, placeholderData: keepPreviousData });

export const useDepartments = () => useQuery({ queryKey: ['departments'], queryFn: () => http.get<Department[]>('/departments'), staleTime: 300_000 });

export interface EmployeeFilters { search?: string; departmentId?: string; status?: string }
export const useEmployees = (f: EmployeeFilters = {}) =>
  useQuery({ queryKey: ['employees', f], queryFn: () => http.get<Employee[]>('/employees' + qs(f as Record<string, string>)), placeholderData: keepPreviousData });
export const useEmployee = (id?: string) =>
  useQuery({ queryKey: ['employees', 'one', id], queryFn: () => http.get<Employee>(`/employees/${id}`), enabled: !!id });

export const useLeaves = (f: { status?: string; employeeId?: string } = {}) =>
  useQuery({ queryKey: ['leaves', f], queryFn: () => http.get<LeaveRequest[]>('/leaves' + qs(f)) });

export const useAttendance = (p: { date?: string; month?: string }) =>
  useQuery({ queryKey: ['attendance', p], queryFn: () => http.get<AttendanceRecord[]>('/attendance' + qs(p)), placeholderData: keepPreviousData });

export const useVacancies = () => useQuery({ queryKey: ['vacancies'], queryFn: () => http.get<Vacancy[]>('/vacancies') });
export const useCandidates = () => useQuery({ queryKey: ['candidates'], queryFn: () => http.get<Candidate[]>('/candidates') });

export const usePayroll = (period: string) =>
  useQuery({ queryKey: ['payroll', period], queryFn: () => http.get<PayrollRun>(`/payroll/${period}`), placeholderData: keepPreviousData });

export const useOrders = (f: { type?: string; employeeId?: string } = {}) =>
  useQuery({ queryKey: ['orders', f], queryFn: () => http.get<HrOrder[]>('/orders' + qs(f)) });

export const useTrainings = () => useQuery({ queryKey: ['trainings'], queryFn: () => http.get<Training[]>('/trainings') });
export const useEvaluations = (employeeId?: string) =>
  useQuery({ queryKey: ['evaluations', employeeId], queryFn: () => http.get<Evaluation[]>('/evaluations' + qs({ employeeId })) });

export const useNotifications = () =>
  useQuery({ queryKey: ['notifications'], queryFn: () => http.get<Notification[]>('/notifications'), refetchInterval: 60_000 });
export const useActivity = () => useQuery({ queryKey: ['activity'], queryFn: () => http.get<Activity[]>('/activity') });

/* ---------- Mutations ---------- */
function useMut<V, R = unknown>(fn: (v: V) => Promise<R>, invalidates: string[], success?: string | ((v: V) => string)) {
  return useMutation<R, Error, V>({
    mutationFn: fn,
    meta: { invalidates, success: typeof success === 'string' ? success : undefined },
    onSuccess: (_d, v) => { if (typeof success === 'function') toast.success(success(v)); },
  });
}

export const useSaveEmployee = () =>
  useMut((e: Partial<Employee>) => (e.id ? http.put<Employee>(`/employees/${e.id}`, e) : http.post<Employee>('/employees', e)),
    ['employees', 'departments', 'orders'], (e) => (e.id ? 'İşçi məlumatları yeniləndi' : 'Yeni işçi əlavə edildi'));
export const useTerminateEmployee = () =>
  useMut((v: { id: string; date: string; reason: string }) => http.post<Employee>(`/employees/${v.id}/terminate`, v), ['employees', 'orders'], 'İşçi işdən azad edildi, əmr layihəsi hazırlandı');
export const useDeleteEmployee = () => useMut((id: string) => http.del(`/employees/${id}`), ['employees'], 'İşçi silindi');

export const useSaveDepartment = () =>
  useMut((d: Partial<Department>) => (d.id ? http.put(`/departments/${d.id}`, d) : http.post('/departments', d)), ['departments'], 'Bölmə yadda saxlanıldı');
export const useDeleteDepartment = () => useMut((id: string) => http.del(`/departments/${id}`), ['departments'], 'Bölmə silindi');

export const useCreateLeave = () => useMut((l: Partial<LeaveRequest>) => http.post<LeaveRequest>('/leaves', l), ['leaves'], 'Məzuniyyət sorğusu yaradıldı');
export const useSetLeaveStatus = () =>
  useMut((v: { id: string; status: LeaveRequest['status'] }) => http.patch(`/leaves/${v.id}`, { status: v.status }), ['leaves', 'employees', 'orders', 'attendance'],
    (v) => (v.status === 'təsdiqləndi' ? 'Sorğu təsdiqləndi, əmr layihəsi yaradıldı' : 'Sorğu rədd edildi'));
export const useDeleteLeave = () => useMut((id: string) => http.del(`/leaves/${id}`), ['leaves'], 'Sorğu silindi');

export const useSaveAttendance = () =>
  useMut((v: { date: string; records: AttendanceRecord[] }) => http.put('/attendance', v), ['attendance'], 'Davamiyyət yadda saxlanıldı');

export const useSaveVacancy = () =>
  useMut((v: Partial<Vacancy>) => (v.id ? http.put(`/vacancies/${v.id}`, v) : http.post('/vacancies', v)), ['vacancies'], 'Vakansiya yadda saxlanıldı');
export const useDeleteVacancy = () => useMut((id: string) => http.del(`/vacancies/${id}`), ['vacancies', 'candidates'], 'Vakansiya silindi');
export const useCreateCandidate = () => useMut((c: Partial<Candidate>) => http.post('/candidates', c), ['candidates'], 'Namizəd əlavə edildi');
export const useUpdateCandidate = () => useMut((c: Partial<Candidate> & { id: string }) => http.patch(`/candidates/${c.id}`, c), ['candidates']);
export const useDeleteCandidate = () => useMut((id: string) => http.del(`/candidates/${id}`), ['candidates'], 'Namizəd silindi');

export const useSavePayroll = () =>
  useMut((v: Partial<PayrollRun> & { period: string }) => http.put<PayrollRun>(`/payroll/${v.period}`, v), ['payroll']);

export const useCreateOrder = () => useMut((o: Partial<HrOrder>) => http.post<HrOrder>('/orders', o), ['orders'], 'Əmr layihəsi yaradıldı');
export const useUpdateOrder = () =>
  useMut((o: Partial<HrOrder> & { id: string }) => http.patch(`/orders/${o.id}`, o), ['orders'], (o) => (o.status === 'imzalandı' ? 'Əmr imzalandı' : 'Əmr yeniləndi'));
export const useDeleteOrder = () => useMut((id: string) => http.del(`/orders/${id}`), ['orders'], 'Əmr silindi');

export const useSaveTraining = () =>
  useMut((t: Partial<Training>) => (t.id ? http.put(`/trainings/${t.id}`, t) : http.post('/trainings', t)), ['trainings'], 'Təlim yadda saxlanıldı');
export const useDeleteTraining = () => useMut((id: string) => http.del(`/trainings/${id}`), ['trainings'], 'Təlim silindi');
export const useCreateEvaluation = () => useMut((e: Partial<Evaluation>) => http.post('/evaluations', e), ['evaluations'], 'Qiymətləndirmə əlavə edildi');

export const useMarkNotificationsRead = () => useMut((ids: string[]) => http.post('/notifications/read', { ids }), ['notifications']);
