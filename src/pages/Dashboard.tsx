import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useHolidays } from '../api/holidays';
import { upcomingHolidays } from '../lib/holidays';
import {
  Users, UserCheck, Umbrella, Briefcase, Cake, FileWarning, Check, X, ArrowUpRight, UserPlus, FileText, Drama, Activity as ActivityIcon,
  CalendarPlus, Megaphone, PartyPopper,
} from 'lucide-react';
import { useDashboard, useEmployees, useSetLeaveStatus } from '../api/hooks';
import { Avatar, Donut, Empty, HBars, Person, Skel } from '../components/ui';
import { fmtDate, fullName, relTime, WEEKDAYS, MONTHS, todayISO, diffDays, parseISO } from '../lib/utils';

export default function Dashboard() {
  const { data, isLoading } = useDashboard();
  const { data: emps = [] } = useEmployees();
  const setStatus = useSetLeaveStatus();
  const nav = useNavigate();
  const byId = new Map(emps.map((e) => [e.id, e]));
  const now = new Date();
  const h = now.getHours();
  const greet = h < 12 ? 'Sabahınız xeyir' : h < 18 ? 'Günortanız xeyir' : 'Axşamınız xeyir';

  const hol = useHolidays(now.getFullYear());
  useHolidays(now.getFullYear() + 1);
  const today = todayISO();
  const upcoming = hol.data ? upcomingHolidays(today, 5) : [];
  const todayHoliday = upcoming.find((x) => x.date === today);
  const s = data?.stats;
  const presentPct = s && s.workingToday ? Math.round((s.presentToday / s.workingToday) * 100) : 0;

  return (
    <>
      <div className="card hero-greet mb-16">
        <Drama size={120} className="curtain" />
        <div className="muted small">{WEEKDAYS[now.getDay()]}, {now.getDate()} {MONTHS[now.getMonth()].toLowerCase()} {now.getFullYear()}</div>
        <h2 style={{ margin: '4px 0 6px' }}>{greet}! 🎭</h2>
        <div className="muted">
          {s ? <>Bu gün <b style={{ color: '#fff' }}>{s.pendingLeaves}</b> sorğu təsdiqinizi gözləyir, <b style={{ color: '#fff' }}>{data!.birthdays.filter((b) => b.inDays === 0).length}</b> ad günü və <b style={{ color: '#fff' }}>{data!.expiringContracts.filter((c) => c.inDays <= 30).length}</b> bitən müqavilə var.</> : 'Məlumatlar yüklənir…'}
        </div>
        <div className="row wrap mt-16" style={{ position: 'relative', zIndex: 1 }}>
          <Link to="/employees?new=1" className="btn btn-sm"><UserPlus size={15} /> Yeni işçi</Link>
          <Link to="/leaves?new=1" className="btn btn-sm"><CalendarPlus size={15} /> Məzuniyyət sorğusu</Link>
          <Link to="/orders?new=1" className="btn btn-sm"><FileText size={15} /> Əmr hazırla</Link>
          <Link to="/recruitment?new=1" className="btn btn-sm"><Megaphone size={15} /> Vakansiya</Link>
        </div>
      </div>

      <div className="grid g-4 mb-16">
        <Stat to="/employees" label="Ümumi heyət" icon={<Users size={18} />} tone="accent" value={s?.headcount} foot={s && `+${s.newHires90} son 90 gündə`} />
        <Stat to="/attendance" label="Bu gün işdə" icon={<UserCheck size={18} />} tone="success" value={s && `${s.presentToday}/${s.workingToday}`} foot={s && (s.workingToday ? `Davamiyyət ${presentPct}%` : 'Bu gün istirahət günüdür')} />
        <Stat to="/leaves" label="Məzuniyyətdə / xəstə" icon={<Umbrella size={18} />} tone="info" value={s?.onLeave} foot={s && `${s.pendingLeaves} sorğu gözləyir`} />
        <Stat to="/recruitment" label="Açıq vakansiya" icon={<Briefcase size={18} />} tone="gold" value={s?.openVacancies} foot={s && `${s.candidates} aktiv namizəd`} />
      </div>

      <div className="grid g-main">
        <div className="grid" style={{ alignContent: 'start' }}>
          <div className="card">
            <div className="card-head">
              <div><div className="card-title">Təsdiq gözləyən məzuniyyətlər</div><div className="card-sub">Birbaşa buradan qərar verin</div></div>
              <Link to="/leaves" className="btn btn-ghost btn-sm">Hamısı <ArrowUpRight size={14} /></Link>
            </div>
            <div className="mt-8">
              {isLoading && <div style={{ padding: 20 }}><Skel h={40} /></div>}
              {data?.pendingLeaves.length === 0 && <Empty title="Gözləyən sorğu yoxdur" text="Bütün sorğulara baxılıb 👏" />}
              {data?.pendingLeaves.map((l) => (
                <div key={l.id} className="list-item">
                  <Person e={byId.get(l.employeeId)} sub={`${l.type} · ${fmtDate(l.startDate, false)} – ${fmtDate(l.endDate, false)} · ${l.days} iş günü`} />
                  <div className="row" style={{ marginLeft: 'auto' }}>
                    <button className="btn btn-sm btn-success" disabled={setStatus.isPending} onClick={() => setStatus.mutate({ id: l.id, status: 'təsdiqləndi' })}><Check size={14} /> Təsdiqlə</button>
                    <button className="btn btn-sm btn-danger" disabled={setStatus.isPending} onClick={() => setStatus.mutate({ id: l.id, status: 'rədd edildi' })} aria-label="Rədd et"><X size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid g-2">
            <div className="card">
              <div className="card-head"><div className="card-title">Bölmələr üzrə heyət</div></div>
              <div className="card-pad">
                {data ? <HBars data={data.byDepartment.map((d) => ({ label: d.name, value: d.count, color: d.color }))} /> : <Skel h={200} />}
              </div>
            </div>
            <div className="card">
              <div className="card-head"><div className="card-title">Əmək müqaviləsinin növü</div></div>
              <div className="card-pad">
                {data ? <Donut label="işçi" data={data.byType.map((t, i) => ({ label: t.label, value: t.count, color: ['#8c1c2b', '#b8862f', '#2b5c9e'][i] }))} /> : <Skel h={150} />}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head"><div className="card-title row"><ActivityIcon size={16} /> Son fəaliyyətlər</div></div>
            <div className="mt-8">
              {data?.activity.map((a) => (
                <div key={a.id} className="list-item">
                  <span className="badge plain" style={{ minWidth: 76, justifyContent: 'center' }}>{relTime(a.date)}</span>
                  <span>{a.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid" style={{ alignContent: 'start' }}>
          <div className="card">
            <div className="card-head"><div className="card-title row"><Cake size={16} color="var(--gold)" /> Yaxınlaşan ad günləri</div></div>
            <div className="mt-8">
              {data?.birthdays.length === 0 && <Empty title="Yaxın 30 gündə ad günü yoxdur" />}
              {data?.birthdays.slice(0, 6).map((b) => (
                <Link to={`/employees/${b.employee.id}`} key={b.employee.id} className="list-item">
                  <Avatar e={b.employee} size="sm" />
                  <div style={{ minWidth: 0 }}><div className="strong small">{fullName(b.employee)}</div><div className="small muted">{fmtDate(b.date, false)}</div></div>
                  <span className={`badge ${b.inDays === 0 ? 'b-gold' : 'plain'}`} style={{ marginLeft: 'auto' }}>{b.inDays === 0 ? 'Bu gün 🎉' : b.inDays === 1 ? 'Sabah' : `${b.inDays} gün`}</span>
                </Link>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-head"><div className="card-title row"><FileWarning size={16} color="var(--danger)" /> Müqavilə müddəti bitənlər</div></div>
            <div className="mt-8">
              {data?.expiringContracts.length === 0 && <Empty title="60 gün ərzində bitən müqavilə yoxdur" />}
              {data?.expiringContracts.map((c) => (
                <div key={c.employee.id} className="list-item" style={{ cursor: 'pointer' }} onClick={() => nav(`/employees/${c.employee.id}`)}>
                  <Avatar e={c.employee} size="sm" />
                  <div style={{ minWidth: 0 }}><div className="strong small">{fullName(c.employee)}</div><div className="small muted">{c.employee.position} · {fmtDate(c.employee.contractEnd)}</div></div>
                  <span className={`badge ${c.inDays < 0 ? 'b-danger' : c.inDays <= 14 ? 'b-warning' : 'b-info'}`} style={{ marginLeft: 'auto' }}>
                    {c.inDays < 0 ? 'Bitib' : `${c.inDays} gün`}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <div className="card-title row"><PartyPopper size={16} color="var(--accent)" /> Yaxınlaşan bayramlar</div>
              <Link to="/holidays" className="btn btn-ghost btn-sm">Təqvim <ArrowUpRight size={14} /></Link>
            </div>
            <div className="mt-8">
              {hol.isLoading && <div style={{ padding: 20 }}><Skel h={40} /></div>}
              {upcoming.map((h) => {
                const d = diffDays(today, h.date);
                return (
                  <div key={h.date + h.name} className="list-item">
                    <div style={{ width: 40, textAlign: 'center', lineHeight: 1.1 }}>
                      <div className="strong" style={{ fontSize: 18, color: 'var(--accent)' }}>{parseISO(h.date).getDate()}</div>
                      <div className="small muted" style={{ fontSize: 11 }}>{MONTHS[parseISO(h.date).getMonth()].slice(0, 3)}</div>
                    </div>
                    <div style={{ minWidth: 0 }}><div className="strong small">{h.name}</div><div className="small muted">{WEEKDAYS[parseISO(h.date).getDay()]}{h.approximate ? ' · təxmini' : ''}</div></div>
                    <span className={`badge ${d === 0 ? 'b-accent' : 'plain'}`} style={{ marginLeft: 'auto' }}>{d === 0 ? 'Bu gün' : d === 1 ? 'Sabah' : `${d} gün`}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card card-pad">
            <div className="card-title">Bu gün teatrda</div>
            <div className="small muted mt-8">
              {todayHoliday ? `Bu gün rəsmi bayramdır — ${todayHoliday.name}. Tabeldə "bayram" kimi qeyd olunur.` : now.getDay() === 1
                ? 'Bazar ertəsi — teatrın istirahət günüdür. Davamiyyət qeydə alınmır.'
                : 'Məşq və tamaşa günü. Davamiyyəti vaxtında qeyd etməyi unutmayın.'}
            </div>
            <Link to="/attendance" className="btn btn-sm mt-16"><UserCheck size={14} /> Tabeli aç</Link>
          </div>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value, foot, icon, tone, to }: { label: string; value?: number | string; foot?: string | false; icon: ReactNode; tone: string; to: string }) {
  return (
    <Link to={to} className="card stat">
      <span className="stat-icon" style={{ background: `var(--${tone}-soft)`, color: `var(--${tone})` }}>{icon}</span>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value ?? <Skel h={30} w={70} />}</span>
      <span className="stat-foot">{foot || ' '}</span>
    </Link>
  );
}
