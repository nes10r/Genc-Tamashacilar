import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Building2, CalendarCheck, Umbrella, UserPlus, GraduationCap, Wallet, FileText, BarChart3,
  Settings, Search, Bell, Moon, Sun, Drama, Menu, Cake, FileWarning, UserRoundPlus, CheckCheck, Server, CornerDownLeft, Plus, PartyPopper, CalendarDays, X,
} from 'lucide-react';
import { useLeaves, useMarkNotificationsRead, useMe, useNotifications, useSearch } from '../api/hooks';
import { getApiConfig } from '../api/client';
import { Avatar, useDebounced } from './ui';
import UserMenu from './UserMenu';
import { cx, fullName, relTime } from '../lib/utils';

const NAV = [
  { group: 'Əsas', items: [{ to: '/', label: 'İdarə paneli', icon: LayoutDashboard }, { to: '/calendar', label: 'Təqvim', icon: CalendarDays }] },
  {
    group: 'Kadrlar', items: [
      { to: '/employees', label: 'İşçilər', icon: Users },
      { to: '/departments', label: 'Struktur', icon: Building2 },
      { to: '/attendance', label: 'Davamiyyət (tabel)', icon: CalendarCheck },
      { to: '/leaves', label: 'Məzuniyyətlər', icon: Umbrella, badge: 'leaves' },
      { to: '/holidays', label: 'Bayram təqvimi', icon: PartyPopper },
    ],
  },
  {
    group: 'İnkişaf', items: [
      { to: '/recruitment', label: 'İşə qəbul', icon: UserPlus },
      { to: '/training', label: 'Təlim və qiymətləndirmə', icon: GraduationCap },
    ],
  },
  {
    group: 'Sənəd və maliyyə', items: [
      { to: '/payroll', label: 'Əmək haqqı', icon: Wallet },
      { to: '/orders', label: 'Əmrlər və sənədlər', icon: FileText },
      { to: '/reports', label: 'Hesabatlar', icon: BarChart3 },
    ],
  },
];

export function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const t = localStorage.getItem('gtt-theme');
      if (t === 'light' || t === 'dark') return t;
    } catch { /* ignore */ }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('gtt-theme', theme); } catch { /* ignore */ }
  }, [theme]);
  return [theme, setTheme] as const;
}

