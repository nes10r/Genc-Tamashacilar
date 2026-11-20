import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, FileText, UserX, Mail, Phone, MapPin, Award, CalendarPlus, Trash2, Star } from 'lucide-react';
import {
  useAttendance, useDeleteEmployee, useDepartments, useEmployee, useEvaluations, useLeaves, useOrders, useTerminateEmployee,
} from '../api/hooks';
import EmployeeForm from '../components/EmployeeForm';
import { Avatar, EmpStatus, Empty, Field, LeaveBadge, Modal, Skel, Stars, Tabs, useConfirm } from '../components/ui';
import { age, fmtDate, fullName, money, tenure, todayISO } from '../lib/utils';

export const ANNUAL_LEAVE = 30; // yaradıcı heyət üçün uzadılmış məzuniyyət (iş günü)

type Tab = 'info' | 'leaves' | 'attendance' | 'orders' | 'eval';

export default function EmployeeDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const confirm = useConfirm();
  const { data: e, isLoading, error } = useEmployee(id);
  const { data: depts = [] } = useDepartments();
  const { data: leaves = [] } = useLeaves({ employeeId: id });
  const { data: orders = [] } = useOrders({ employeeId: id });
  const { data: evals = [] } = useEvaluations(id);
  const month = todayISO().slice(0, 7);
  const { data: att = [] } = useAttendance({ month });
  const del = useDeleteEmployee();
  const term = useTerminateEmployee();
  const [tab, setTab] = useState<Tab>('info');
  const [edit, setEdit] = useState(false);
  const [termOpen, setTermOpen] = useState(false);
  const [termForm, setTermForm] = useState({ date: todayISO(), reason: 'Öz xahişi ilə (ƏM, maddə 69)' });

  const year = new Date().getFullYear().toString();
  const usedLeave = leaves.filter((l) => l.status === 'təsdiqləndi' && l.type === 'Əmək məzuniyyəti' && l.startDate.startsWith(year)).reduce((s, l) => s + l.days, 0);
  const myAtt = useMemo(() => att.filter((a) => a.employeeId === id), [att, id]);
  const attCount = (s: string) => myAtt.filter((a) => a.status === s).length;

  if (isLoading) return <div className="card card-pad"><Skel h={80} /><div className="mt-16"><Skel h={200} /></div></div>;
  if (error || !e) return <div className="card"><Empty title="İşçi tapılmadı" action={<Link className="btn" to="/employees">Siyahıya qayıt</Link>} /></div>;
  const dept = depts.find((d) => d.id === e.departmentId);
  const avgScore = evals.length ? evals.reduce((s, x) => s + x.score, 0) / evals.length : 0;

  return (
    <>
      <div className="row mb-16">
        <button className="btn btn-ghost btn-sm" onClick={() => nav(-1)}><ArrowLeft size={15} /> Geri</button>
      </div>

      <div className="card profile-hero mb-16" style={{ borderTop: `4px solid ${dept?.color}` }}>
        <Avatar e={e} size="lg" />
        <div style={{ flex: 1, minWidth: 220 }}>
          <div className="row wrap">
            <h1 className="page-title" style={{ fontSize: 26 }}>{fullName(e)}</h1>
            <EmpStatus s={e.status} />
          </div>
          <div className="muted">{e.fatherName}</div>
          <div className="row wrap mt-8" style={{ gap: 14 }}>
            <span className="strong">{e.position}</span>
            <Link to={`/employees?dept=${dept?.id}`} className="muted">{dept?.name}</Link>
            {e.title && <span className="row" style={{ color: 'var(--gold)', gap: 4 }}><Award size={15} /> {e.title}</span>}
          </div>
          <div className="row wrap mt-8 small muted" style={{ gap: 16 }}>
            <a href={`mailto:${e.email}`} className="row" style={{ gap: 5 }}><Mail size={14} /> {e.email}</a>
            <a href={`tel:${e.phone.replace(/\s/g, '')}`} className="row" style={{ gap: 5 }}><Phone size={14} /> {e.phone}</a>
            <span className="row" style={{ gap: 5 }}><MapPin size={14} /> {e.address}</span>
          </div>
        </div>
        <div className="row wrap" style={{ position: 'relative', zIndex: 1 }}>
          <button className="btn" onClick={() => setEdit(true)}><Pencil size={15} /> Redaktə</button>
          <Link className="btn" to={`/leaves?new=1&employee=${e.id}`}><CalendarPlus size={15} /> Məzuniyyət</Link>
          <Link className="btn" to={`/orders?new=1&employee=${e.id}`}><FileText size={15} /> Əmr</Link>
          {e.status !== 'işdən çıxıb' && <button className="btn btn-danger" onClick={() => setTermOpen(true)}><UserX size={15} /> İşdən azad et</button>}
        </div>
      </div>

      <div className="grid g-4 mb-16">
        <div className="card stat"><span className="stat-label">Staj</span><span className="stat-value" style={{ fontSize: 22 }}>{tenure(e.hireDate)}</span><span className="stat-foot">{fmtDate(e.hireDate)}-dən</span></div>
        <div className="card stat"><span className="stat-label">Məzuniyyət qalığı ({year})</span><span className="stat-value" style={{ fontSize: 22 }}>{Math.max(0, ANNUAL_LEAVE - usedLeave)} gün</span>
          <div className="bar"><i style={{ width: `${Math.min(100, (usedLeave / ANNUAL_LEAVE) * 100)}%` }} /></div></div>
        <div className="card stat"><span className="stat-label">Bu ay davamiyyət</span><span className="stat-value" style={{ fontSize: 22 }}>{attCount('gəldi') + attCount('gecikdi')} gün</span><span className="stat-foot">{attCount('gecikdi')} gecikmə · {attCount('gəlmədi')} buraxılış</span></div>
        <div className="card stat"><span className="stat-label">Orta qiymət</span><span className="stat-value" style={{ fontSize: 22 }}>{avgScore ? avgScore.toFixed(1) : '—'}</span>{avgScore > 0 && <Stars value={Math.round(avgScore)} />}</div>
      </div>

      <Tabs value={tab} onChange={setTab} items={[
        { id: 'info', label: 'Ümumi məlumat' },
        { id: 'leaves', label: `Məzuniyyətlər (${leaves.length})` },
        { id: 'attendance', label: 'Davamiyyət' },
        { id: 'orders', label: `Əmrlər (${orders.length})` },
        { id: 'eval', label: `Qiymətləndirmə (${evals.length})` },
      ]} />

      {tab === 'info' && (
        <div className="grid g-2">
          <div className="card card-pad">
            <div className="card-title mb-16">Şəxsi məlumatlar</div>
            <dl className="kv">
              <dt>FİN</dt><dd style={{ fontFamily: 'monospace' }}>{e.fin || '—'}</dd>
              <dt>Doğum tarixi</dt><dd>{fmtDate(e.birthDate)} ({age(e.birthDate)} yaş)</dd>
              <dt>Cins</dt><dd>{e.gender === 'K' ? 'Kişi' : 'Qadın'}</dd>
              <dt>Təhsil</dt><dd>{e.education || '—'}</dd>
              <dt>Təcili əlaqə</dt><dd>{e.emergencyContact || '—'}</dd>
            </dl>
          </div>
          <div className="card card-pad">
            <div className="card-title mb-16">Əmək müqaviləsi</div>
            <dl className="kv">
              <dt>Müqavilə növü</dt><dd>{e.employmentType}</dd>
              <dt>İşə qəbul</dt><dd>{fmtDate(e.hireDate)}</dd>
              {e.contractEnd && <><dt>Bitmə tarixi</dt><dd>{fmtDate(e.contractEnd)}</dd></>}
              {e.terminatedAt && <><dt>Azad olunub</dt><dd>{fmtDate(e.terminatedAt)}</dd></>}
              <dt>Əmək haqqı</dt><dd>{money(e.salary)}</dd>
              <dt>Bacarıqlar</dt><dd className="row wrap" style={{ gap: 6 }}>{e.skills.length ? e.skills.map((s) => <span key={s} className="tag">{s}</span>) : '—'}</dd>
            </dl>
          </div>
          {e.notes && <div className="card card-pad full" style={{ gridColumn: '1/-1' }}><div className="card-title">Qeydlər</div><p className="muted" style={{ marginBottom: 0 }}>{e.notes}</p></div>}
          <div style={{ gridColumn: '1/-1' }}>
            <button className="btn btn-ghost btn-sm btn-danger" onClick={async () => {
              if (await confirm({ title: 'İşçini sistemdən silmək?', text: `${fullName(e)} haqqında bütün məlumatlar silinəcək. Bu əməliyyat geri qaytarılmır. Adətən "İşdən azad et" seçimi tövsiyə olunur.`, confirm: 'Sil', danger: true }))
                del.mutate(e.id, { onSuccess: () => nav('/employees') });
            }}><Trash2 size={14} /> Sistemdən sil</button>
          </div>
        </div>
      )}

      {tab === 'leaves' && (
        <div className="card table-wrap">
          {leaves.length === 0 ? <Empty title="Məzuniyyət qeydi yoxdur" /> : (
            <table className="table">
              <thead><tr><th>Növ</th><th>Tarixlər</th><th className="num">Gün</th><th>Səbəb</th><th>Status</th></tr></thead>
              <tbody>{leaves.map((l) => (
                <tr key={l.id}><td>{l.type}</td><td>{fmtDate(l.startDate)} – {fmtDate(l.endDate)}</td><td className="num">{l.days}</td><td className="muted small">{l.reason}</td><td><LeaveBadge s={l.status} /></td></tr>
              ))}</tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'attendance' && (
        <div className="card table-wrap">
          {myAtt.length === 0 ? <Empty title="Bu ay üçün qeyd yoxdur" /> : (
            <table className="table">
              <thead><tr><th>Tarix</th><th>Status</th><th>Gəliş</th><th>Gediş</th></tr></thead>
              <tbody>{[...myAtt].reverse().map((a) => (
                <tr key={a.date}><td>{fmtDate(a.date)}</td><td><span className="badge">{a.status}</span></td><td>{a.checkIn ?? '—'}</td><td>{a.checkOut ?? '—'}</td></tr>
              ))}</tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'orders' && (
        <div className="card">
          {orders.length === 0 ? <Empty title="Əmr yoxdur" /> : orders.map((o) => (
            <Link to={`/orders?id=${o.id}`} key={o.id} className="list-item">
              <FileText size={18} color="var(--muted)" />
              <div><div className="strong">{o.number} — {o.type}</div><div className="small muted">{fmtDate(o.date)}</div></div>
              <span className={`badge ${o.status === 'imzalandı' ? 'b-success' : 'b-warning'}`} style={{ marginLeft: 'auto' }}>{o.status}</span>
            </Link>
          ))}
        </div>
      )}

      {tab === 'eval' && (
        <div className="grid g-2">
          {evals.length === 0 && <div className="card" style={{ gridColumn: '1/-1' }}><Empty icon={<Star size={40} />} title="Qiymətləndirmə aparılmayıb" action={<Link to="/training?tab=eval" className="btn">Qiymətləndir</Link>} /></div>}
          {evals.map((v) => (
            <div key={v.id} className="card card-pad">
              <div className="row between"><span className="strong">{v.period}</span><Stars value={v.score} /></div>
              <div className="small muted">{v.reviewer} · {fmtDate(v.createdAt)}</div>
              <div className="mt-8 small"><b>Güclü tərəflər:</b> {v.strengths}</div>
              <div className="small"><b>İnkişaf sahələri:</b> {v.improvements}</div>
            </div>
          ))}
        </div>
      )}

      <EmployeeForm open={edit} onClose={() => setEdit(false)} initial={e} />
      <Modal open={termOpen} onClose={() => setTermOpen(false)} title="İşdən azad etmə"
        footer={<>
          <button className="btn" onClick={() => setTermOpen(false)}>Ləğv et</button>
          <button className="btn btn-primary" disabled={term.isPending} onClick={() => term.mutate({ id: e.id, ...termForm }, { onSuccess: () => setTermOpen(false) })}>Təsdiqlə və əmr hazırla</button>
        </>}>
        <div className="banner warn mb-16">{fullName(e)} işdən azad ediləcək və "İşdən azad" əmri layihəsi avtomatik hazırlanacaq.</div>
        <div className="form-grid">
          <Field label="Azad olunma tarixi"><input type="date" className="input" value={termForm.date} onChange={(x) => setTermForm({ ...termForm, date: x.target.value })} /></Field>
          <Field label="Əsas">
            <select className="select" value={termForm.reason} onChange={(x) => setTermForm({ ...termForm, reason: x.target.value })}>
              <option>Öz xahişi ilə (ƏM, maddə 69)</option>
              <option>Müqavilə müddətinin bitməsi (ƏM, maddə 73)</option>
              <option>Tərəflərin razılığı ilə</option>
              <option>Ştatların ixtisarı (ƏM, maddə 70)</option>
              <option>Pensiyaya çıxma ilə əlaqədar</option>
            </select>
          </Field>
        </div>
      </Modal>
    </>
  );
}
