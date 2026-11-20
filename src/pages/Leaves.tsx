import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Plus, Check, X, ChevronLeft, ChevronRight, Trash2, AlertTriangle, PartyPopper, Download } from 'lucide-react';
import { useCreateLeave, useDeleteLeave, useDepartments, useEmployees, useLeaves, useSetLeaveStatus } from '../api/hooks';
import { useHolidays } from '../api/holidays';
import { holidayOn, holidaysBetween } from '../lib/holidays';
import { EmployeePicker, Empty, Field, LeaveBadge, Modal, Person, SkelRows, Tabs, useConfirm } from '../components/ui';
import { ANNUAL_LEAVE } from './EmployeeDetail';
import { addDays, countWorkDays, cx, downloadCSV, fmtDate, fullName, MONTHS, pad, todayISO, WEEKDAYS_SHORT } from '../lib/utils';
import type { LeaveRequest, LeaveType } from '../types';

const TYPES: LeaveType[] = ['Əmək məzuniyyəti', 'Xəstəlik', 'Ödənişsiz', 'Analıq', 'Təhsil', 'Yaradıcılıq'];
const TYPE_COLOR: Record<LeaveType, string> = {
  'Əmək məzuniyyəti': '#2b5c9e', Xəstəlik: '#c68a1d', Ödənişsiz: '#6b6460', Analıq: '#a3376f', Təhsil: '#2f7d6d', Yaradıcılıq: '#5b3a8c',
};
type Tab = 'requests' | 'calendar' | 'balance';