export default function Layout() {
  const [theme, setTheme] = useTheme();
  const [cmdOpen, setCmdOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem('gtt-sidebar') === 'collapsed'; } catch { return false; } });
  const loc = useLocation();
  const isMobile = () => window.matchMedia('(max-width: 900px)').matches;
  const toggleMenu = () => {
    if (isMobile()) setMenu((o) => !o);
    else setCollapsed((c) => { const n = !c; try { localStorage.setItem('gtt-sidebar', n ? 'collapsed' : 'open'); } catch { /* */ } return n; });
  };
  const pending = useLeaves({ status: 'gözləyir' }).data?.length ?? 0;
  const [apiMode, setApiMode] = useState(getApiConfig().mode);

  useEffect(() => setMenu(false), [loc.pathname]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setCmdOpen((o) => !o); }
      if (e.key === '/' && !(e.target as HTMLElement).closest('input,textarea,select')) { e.preventDefault(); setCmdOpen(true); }
      if (e.key === 'Escape') setMenu(false);
    };
    const mq = window.matchMedia('(max-width: 900px)');
    const onMq = () => { if (!mq.matches) setMenu(false); };
    mq.addEventListener('change', onMq);
    const c = () => setApiMode(getApiConfig().mode);
    window.addEventListener('keydown', h);
    window.addEventListener('api-config', c);
    return () => { window.removeEventListener('keydown', h); window.removeEventListener('api-config', c); mq.removeEventListener('change', onMq); };
  }, []);

  return (
    <div className={cx('app', collapsed && 'collapsed')}>
      <aside id="sidebar" className={cx('sidebar', menu && 'open')} aria-label="Əsas menyu">
        <div className="brand">
          <div className="brand-mark"><Drama size={22} /></div>
          <button className="icon-btn sm sidebar-close" onClick={() => setMenu(false)} aria-label="Menyunu bağla"><X size={18} /></button>
          <div className="brand-text">
            <div className="brand-title">Gənc Tamaşaçılar<br />Teatrı</div>
            <div className="brand-sub">HR Portal</div>
          </div>
        </div>
        {NAV.map((g) => (
          <div key={g.group}>
            <div className="nav-group">{g.group}</div>
            {g.items.map((it) => (
              <NavLink key={it.to} to={it.to} end={it.to === '/'} title={collapsed ? it.label : undefined} className={({ isActive }) => cx('nav-link', isActive && 'active')}>
                <it.icon size={18} /> <span className="nav-label">{it.label}</span>
                {'badge' in it && pending > 0 && <span className="nav-badge">{pending}</span>}
              </NavLink>
            ))}
          </div>
        ))}
        <div style={{ marginTop: 8 }}>
          <NavLink to="/settings" title={collapsed ? 'Ayarlar və API' : undefined} className={({ isActive }) => cx('nav-link', isActive && 'active')}><Settings size={18} /> <span className="nav-label">Ayarlar və API</span></NavLink>
        </div>
        <div className="sidebar-foot">
          <div className="row"><Server size={13} /> {apiMode === 'mock' ? 'Demo API rejimi' : 'Canlı API'}</div>
          <div style={{ marginTop: 4 }}>v1.0 · {new Date().getFullYear()}</div>
        </div>
      </aside>
      {menu && <div className="sidebar-backdrop" onClick={() => setMenu(false)} aria-hidden="true" />}

      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={toggleMenu} aria-controls="sidebar" aria-expanded={menu || !collapsed} aria-label={collapsed ? 'Menyunu genişləndir' : 'Menyunu yığ'} title="Menyu"><Menu size={20} /></button>
          <button className="search-trigger" onClick={() => setCmdOpen(true)}>
            <Search size={16} /> İşçi, vakansiya və ya əmr axtarın…
            <span className="kbd">Ctrl K</span>
          </button>
          <div className="topbar-right">
            <span className={cx('badge', apiMode === 'mock' ? 'b-gold' : 'b-success')} title="API rejimi" style={{ marginRight: 4 }}>
              {apiMode === 'mock' ? 'Demo' : 'Canlı'}
            </span>
            <Notifications />
            <button className="icon-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Tema">
              {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <UserMenu theme={theme} onTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')} />
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
      {cmdOpen && <CommandPalette onClose={() => setCmdOpen(false)} />}
    </div>
  );
}

