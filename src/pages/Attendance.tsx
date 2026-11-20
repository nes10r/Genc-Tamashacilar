import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Save, CheckCheck, Download, PartyPopper } from 'lucide-react';
import { useAttendance, useDepartments, useEmployees, useSaveAttendance } from '../api/hooks';
import { useHolidays } from '../api/holidays';
import { holidayOn } from '../lib/holidays';
import { Person, SkelRows, Empty, Tabs } from '../components/ui';
import { addDays, cx, downloadCSV, fmtDate, fullName, MONTHS, pad, parseISO, todayISO, WEEKDAYS, WEEKDAYS_SHORT } from '../lib/utils';
import type { AttendanceRecord, AttendanceStatus } from '../types';

export const ATT: Record<AttendanceStatus, { color: string; short: string; label: string }> = {
  gəldi: { color: '#2f7d4f', short: 'İ', label: 'Gəldi' },
  gecikdi: { color: '#c68a1d', short: 'G', label: 'Gecikdi' },
  gəlmədi: { color: '#b42318', short: 'Q', label: 'Gəlmədi' },
  məzuniyyət: { color: '#2b5c9e', short: 'M', label: 'Məzuniyyət' },
  ezamiyyət: { color: '#5b3a8c', short: 'E', label: 'Ezamiyyət' },
  istirahət: { color: '#9a8e86', short: '—', label: 'İstirahət' },
  bayram: { color: '#8c1c2b', short: 'B', label: 'Bayram' },
};
const EDITABLE: AttendanceStatus[] = ['gəldi', 'gecikdi', 'gəlmədi', 'məzuniyyət', 'ezamiyyət', 'bayram'];

export default function Attendance() {
  const [view, setView] = useState<'day' | 'month'>('day');
  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Davamiyyət</h1>
          <div className="page-sub">Gündəlik qeydiyyat və aylıq iş vaxtı tabeli · bazar ertəsi və rəsmi bayramlar avtomatik nəzərə alınır</div>
        </div>
      </div>
      <Tabs value={view} onChange={setView} items={[{ id: 'day', label: 'Gündəlik qeyd' }, { id: 'month', label: 'Aylıq tabel' }]} />
      {view === 'day' ? <Daily /> : <Monthly />}
    </>
  );
}

