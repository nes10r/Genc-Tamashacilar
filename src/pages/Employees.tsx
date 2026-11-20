import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, LayoutGrid, List, Download, Mail, Phone, ArrowUpDown, Award } from 'lucide-react';
import { useDepartments, useEmployees } from '../api/hooks';
import EmployeeForm from '../components/EmployeeForm';
import { Avatar, EmpStatus, Empty, Person, SkelRows, useDebounced } from '../components/ui';
import { cx, downloadCSV, fmtDate, fullName, money, tenure } from '../lib/utils';
import type { Employee, EmployeeStatus } from '../types';

const STATUSES: (EmployeeStatus | '')[] = ['', 'aktiv', 'məzuniyyətdə', 'xəstəlik', 'işdən çıxıb'];
type SortKey = 'name' | 'hireDate' | 'salary' | 'department';

export default function Employees() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [dept, setDept] = useState(params.get('dept') ?? '');
  const [status, setStatus] = useState<string>('');
  const [view, setView] = useState<'table' | 'cards'>(() => (localStorage.getItem('gtt-emp-view') as 'table' | 'cards') || 'table');
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 }>({ k: 'name', dir: 1 });
  const [formOpen, setFormOpen] = useState(false);
  const nav = useNavigate();
  const dSearch = useDebounced(search);

  const { data: depts = [] } = useDepartments();
  const { data: all = [] } = useEmployees();
  const { data = [], isLoading, isFetching } = useEmployees({ search: dSearch, departmentId: dept, status });
  const deptMap = useMemo(() => new Map(depts.map((d) => [d.id, d])), [depts]);

  useEffect(() => {
    if (params.get('new')) { setFormOpen(true); params.delete('new'); setParams(params, { replace: true }); }
  }, [params, setParams]);
  useEffect(() => { try { localStorage.setItem('gtt-emp-view', view); } catch { /* */ } }, [view]);

  const list = useMemo(() => {
    const visible = status ? data : data.filter((e) => e.status !== 'işdən çıxıb');
    const get = (e: Employee) =>
      sort.k === 'name' ? fullName(e) : sort.k === 'hireDate' ? e.hireDate : sort.k === 'salary' ? e.salary : deptMap.get(e.departmentId)?.name ?? '';
    return [...visible].sort((a, b) => {
      const x = get(a), y = get(b);
      return (typeof x === 'number' ? x - (y as number) : String(x).localeCompare(String(y), 'az')) * sort.dir;
    });
  }, [data, sort, deptMap, status]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { '': all.filter((e) => e.status !== 'işdən çıxıb').length };
    all.forEach((e) => (c[e.status] = (c[e.status] ?? 0) + 1));
    return c;
  }, [all]);

  const th = (k: SortKey, label: string, cls = '') => (
    <th className={cx('sortable', cls)} onClick={() => setSort((s) => ({ k, dir: s.k === k ? (s.dir * -1 as 1 | -1) : 1 }))}>
      <span className="row" style={{ gap: 4, display: 'inline-flex' }}>{label} <ArrowUpDown size={12} opacity={sort.k === k ? 1 : .35} /></span>
    </th>
  );

  const exportCsv = () =>
    downloadCSV(`isciler-${new Date().toISOString().slice(0, 10)}.csv`, [
      ['Ad', 'Soyad', 'Ata adı', 'Vəzifə', 'Bölmə', 'Status', 'Müqavilə', 'İşə qəbul', 'Əmək haqqı', 'Telefon', 'E-poçt', 'FİN'],
      ...list.map((e) => [e.firstName, e.lastName, e.fatherName, e.position, deptMap.get(e.departmentId)?.name ?? '', e.status, e.employmentType, e.hireDate, e.salary, e.phone, e.email, e.fin]),
    ]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">İşçilər</h1>
          <div className="page-sub">Teatrın bütün əməkdaşları — {counts[''] ?? '…'} aktiv işçi</div>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={exportCsv}><Download size={16} /> Excel (CSV)</button>
          <button className="btn btn-primary" onClick={() => setFormOpen(true)}><Plus size={16} /> Yeni işçi</button>
        </div>
      </div>

      <div className="toolbar">
        <div className="input-icon grow">
          <Search size={16} />
          <input className="input" placeholder="Ad, vəzifə, FİN və ya e-poçt…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="select" style={{ width: 230 }} value={dept} onChange={(e) => setDept(e.target.value)}>
          <option value="">Bütün bölmələr</option>
          {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <div className="seg" style={{ marginLeft: 'auto' }}>
          <button className={view === 'table' ? 'on' : ''} onClick={() => setView('table')} aria-label="Cədvəl"><List size={15} /></button>
          <button className={view === 'cards' ? 'on' : ''} onClick={() => setView('cards')} aria-label="Kartlar"><LayoutGrid size={15} /></button>
        </div>
      </div>
      <div className="chips mb-16">
        {STATUSES.map((s) => (
          <button key={s} className={cx('chip', status === s && 'active')} onClick={() => setStatus(s)}>
            {s ? s[0].toLocaleUpperCase('az') + s.slice(1) : 'Hamısı'} <span className="count">{counts[s] ?? 0}</span>
          </button>
        ))}
        {isFetching && !isLoading && <span className="small muted" style={{ alignSelf: 'center' }}>yenilənir…</span>}
      </div>

      {isLoading ? <div className="card"><SkelRows /></div> : list.length === 0 ? (
        <div className="card"><Empty title="Heç bir işçi tapılmadı" text="Axtarış şərtlərini dəyişin və ya yeni işçi əlavə edin."
          action={<button className="btn btn-primary" onClick={() => setFormOpen(true)}><Plus size={16} /> Yeni işçi</button>} /></div>
      ) : view === 'table' ? (
        <div className="card table-wrap">
          <table className="table">
            <thead><tr>{th('name', 'İşçi')}{th('department', 'Bölmə')}<th>Status</th><th>Müqavilə</th>{th('hireDate', 'Staj')}{th('salary', 'Əmək haqqı', 'num')}<th>Əlaqə</th></tr></thead>
            <tbody>
              {list.map((e) => {
                const d = deptMap.get(e.departmentId);
                return (
                  <tr key={e.id} className="clickable" onClick={() => nav(`/employees/${e.id}`)}>
                    <td><Person e={e} sub={<>{e.position}{e.title && <> · <span style={{ color: 'var(--gold)' }}>{e.title}</span></>}</>} /></td>
                    <td><span className="row small"><i style={{ width: 8, height: 8, borderRadius: 2, background: d?.color, display: 'inline-block' }} />{d?.name}</span></td>
                    <td><EmpStatus s={e.status} /></td>
                    <td className="small">{e.employmentType}{e.contractEnd && <div className="muted">{fmtDate(e.contractEnd)}-dək</div>}</td>
                    <td className="small">{tenure(e.hireDate)}<div className="muted">{fmtDate(e.hireDate)}</div></td>
                    <td className="num">{money(e.salary)}</td>
                    <td className="small muted">{e.phone}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="emp-grid">
          {list.map((e) => {
            const d = deptMap.get(e.departmentId);
            return (
              <Link to={`/employees/${e.id}`} key={e.id} className="card emp-card" style={{ borderTop: `3px solid ${d?.color}` }}>
                <div className="row between" style={{ alignItems: 'flex-start' }}>
                  <Avatar e={e} />
                  <EmpStatus s={e.status} />
                </div>
                <div>
                  <div className="strong">{fullName(e)}</div>
                  <div className="small muted">{e.position} · {d?.name}</div>
                  {e.title && <div className="small row mt-8" style={{ color: 'var(--gold)', gap: 4 }}><Award size={13} /> {e.title}</div>}
                </div>
                <div className="contact">
                  <span><Phone size={13} /> {e.phone}</span>
                  <span><Mail size={13} /> {e.email}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <EmployeeForm open={formOpen} onClose={() => setFormOpen(false)} initial={dept ? { departmentId: dept } : undefined} onSaved={(e) => nav(`/employees/${e.id}`)} />
    </>
  );
}
