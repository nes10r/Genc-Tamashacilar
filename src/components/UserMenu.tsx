import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, UserCog, Settings, Moon, Sun, ShieldCheck, Bell, KeyRound, Keyboard } from 'lucide-react';
import { useChangePassword, useMe, useSaveMe } from '../api/hooks';
import { Avatar, Field, Modal, Tabs } from './ui';
import { cx } from '../lib/utils';
import type { UserProfile } from '../types';

const COLORS = ['#5b3a8c', '#8c1c2b', '#b8862f', '#2f7d6d', '#2b5c9e', '#b4572a', '#a3376f', '#4a5560'];

export default function UserMenu({ theme, onTheme }: { theme: 'light' | 'dark'; onTheme: () => void }) {
  const { data: me } = useMe();
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState<null | 'profile' | 'security' | 'notify'>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', h);
    document.addEventListener('keydown', k);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k); };
  }, []);

  const av = { id: 'me', firstName: me?.firstName ?? 'K', lastName: me?.lastName ?? 'Ş' };
  const openModal = (m: typeof modal) => { setOpen(false); setModal(m); };

  return (
    <div ref={ref} style={{ position: 'relative', marginLeft: 6 }}>
      <button className="user-btn" onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open}>
        <Avatar e={av} size="sm" color={me?.avatarColor} />
        <span className="user-btn-text small">
          <span className="strong">{me ? `${me.firstName} ${me.lastName}` : '…'}</span>
          <span className="muted">{me?.role ?? ''}</span>
        </span>
        <ChevronDown size={15} className="muted" style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform .15s' }} />
      </button>

      {open && me && (
        <div className="dropdown" role="menu" style={{ width: 290 }}>
          <div className="row" style={{ padding: 16, gap: 12, borderBottom: '1px solid var(--line)' }}>
            <Avatar e={av} color={me.avatarColor} />
            <div style={{ minWidth: 0 }}>
              <div className="strong">{me.firstName} {me.lastName}</div>
              <div className="small muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{me.email}</div>
              <span className="badge b-accent plain" style={{ marginTop: 4 }}>{me.role}</span>
            </div>
          </div>
          <div style={{ padding: 6 }}>
            <MenuItem icon={<UserCog size={16} />} onClick={() => openModal('profile')}>Profilim</MenuItem>
            <MenuItem icon={<KeyRound size={16} />} onClick={() => openModal('security')}>Şifrəni dəyiş</MenuItem>
            <MenuItem icon={<Bell size={16} />} onClick={() => openModal('notify')}>Bildiriş ayarları</MenuItem>
            <MenuItem icon={theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />} onClick={onTheme}>{theme === 'dark' ? 'Açıq tema' : 'Tünd tema'}</MenuItem>
            <Link to="/settings" className="menu-item" onClick={() => setOpen(false)}><Settings size={16} /> Ayarlar və API</Link>
            <div className="menu-item muted" style={{ cursor: 'default' }}><Keyboard size={16} /> Axtarış <span className="kbd">Ctrl K</span></div>
          </div>
        </div>
      )}

      {me && <ProfileModal open={!!modal} initialTab={modal ?? 'profile'} me={me} onClose={() => setModal(null)} />}
    </div>
  );
}

function MenuItem({ icon, children, onClick }: { icon: ReactNode; children: ReactNode; onClick: () => void }) {
  return <button role="menuitem" className="menu-item" onClick={onClick}>{icon} {children}</button>;
}