function Daily() {
  const [date, setDate] = useState(todayISO());
  const [dept, setDept] = useState('');
  const { data: depts = [] } = useDepartments();
  const { data: emps = [] } = useEmployees();
  const { data = [], isLoading } = useAttendance({ date });
  useHolidays(Number(date.slice(0, 4)));
  const save = useSaveAttendance();
  const [draft, setDraft] = useState<Record<string, AttendanceRecord>>({});
  useEffect(() => setDraft({}), [date]);

  const holiday = holidayOn(date);
  const isMonday = parseISO(date).getDay() === 1;
  const future = date > todayISO();
  const rows = useMemo(() => {
    const m = new Map(data.map((r) => [r.employeeId, r]));
    return emps
      .filter((e) => e.status !== 'işdən çıxıb' && (!dept || e.departmentId === dept) && e.hireDate <= date)
      .map((e) => ({ e, r: draft[e.id] ?? m.get(e.id) ?? { employeeId: e.id, date, status: 'gəlmədi' as const } }));
  }, [emps, data, draft, dept, date]);
  const dirty = Object.keys(draft).length;
  const counts = EDITABLE.map((s) => ({ s, n: rows.filter((x) => x.r.status === s).length }));

  const setRec = (r: AttendanceRecord, patch: Partial<AttendanceRecord>) => {
    const next = { ...r, ...patch };
    if (patch.status === 'gəldi' && !next.checkIn) { next.checkIn = '09:00'; next.checkOut = next.checkOut ?? '18:00'; }
    if (patch.status && !['gəldi', 'gecikdi'].includes(patch.status)) { delete next.checkIn; delete next.checkOut; }
    setDraft((d) => ({ ...d, [r.employeeId]: next }));
  };

  return (
    <>
      <div className="toolbar">
        <div className="seg">
          <button onClick={() => setDate(addDays(date, -1))} aria-label="Əvvəlki gün"><ChevronLeft size={15} /></button>
          <button className="on" style={{ minWidth: 190 }}>{WEEKDAYS[parseISO(date).getDay()]}, {fmtDate(date)}</button>
          <button onClick={() => setDate(addDays(date, 1))} disabled={date >= todayISO()} aria-label="Növbəti gün"><ChevronRight size={15} /></button>
        </div>
        <input type="date" className="input" style={{ width: 160 }} value={date} max={todayISO()} onChange={(e) => e.target.value && setDate(e.target.value)} />
        {date !== todayISO() && <button className="btn btn-sm" onClick={() => setDate(todayISO())}>Bu gün</button>}
        <select className="select" style={{ width: 220 }} value={dept} onChange={(e) => setDept(e.target.value)}>
          <option value="">Bütün bölmələr</option>
          {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <div className="row" style={{ marginLeft: 'auto' }}>
          <button className="btn" disabled={future || isMonday} onClick={() => rows.forEach(({ r }) => r.status === 'gəlmədi' && setRec(r, { status: 'gəldi' }))}><CheckCheck size={16} /> Qalanları "gəldi" qeyd et</button>
          <button className="btn btn-primary" disabled={!dirty || save.isPending} onClick={() => save.mutate({ date, records: Object.values(draft) }, { onSuccess: () => setDraft({}) })}>
            <Save size={16} /> Yadda saxla {dirty > 0 && `(${dirty})`}
          </button>
        </div>
      </div>

      {holiday && <div className="banner warn mb-16" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}><PartyPopper size={18} /> <div><b>{holiday.name}</b> — rəsmi qeyri-iş günü. Tamaşa və ya növbətçilik olarsa, işləyən əməkdaşları ayrıca qeyd edin (ƏM, maddə 165 — ikiqat ödəniş).</div></div>}
      {isMonday && <div className="banner info mb-16">Bazar ertəsi — teatrın istirahət günüdür.</div>}
      {future && <div className="banner info mb-16">Gələcək tarix üçün davamiyyət qeyd edilə bilməz.</div>}

      <div className="chips mb-16">
        {counts.map(({ s, n }) => <span key={s} className="chip" style={{ cursor: 'default' }}><i style={{ width: 8, height: 8, borderRadius: 2, background: ATT[s].color, display: 'inline-block' }} />{ATT[s].label} <span className="count">{n}</span></span>)}
      </div>

      <div className="card table-wrap">
        {isLoading ? <SkelRows /> : rows.length === 0 ? <Empty title="Qeyd yoxdur" /> : (
          <table className="table">
            <thead><tr><th>İşçi</th><th>Status</th><th>Gəliş</th><th>Gediş</th></tr></thead>
            <tbody>
              {rows.map(({ e, r }) => (
                <tr key={e.id} style={draft[e.id] ? { boxShadow: 'inset 3px 0 0 var(--gold)' } : undefined}>
                  <td><Person e={e} /></td>
                  <td>
                    {r.status === 'istirahət' ? <span className="badge plain">İstirahət günü</span> : (
                      <div className="att-btns">
                        {EDITABLE.map((s) => (
                          <button key={s} className={cx('att-btn', r.status === s && 'on')} disabled={future}
                            style={r.status === s ? { background: ATT[s].color } : undefined} onClick={() => setRec(r, { status: s })}>{ATT[s].label}</button>
                        ))}
                      </div>
                    )}
                  </td>
                  <td>{['gəldi', 'gecikdi'].includes(r.status) ? <input type="time" className="input" style={{ width: 110 }} value={r.checkIn ?? ''} onChange={(x) => setRec(r, { checkIn: x.target.value, status: x.target.value > '09:15' ? 'gecikdi' : 'gəldi' })} /> : <span className="muted">—</span>}</td>
                  <td>{['gəldi', 'gecikdi'].includes(r.status) ? <input type="time" className="input" style={{ width: 110 }} value={r.checkOut ?? ''} onChange={(x) => setRec(r, { checkOut: x.target.value })} /> : <span className="muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function Monthly() {
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() + 1 });
  const [dept, setDept] = useState('');
  const month = `${ym.y}-${pad(ym.m)}`;
  const { data: depts = [] } = useDepartments();
  const { data: emps = [] } = useEmployees();
  const { data = [], isLoading } = useAttendance({ month });
  useHolidays(ym.y);
  const days = new Date(ym.y, ym.m, 0).getDate();
  const map = useMemo(() => {
    const m = new Map<string, AttendanceRecord>();
    data.forEach((r) => m.set(r.employeeId + r.date, r));
    return m;
  }, [data]);
  const list = emps.filter((e) => e.status !== 'işdən çıxıb' && (!dept || e.departmentId === dept));
  const shift = (d: number) => setYm(({ y, m }) => { const t = new Date(y, m - 1 + d, 1); return { y: t.getFullYear(), m: t.getMonth() + 1 }; });

  const exportCsv = () => downloadCSV(`tabel-${month}.csv`, [
    ['İşçi', 'Vəzifə', ...Array.from({ length: days }, (_, i) => String(i + 1)), 'İşlənmiş gün', 'Gecikmə', 'Buraxılış'],
    ...list.map((e) => {
      const cells = Array.from({ length: days }, (_, i) => { const r = map.get(e.id + `${month}-${pad(i + 1)}`); return r ? ATT[r.status].short : ''; });
      const recs = Array.from({ length: days }, (_, i) => map.get(e.id + `${month}-${pad(i + 1)}`)).filter(Boolean) as AttendanceRecord[];
      return [fullName(e), e.position, ...cells, recs.filter((r) => ['gəldi', 'gecikdi', 'ezamiyyət'].includes(r.status)).length, recs.filter((r) => r.status === 'gecikdi').length, recs.filter((r) => r.status === 'gəlmədi').length];
    }),
  ]);

  return (
    <>
      <div className="toolbar">
        <div className="seg">
          <button onClick={() => shift(-1)} aria-label="Əvvəlki ay"><ChevronLeft size={15} /></button>
          <button className="on" style={{ minWidth: 140 }}>{MONTHS[ym.m - 1]} {ym.y}</button>
          <button onClick={() => shift(1)} aria-label="Növbəti ay"><ChevronRight size={15} /></button>
        </div>
        <select className="select" style={{ width: 220 }} value={dept} onChange={(e) => setDept(e.target.value)}>
          <option value="">Bütün bölmələr</option>
          {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <button className="btn" style={{ marginLeft: 'auto' }} onClick={exportCsv}><Download size={16} /> Tabeli yüklə (CSV)</button>
      </div>
      <div className="legend mb-16">{Object.entries(ATT).map(([k, v]) => <span key={k}><i style={{ background: v.color }} />{v.short} — {v.label}</span>)}</div>
      <div className="card card-pad table-wrap">
        {isLoading ? <SkelRows /> : (
          <table className="tabel">
            <thead>
              <tr>
                <th />
                {Array.from({ length: days }, (_, i) => {
                  const iso = `${month}-${pad(i + 1)}`;
                  const wd = parseISO(iso).getDay();
                  const h = holidayOn(iso);
                  return <th key={i} className={cx((wd === 1 || h) && 'wk')} title={h?.name}>{i + 1}<div style={{ fontSize: 9 }}>{h ? '★' : WEEKDAYS_SHORT[wd]}</div></th>;
                })}
                <th style={{ paddingLeft: 8 }}>Cəmi</th>
              </tr>
            </thead>
            <tbody>
              {list.map((e) => {
                let worked = 0;
                return (
                  <tr key={e.id}>
                    <td className="name">{fullName(e)}</td>
                    {Array.from({ length: days }, (_, i) => {
                      const iso = `${month}-${pad(i + 1)}`;
                      const r = map.get(e.id + iso);
                      if (r && ['gəldi', 'gecikdi', 'ezamiyyət'].includes(r.status)) worked++;
                      const c = r ? ATT[r.status] : null;
                      return <td key={i} className="cell" title={r ? `${fmtDate(iso)}: ${c!.label}${r.checkIn ? ` (${r.checkIn}–${r.checkOut})` : ''}` : ''}
                        style={{ background: c ? (r!.status === 'istirahət' ? 'var(--line-2)' : c.color) : 'transparent', color: r?.status === 'istirahət' ? 'var(--muted)' : '#fff' }}>{c?.short}</td>;
                    })}
                    <td className="strong" style={{ paddingLeft: 8 }}>{worked}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