function Notifications() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data: all = [] } = useNotifications();
  const { data: me } = useMe();
  const KIND = { leave: 'leaveRequests', contract: 'contracts', birthday: 'birthdays', candidate: 'candidates' } as const;
  const data = all.filter((n) => !me || n.kind === 'system' || me.notify[KIND[n.kind as keyof typeof KIND]] !== false);
  const mark = useMarkNotificationsRead();
  const nav = useNavigate();
  const unread = data.filter((n) => !n.read);
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const icon = (k: string) =>
    k === 'birthday' ? <Cake size={18} color="var(--gold)" /> : k === 'contract' ? <FileWarning size={18} color="var(--danger)" /> :
      k === 'candidate' ? <UserRoundPlus size={18} color="var(--info)" /> : <Umbrella size={18} color="var(--accent)" />;
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="icon-btn" onClick={() => setOpen(!open)} aria-label="Bildirişlər">
        <Bell size={19} />
        {unread.length > 0 && <span className="dot">{unread.length}</span>}
      </button>
      {open && (
        <div className="dropdown">
          <div className="dd-head">
            <span className="strong">Bildirişlər</span>
            {unread.length > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={() => mark.mutate(unread.map((n) => n.id))}><CheckCheck size={14} /> Hamısını oxu</button>
            )}
          </div>
          <div className="dd-list">
            {data.length === 0 && <div className="empty small">Yeni bildiriş yoxdur</div>}
            {data.map((n) => (
              <div key={n.id} className={cx('dd-item', !n.read && 'unread')} onClick={() => { if (!n.read) mark.mutate([n.id]); setOpen(false); nav(n.link); }}>
                <div style={{ paddingTop: 2 }}>{icon(n.kind)}</div>
                <div style={{ minWidth: 0 }}>
                  <div className="strong small">{n.title}</div>
                  <div className="small muted">{n.text}</div>
                  <div className="small muted" style={{ fontSize: 11 }}>{relTime(n.date)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CommandPalette({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const dq = useDebounced(q, 180);
  const { data } = useSearch(dq);
  const nav = useNavigate();

  const items = useMemo(() => {
    const pages = [
      ...NAV.flatMap((g) => g.items),
      { to: '/settings', label: 'Ayarlar və API', icon: Settings },
    ].filter((p) => !q || p.label.toLowerCase().includes(q.toLowerCase()));
    const actions = [
      { to: '/employees?new=1', label: 'Yeni işçi əlavə et', icon: Plus },
      { to: '/leaves?new=1', label: 'Məzuniyyət sorğusu yarat', icon: Plus },
      { to: '/calendar?new=1', label: 'Məşq / tamaşa planlaşdır', icon: Plus },
      { to: '/orders?new=1', label: 'Yeni əmr hazırla', icon: Plus },
      { to: '/recruitment?new=1', label: 'Vakansiya elan et', icon: Plus },
    ].filter((p) => !q || p.label.toLowerCase().includes(q.toLowerCase()));
    const out: { group: string; key: string; label: string; meta?: string; to: string; node: ReactNode }[] = [];
    if (dq.length > 1 && data) {
      data.employees.forEach((e) => out.push({ group: 'İşçilər', key: e.id, label: fullName(e), meta: e.position, to: `/employees/${e.id}`, node: <Avatar e={e} size="sm" /> }));
      data.vacancies.forEach((v) => out.push({ group: 'Vakansiyalar', key: v.id, label: v.title, meta: v.status, to: '/recruitment', node: <UserPlus size={18} /> }));
      data.orders.forEach((o) => out.push({ group: 'Əmrlər', key: o.id, label: `${o.number} — ${o.type}`, to: `/orders?id=${o.id}`, node: <FileText size={18} /> }));
    }
    actions.forEach((a) => out.push({ group: 'Tez əməliyyatlar', key: a.to, label: a.label, to: a.to, node: <a.icon size={18} /> }));
    pages.forEach((p) => out.push({ group: 'Səhifələr', key: p.to, label: p.label, to: p.to, node: <p.icon size={18} /> }));
    return out;
  }, [q, dq, data]);

  useEffect(() => setSel(0), [items.length]);
  const go = (to: string) => { nav(to); onClose(); };

  return (
    <div className="overlay cmdk" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cmdk-box">
        <div className="cmdk-input">
          <Search size={18} color="var(--muted)" />
          <input autoFocus placeholder="Axtarın və ya əmr yazın…" value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
              if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(items.length - 1, s + 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
              if (e.key === 'Enter' && items[sel]) go(items[sel].to);
            }} />
          <span className="kbd">Esc</span>
        </div>
        <div className="cmdk-list">
          {items.length === 0 && <div className="empty small">Heç nə tapılmadı</div>}
          {items.map((it, i) => (
            <div key={it.group + it.key}>
              {(i === 0 || items[i - 1].group !== it.group) && <div className="cmdk-group">{it.group}</div>}
              <div className={cx('cmdk-item', i === sel && 'sel')} onMouseEnter={() => setSel(i)} onClick={() => go(it.to)}>
                {it.node}<span>{it.label}</span>{it.meta && <span className="meta">{it.meta}</span>}
              </div>
            </div>
          ))}
        </div>
        <div className="cmdk-foot"><span>↑↓ seçmək</span><span className="row" style={{ gap: 4 }}><CornerDownLeft size={12} /> açmaq</span><span>/ — tez axtarış</span></div>
      </div>
    </div>
  );
}