function ProfileModal({ open, onClose, me, initialTab }: { open: boolean; onClose: () => void; me: UserProfile; initialTab: 'profile' | 'security' | 'notify' }) {
  const save = useSaveMe();
  const pw = useChangePassword();
  const [tab, setTab] = useState(initialTab);
  const [f, setF] = useState<UserProfile>(me);
  const [pwf, setPwf] = useState({ current: '', next: '', repeat: '' });
  const [err, setErr] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) { setTab(initialTab); setF(me); setPwf({ current: '', next: '', repeat: '' }); setErr({}); }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = JSON.stringify(f) !== JSON.stringify(me);
  const submitProfile = () => {
    const e: Record<string, string> = {};
    if (!f.firstName.trim()) e.firstName = 'Ad tələb olunur';
    if (!f.lastName.trim()) e.lastName = 'Soyad tələb olunur';
    if (!/^\S+@\S+\.\S+$/.test(f.email)) e.email = 'E-poçt düzgün deyil';
    setErr(e);
    if (!Object.keys(e).length) save.mutate(f, { onSuccess: onClose });
  };
  const strength = (() => {
    const p = pwf.next; let s = 0;
    if (p.length >= 8) s++; if (/[A-ZƏÖÜĞŞÇİ]/.test(p) && /[a-zəöüğşçı]/.test(p)) s++; if (/\d/.test(p)) s++; if (/[^\w\sƏÖÜĞŞÇİəöüğşçı]/.test(p)) s++;
    return s;
  })();
  const submitPw = () => {
    const e: Record<string, string> = {};
    if (!pwf.current) e.current = 'Cari şifrəni daxil edin';
    if (pwf.next.length < 8) e.next = 'Ən azı 8 simvol';
    if (pwf.next !== pwf.repeat) e.repeat = 'Şifrələr eyni deyil';
    setErr(e);
    if (!Object.keys(e).length) pw.mutate({ current: pwf.current, next: pwf.next }, { onSuccess: onClose });
  };
  const setNotify = (k: keyof UserProfile['notify'], v: boolean) => setF({ ...f, notify: { ...f.notify, [k]: v } });

  const footer = tab === 'security'
    ? <><button className="btn" onClick={onClose}>Ləğv et</button><button className="btn btn-primary" disabled={pw.isPending} onClick={submitPw}>Şifrəni dəyiş</button></>
    : <><button className="btn" onClick={onClose}>Ləğv et</button><button className="btn btn-primary" disabled={!dirty || save.isPending} onClick={submitProfile}>{save.isPending ? 'Yadda saxlanılır…' : 'Yadda saxla'}</button></>;

  return (
    <Modal open={open} onClose={onClose} title="Profil" footer={footer}>
      <Tabs value={tab} onChange={(t) => { setTab(t); setErr({}); }} items={[
        { id: 'profile', label: <><UserCog size={15} /> Şəxsi məlumatlar</> },
        { id: 'security', label: <><ShieldCheck size={15} /> Təhlükəsizlik</> },
        { id: 'notify', label: <><Bell size={15} /> Bildirişlər</> },
      ]} />

      {tab === 'profile' && (
        <div className="form-grid">
          <div className="full row" style={{ gap: 16 }}>
            <Avatar e={{ id: 'me', firstName: f.firstName || '?', lastName: f.lastName || '?' }} size="lg" color={f.avatarColor} />
            <div>
              <div className="small strong" style={{ marginBottom: 6 }}>Avatar rəngi</div>
              <div className="row wrap" style={{ gap: 6 }}>
                {COLORS.map((c) => (
                  <button key={c} type="button" aria-label={c} onClick={() => setF({ ...f, avatarColor: c })}
                    className={cx('swatch', f.avatarColor === c && 'on')} style={{ background: c }} />
                ))}
              </div>
            </div>
          </div>
          <Field label="Ad *" error={err.firstName}><input className={cx('input', err.firstName && 'invalid')} value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} /></Field>
          <Field label="Soyad *" error={err.lastName}><input className={cx('input', err.lastName && 'invalid')} value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} /></Field>
          <Field label="Vəzifə"><input className="input" value={f.position} onChange={(e) => setF({ ...f, position: e.target.value })} /></Field>
          <Field label="Rol" hint="Rolu yalnız sistem administratoru dəyişə bilər"><input className="input" value={f.role} disabled /></Field>
          <Field label="E-poçt *" error={err.email}><input className={cx('input', err.email && 'invalid')} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          <Field label="Telefon"><input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        </div>
      )}

      {tab === 'security' && (
        <div className="form-grid">
          <Field label="Cari şifrə" error={err.current} full><input type="password" autoComplete="current-password" className={cx('input', err.current && 'invalid')} value={pwf.current} onChange={(e) => setPwf({ ...pwf, current: e.target.value })} /></Field>
          <Field label="Yeni şifrə" error={err.next}><input type="password" autoComplete="new-password" className={cx('input', err.next && 'invalid')} value={pwf.next} onChange={(e) => setPwf({ ...pwf, next: e.target.value })} /></Field>
          <Field label="Yeni şifrə (təkrar)" error={err.repeat}><input type="password" autoComplete="new-password" className={cx('input', err.repeat && 'invalid')} value={pwf.repeat} onChange={(e) => setPwf({ ...pwf, repeat: e.target.value })} /></Field>
          {pwf.next && (
            <div className="full">
              <div className="row" style={{ gap: 4 }}>{[0, 1, 2, 3].map((i) => <div key={i} style={{ flex: 1, height: 5, borderRadius: 3, background: i < strength ? ['#b42318', '#c68a1d', '#2b5c9e', '#2f7d4f'][strength - 1] : 'var(--line-2)' }} />)}</div>
              <div className="small muted mt-8">{['Çox zəif', 'Zəif', 'Orta', 'Yaxşı', 'Güclü'][strength]} — böyük/kiçik hərf, rəqəm və simvol istifadə edin</div>
            </div>
          )}
        </div>
      )}

      {tab === 'notify' && (
        <div className="grid" style={{ gap: 12 }}>
          {([
            ['leaveRequests', 'Yeni məzuniyyət sorğuları'],
            ['contracts', 'Müqavilə müddəti bitənlər'],
            ['birthdays', 'İşçilərin ad günləri'],
            ['candidates', 'Yeni namizəd müraciətləri'],
            ['email', 'Bildirişləri e-poçtla da göndər'],
          ] as const).map(([k, label]) => (
            <label key={k} className="check row between" style={{ padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8 }}>
              <span>{label}</span>
              <input type="checkbox" checked={f.notify[k]} onChange={(e) => setNotify(k, e.target.checked)} />
            </label>
          ))}
        </div>
      )}
    </Modal>
  );
}