export default function Leaves() {
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>('requests');
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState<string | undefined>();
  const { data: leaves = [] } = useLeaves();
  const pending = leaves.filter((l) => l.status === 'gözləyir').length;

  useEffect(() => {
    if (params.get('new')) {
      setPreset(params.get('employee') ?? undefined);
      setOpen(true);
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Məzuniyyətlər</h1>
          <div className="page-sub">Sorğular, təsdiq prosesi, komanda təqvimi və illik qalıqlar</div>
        </div>
        <button className="btn btn-primary" onClick={() => { setPreset(undefined); setOpen(true); }}><Plus size={16} /> Yeni sorğu</button>
      </div>
      <Tabs value={tab} onChange={setTab} items={[
        { id: 'requests', label: <>Sorğular {pending > 0 && <span className="badge b-warning plain">{pending}</span>}</> },
        { id: 'calendar', label: 'Təqvim' },
        { id: 'balance', label: 'Qalıqlar' },
      ]} />
      {tab === 'requests' && <Requests />}
      {tab === 'calendar' && <Calendar />}
      {tab === 'balance' && <Balance />}
      <LeaveForm open={open} onClose={() => setOpen(false)} employeeId={preset} />
    </>
  );
}

function Requests() {
  const [status, setStatus] = useState('');
  const { data: all = [], isLoading } = useLeaves();
  const { data: emps = [] } = useEmployees();
  const setSt = useSetLeaveStatus();
  const del = useDeleteLeave();
  const confirm = useConfirm();
  const byId = new Map(emps.map((e) => [e.id, e]));
  const list = status ? all.filter((l) => l.status === status) : all;
  const exportCsv = () => downloadCSV('mezuniyyetler.csv', [['İşçi', 'Növ', 'Başlama', 'Bitmə', 'İş günü', 'Status', 'Səbəb'],
    ...list.map((l) => [fullName(byId.get(l.employeeId)), l.type, l.startDate, l.endDate, l.days, l.status, l.reason])]);

  return (
    <>
      <div className="row between mb-16 wrap">
        <div className="chips">
          {['', 'gözləyir', 'təsdiqləndi', 'rədd edildi'].map((s) => (
            <button key={s} className={cx('chip', status === s && 'active')} onClick={() => setStatus(s)}>
              {s ? s[0].toLocaleUpperCase('az') + s.slice(1) : 'Hamısı'} <span className="count">{s ? all.filter((l) => l.status === s).length : all.length}</span>
            </button>
          ))}
        </div>
        <button className="btn btn-sm" onClick={exportCsv}><Download size={14} /> CSV</button>
      </div>
      <div className="card table-wrap">
        {isLoading ? <SkelRows /> : list.length === 0 ? <Empty title="Sorğu yoxdur" /> : (
          <table className="table">
            <thead><tr><th>İşçi</th><th>Növ</th><th>Müddət</th><th className="num">İş günü</th><th>Status</th><th /></tr></thead>
            <tbody>
              {list.map((l) => (
                <tr key={l.id}>
                  <td><Link to={`/employees/${l.employeeId}`}><Person e={byId.get(l.employeeId)} /></Link></td>
                  <td><span className="row small"><i style={{ width: 8, height: 8, borderRadius: 2, background: TYPE_COLOR[l.type], display: 'inline-block' }} />{l.type}</span><div className="small muted">{l.reason}</div></td>
                  <td className="small">{fmtDate(l.startDate)} – {fmtDate(l.endDate)}</td>
                  <td className="num strong">{l.days}</td>
                  <td><LeaveBadge s={l.status} /></td>
                  <td className="num">
                    {l.status === 'gözləyir' ? (
                      <div className="row" style={{ justifyContent: 'flex-end' }}>
                        <button className="btn btn-sm btn-success" onClick={() => setSt.mutate({ id: l.id, status: 'təsdiqləndi' })}><Check size={14} /> Təsdiqlə</button>
                        <button className="btn btn-sm btn-danger" onClick={() => setSt.mutate({ id: l.id, status: 'rədd edildi' })}><X size={14} /> Rədd et</button>
                      </div>
                    ) : (
                      <button className="icon-btn sm" aria-label="Sil" onClick={async () => { if (await confirm({ title: 'Sorğunu silmək?', confirm: 'Sil', danger: true })) del.mutate(l.id); }}><Trash2 size={15} /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function Calendar() {
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const { data: leaves = [] } = useLeaves();
  const { data: emps = [] } = useEmployees();
  useHolidays(ym.y);
  const byId = new Map(emps.map((e) => [e.id, e]));
  const first = new Date(ym.y, ym.m, 1);
  const lead = (first.getDay() + 6) % 7;
  const start = addDays(`${ym.y}-${pad(ym.m + 1)}-01`, -lead);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const active = leaves.filter((l) => l.status !== 'rədd edildi');
  const today = todayISO();
  const shift = (d: number) => setYm(({ y, m }) => { const t = new Date(y, m + d, 1); return { y: t.getFullYear(), m: t.getMonth() }; });

  return (
    <>
      <div className="toolbar">
        <div className="seg">
          <button onClick={() => shift(-1)} aria-label="Əvvəlki"><ChevronLeft size={15} /></button>
          <button className="on" style={{ minWidth: 140 }}>{MONTHS[ym.m]} {ym.y}</button>
          <button onClick={() => shift(1)} aria-label="Növbəti"><ChevronRight size={15} /></button>
        </div>
        <div className="legend" style={{ marginLeft: 'auto' }}>
          {TYPES.map((t) => <span key={t}><i style={{ background: TYPE_COLOR[t] }} />{t}</span>)}
          <span><i style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent)' }} />Bayram</span>
        </div>
      </div>
      <div className="cal">
        {[1, 2, 3, 4, 5, 6, 0].map((d) => <div key={d} className="cal-h">{WEEKDAYS_SHORT[d]}</div>)}
        {cells.map((iso) => {
          const evs = active.filter((l) => l.startDate <= iso && l.endDate >= iso);
          const h = holidayOn(iso);
          return (
            <div key={iso} className={cx('cal-d', iso.slice(5, 7) !== pad(ym.m + 1) && 'out', iso === today && 'today', h && 'hol')}>
              <div className="cal-n">{Number(iso.slice(8))}</div>
              {h && <div className="cal-hol" title={h.name}>★ {h.name}</div>}
              {evs.slice(0, h ? 2 : 3).map((l) => (
                <div key={l.id} className="cal-ev" style={{ background: TYPE_COLOR[l.type], opacity: l.status === 'gözləyir' ? .55 : 1 }}
                  title={`${fullName(byId.get(l.employeeId))} — ${l.type}${l.status === 'gözləyir' ? ' (gözləyir)' : ''}`}>
                  {byId.get(l.employeeId)?.firstName} {byId.get(l.employeeId)?.lastName[0]}.
                </div>
              ))}
              {evs.length > (h ? 2 : 3) && <div className="cal-more">+{evs.length - (h ? 2 : 3)} nəfər</div>}
            </div>
          );
        })}
      </div>
      <div className="small muted mt-8">Şəffaf rənglər təsdiq gözləyən sorğuları göstərir.</div>
    </>
  );
}

function Balance() {
  const { data: leaves = [] } = useLeaves();
  const { data: emps = [] } = useEmployees();
  const { data: depts = [] } = useDepartments();
  const [dept, setDept] = useState('');
  const year = String(new Date().getFullYear());
  const rows = emps.filter((e) => e.status !== 'işdən çıxıb' && (!dept || e.departmentId === dept)).map((e) => {
    const mine = leaves.filter((l) => l.employeeId === e.id && l.startDate.startsWith(year));
    const used = mine.filter((l) => l.status === 'təsdiqləndi' && l.type === 'Əmək məzuniyyəti').reduce((s, l) => s + l.days, 0);
    const planned = mine.filter((l) => l.status === 'gözləyir' && l.type === 'Əmək məzuniyyəti').reduce((s, l) => s + l.days, 0);
    const sick = mine.filter((l) => l.status === 'təsdiqləndi' && l.type === 'Xəstəlik').reduce((s, l) => s + l.days, 0);
    return { e, used, planned, sick, left: ANNUAL_LEAVE - used };
  }).sort((a, b) => b.left - a.left);

  return (
    <>
      <div className="toolbar">
        <select className="select" style={{ width: 240 }} value={dept} onChange={(e) => setDept(e.target.value)}>
          <option value="">Bütün bölmələr</option>
          {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <span className="small muted">İllik norma: {ANNUAL_LEAVE} iş günü (yaradıcı heyət üçün uzadılmış). Bayram günləri məzuniyyət müddətinə daxil edilmir.</span>
      </div>
      <div className="card table-wrap">
        <table className="table">
          <thead><tr><th>İşçi</th><th style={{ width: '30%' }}>İstifadə</th><th className="num">İstifadə</th><th className="num">Gözləyir</th><th className="num">Xəstəlik</th><th className="num">Qalıq</th></tr></thead>
          <tbody>
            {rows.map(({ e, used, planned, sick, left }) => (
              <tr key={e.id}>
                <td><Person e={e} /></td>
                <td><div className="bar"><i style={{ width: `${Math.min(100, (used / ANNUAL_LEAVE) * 100)}%`, background: left < 5 ? 'var(--danger)' : 'var(--info)' }} /></div></td>
                <td className="num">{used}</td>
                <td className="num">{planned || '—'}</td>
                <td className="num">{sick || '—'}</td>
                <td className="num"><span className={cx('badge plain', left > 20 ? 'b-success' : left > 5 ? 'b-info' : 'b-danger')}>{left} gün</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function LeaveForm({ open, onClose, employeeId }: { open: boolean; onClose: () => void; employeeId?: string }) {
  const { data: emps = [] } = useEmployees();
  const { data: leaves = [] } = useLeaves();
  const create = useCreateLeave();
  const blank = (): Partial<LeaveRequest> => ({ employeeId, type: 'Əmək məzuniyyəti', startDate: addDays(todayISO(), 7), endDate: addDays(todayISO(), 20), reason: '' });
  const [f, setF] = useState<Partial<LeaveRequest>>(blank);
  const [autoApprove, setAutoApprove] = useState(false);
  useEffect(() => { if (open) { setF(blank()); setAutoApprove(false); } }, [open, employeeId]); // eslint-disable-line
  useHolidays(Number((f.startDate ?? todayISO()).slice(0, 4)));

  const emp = emps.find((e) => e.id === f.employeeId);
  const valid = !!(f.employeeId && f.startDate && f.endDate && f.endDate >= f.startDate);
  const days = valid ? countWorkDays(f.startDate!, f.endDate!) : 0;
  const hols = valid ? holidaysBetween(f.startDate!, f.endDate!) : [];
  const year = String(new Date().getFullYear());
  const used = leaves.filter((l) => l.employeeId === f.employeeId && l.status === 'təsdiqləndi' && l.type === 'Əmək məzuniyyəti' && l.startDate.startsWith(year)).reduce((s, l) => s + l.days, 0);
  const left = ANNUAL_LEAVE - used;
  const overlaps = useMemo(() => {
    if (!emp || !valid) return [];
    return leaves.filter((l) => l.status !== 'rədd edildi' && l.employeeId !== emp.id && l.startDate <= f.endDate! && l.endDate >= f.startDate!)
      .map((l) => emps.find((e) => e.id === l.employeeId)).filter((e) => e && e.departmentId === emp.departmentId);
  }, [emp, valid, leaves, emps, f.startDate, f.endDate]);

  const submit = () => create.mutate({ ...f, status: autoApprove ? 'təsdiqləndi' : 'gözləyir' }, { onSuccess: onClose });

  return (
    <Modal open={open} onClose={onClose} title="Məzuniyyət sorğusu"
      footer={<>
        <button className="btn" onClick={onClose}>Ləğv et</button>
        <button className="btn btn-primary" disabled={!valid || create.isPending} onClick={submit}>{autoApprove ? 'Yarat və təsdiqlə' : 'Sorğu göndər'}</button>
      </>}>
      <div className="form-grid">
        <Field label="İşçi *" full><EmployeePicker employees={emps.filter((e) => e.status !== 'işdən çıxıb')} value={f.employeeId} onChange={(id) => setF({ ...f, employeeId: id })} /></Field>
        <Field label="Növ" full>
          <div className="chips">
            {TYPES.map((t) => <button type="button" key={t} className={cx('chip', f.type === t && 'active')} onClick={() => setF({ ...f, type: t })}>{t}</button>)}
          </div>
        </Field>
        <Field label="Başlama tarixi"><input type="date" className="input" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value, endDate: f.endDate! < e.target.value ? e.target.value : f.endDate })} /></Field>
        <Field label="Bitmə tarixi" error={f.endDate && f.startDate && f.endDate < f.startDate ? 'Başlama tarixindən əvvəl ola bilməz' : undefined}><input type="date" className="input" min={f.startDate} value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} /></Field>
        <Field label="Səbəb / qeyd" full><input className="input" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></Field>
      </div>

      {valid && (
        <div className="grid mt-16" style={{ gap: 8 }}>
          <div className="banner info">
            <div><b>{days} iş günü</b> ({fmtDate(f.startDate)} – {fmtDate(f.endDate)}). Bazar ertələri{hols.length > 0 ? ' və bayram günləri' : ''} hesaba daxil edilmir.
              {f.type === 'Əmək məzuniyyəti' && emp && <> Qalıq: <b>{left}</b> gün → sorğudan sonra <b>{left - days}</b> gün.</>}</div>
          </div>
          {hols.length > 0 && (
            <div className="banner" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
              <PartyPopper size={18} style={{ flexShrink: 0 }} />
              <div>Bu dövrə {hols.length} bayram günü düşür və məzuniyyət müddətinə əlavə olunmur (ƏM, maddə 133):
                <div className="small" style={{ marginTop: 2 }}>{hols.map((h) => `${fmtDate(h.observed ?? h.date, false)} — ${h.name}`).join(' · ')}</div>
              </div>
            </div>
          )}
          {f.type === 'Əmək məzuniyyəti' && emp && days > left && <div className="banner err"><AlertTriangle size={18} /> Sorğu illik qalığı {days - left} gün aşır.</div>}
          {overlaps.length > 0 && <div className="banner warn"><AlertTriangle size={18} style={{ flexShrink: 0 }} /><div>Həmin tarixlərdə eyni bölmədən {overlaps.length} nəfər məzuniyyətdə olacaq: {overlaps.map((e) => fullName(e!)).join(', ')}. Repertuar planına təsirini yoxlayın.</div></div>}
          <label className="check"><input type="checkbox" checked={autoApprove} onChange={(e) => setAutoApprove(e.target.checked)} /> Dərhal təsdiqlə (HR tərəfindən daxil edilir)</label>
        </div>
      )}
    </Modal>
  );
}
