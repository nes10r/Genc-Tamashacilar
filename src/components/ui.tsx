import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, Info, Star, X, XCircle, Inbox, AlertTriangle } from 'lucide-react';
import { subscribe, dismiss, type ToastItem } from '../lib/toast';
import { cx, initials, norm, fullName } from '../lib/utils';
import type { Employee, EmployeeStatus, LeaveStatus } from '../types';

/* ---------- Modal ---------- */
export function Modal({ open, onClose, title, children, footer, wide }: {
  open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={cx('modal', wide && 'wide')} role="dialog" aria-modal="true">
        <div className="modal-head">
          <div className="modal-title">{title}</div>
          <button className="icon-btn sm" onClick={onClose} aria-label="Bağla"><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------- Confirm ---------- */
interface ConfirmOpts { title: string; text?: string; confirm?: string; danger?: boolean }
const ConfirmCtx = createContext<(o: ConfirmOpts) => Promise<boolean>>(async () => false);
export const useConfirm = () => useContext(ConfirmCtx);
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
  const confirm = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => setState({ ...o, resolve })), []);
  const close = (v: boolean) => { state?.resolve(v); setState(null); };
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Modal open={!!state} onClose={() => close(false)} title={state?.title}
        footer={<>
          <button className="btn" onClick={() => close(false)}>Ləğv et</button>
          <button className={cx('btn', state?.danger ? 'btn-primary' : 'btn-primary')} autoFocus onClick={() => close(true)}>{state?.confirm ?? 'Təsdiqlə'}</button>
        </>}>
        <div className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
          {state?.danger && <AlertTriangle size={22} color="var(--danger)" style={{ flexShrink: 0 }} />}
          <p style={{ margin: 0, color: 'var(--ink-2)' }}>{state?.text}</p>
        </div>
      </Modal>
    </ConfirmCtx.Provider>
  );
}

/* ---------- Toaster ---------- */
export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => subscribe(setItems), []);
  return (
    <div className="toasts" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={cx('toast', t.kind)}>
          {t.kind === 'success' ? <CheckCircle2 size={18} /> : t.kind === 'error' ? <XCircle size={18} /> : <Info size={18} />}
          <span>{t.text}</span>
          {t.action && <button style={{ fontWeight: 700, opacity: 1 }} onClick={() => { t.action!.onClick(); dismiss(t.id); }}>{t.action.label}</button>}
          <button onClick={() => dismiss(t.id)} aria-label="Bağla"><X size={15} /></button>
        </div>
      ))}
    </div>
  );
}

/* ---------- Avatar ---------- */
const AV_COLORS = ['#8c1c2b', '#b8862f', '#5b3a8c', '#2f7d6d', '#2b5c9e', '#b4572a', '#6b7a2a', '#a3376f', '#4a5560'];
export function Avatar({ e, size }: { e?: Pick<Employee, 'firstName' | 'lastName' | 'id'>; size?: 'lg' | 'sm' | 'xs' }) {
  const idx = e ? [...e.id].reduce((s, c) => s + c.charCodeAt(0), 0) % AV_COLORS.length : 0;
  return <span className={cx('avatar', size)} style={{ background: AV_COLORS[idx] }} title={fullName(e)}>{initials(e)}</span>;
}
export function Person({ e, sub }: { e?: Employee; sub?: ReactNode }) {
  return (
    <div className="person">
      <Avatar e={e} />
      <div style={{ minWidth: 0 }}>
        <div className="person-name">{fullName(e)}</div>
        <div className="person-sub">{sub ?? e?.position}</div>
      </div>
    </div>
  );
}

/* ---------- Badges ---------- */
const EMP_STATUS: Record<EmployeeStatus, string> = { aktiv: 'b-success', məzuniyyətdə: 'b-info', xəstəlik: 'b-warning', 'işdən çıxıb': '' };
export const EmpStatus = ({ s }: { s: EmployeeStatus }) => <span className={cx('badge', EMP_STATUS[s])}>{s[0].toLocaleUpperCase('az') + s.slice(1)}</span>;
const LEAVE_STATUS: Record<LeaveStatus, string> = { gözləyir: 'b-warning', təsdiqləndi: 'b-success', 'rədd edildi': 'b-danger' };
export const LeaveBadge = ({ s }: { s: LeaveStatus }) => <span className={cx('badge', LEAVE_STATUS[s])}>{s[0].toLocaleUpperCase('az') + s.slice(1)}</span>;
export const Badge = ({ tone, children, plain }: { tone?: string; children: ReactNode; plain?: boolean }) =>
  <span className={cx('badge', tone && `b-${tone}`, plain && 'plain')}>{children}</span>;

/* ---------- Field ---------- */
export function Field({ label, hint, error, children, full }: { label: string; hint?: string; error?: string; children: ReactNode; full?: boolean }) {
  return (
    <div className={cx('field', full && 'full')}>
      <label>{label}</label>
      {children}
      {error ? <span className="err">{error}</span> : hint && <span className="hint">{hint}</span>}
    </div>
  );
}

/* ---------- Empty / Skeleton ---------- */
export function Empty({ title, text, icon, action }: { title: string; text?: string; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      {icon ?? <Inbox size={40} />}
      <div className="empty-title">{title}</div>
      {text && <div className="small">{text}</div>}
      {action && <div className="mt-16">{action}</div>}
    </div>
  );
}
export const Skel = ({ h = 16, w = '100%', r }: { h?: number; w?: number | string; r?: number }) =>
  <div className="skel" style={{ height: h, width: w, borderRadius: r }} />;
export function SkelRows({ n = 6 }: { n?: number }) {
  return <div style={{ padding: 16, display: 'grid', gap: 12 }}>{Array.from({ length: n }, (_, i) => <Skel key={i} h={36} />)}</div>;
}

/* ---------- Stars ---------- */
export function Stars({ value, onChange, size = 15 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  return (
    <span className="stars" aria-label={`${value} / 5`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const icon = <Star size={size} fill={i <= value ? 'currentColor' : 'none'} strokeWidth={1.6} style={{ opacity: i <= value ? 1 : .4 }} />;
        return onChange ? <button key={i} type="button" onClick={(e) => { e.stopPropagation(); onChange(i); }}>{icon}</button> : <span key={i}>{icon}</span>;
      })}
    </span>
  );
}

/* ---------- Tabs ---------- */
export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { id: T; label: ReactNode }[] }) {
  return (
    <div className="tabs" role="tablist">
      {items.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} className={cx('tab', value === t.id && 'active')} onClick={() => onChange(t.id)}>{t.label}</button>
      ))}
    </div>
  );
}

/* ---------- Employee picker (searchable) ---------- */
export function EmployeePicker({ employees, value, onChange, placeholder = 'İşçi seçin…', invalid }: {
  employees: Employee[]; value?: string; onChange: (id: string) => void; placeholder?: string; invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const sel = employees.find((e) => e.id === value);
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const list = employees.filter((e) => norm(`${e.firstName} ${e.lastName} ${e.position}`).includes(norm(q))).slice(0, 50);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" className={cx('input', invalid && 'invalid')} style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => setOpen(!open)}>
        {sel ? <><Avatar e={sel} size="xs" /> {fullName(sel)} <span className="muted small">· {sel.position}</span></> : <span className="muted">{placeholder}</span>}
      </button>
      {open && (
        <div className="dropdown" style={{ left: 0, right: 'auto', width: '100%', top: 'calc(100% + 4px)' }}>
          <div style={{ padding: 8 }}><input autoFocus className="input" placeholder="Axtar…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div className="dd-list" style={{ maxHeight: 260 }}>
            {list.map((e) => (
              <div key={e.id} className="dd-item" style={{ padding: '8px 12px', alignItems: 'center' }} onClick={() => { onChange(e.id); setOpen(false); setQ(''); }}>
                <Avatar e={e} size="sm" />
                <div><div className="strong small">{fullName(e)}</div><div className="small muted">{e.position}</div></div>
              </div>
            ))}
            {!list.length && <div className="empty small">Tapılmadı</div>}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Charts ---------- */
export function HBars({ data, max }: { data: { label: string; value: number; color?: string; hint?: string }[]; max?: number }) {
  const m = max ?? Math.max(1, ...data.map((d) => d.value));
  return (
    <div>
      {data.map((d) => (
        <div className="hbar-row" key={d.label} title={d.hint ?? `${d.label}: ${d.value}`}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label}</span>
          <div className="track"><div className="fill" style={{ width: `${(d.value / m) * 100}%`, background: d.color ?? 'var(--accent)' }} /></div>
          <span className="num strong">{d.value}</span>
        </div>
      ))}
    </div>
  );
}

export function Donut({ data, size = 150, label }: { data: { label: string; value: number; color: string }[]; size?: number; label?: string }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = size / 2 - 12;
  const c = 2 * Math.PI * r;
  let off = 0;
  return (
    <div className="row" style={{ gap: 20, flexWrap: 'wrap' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line-2)" strokeWidth="18" />
        {data.map((d) => {
          const len = (d.value / total) * c;
          const el = (
            <circle key={d.label} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={d.color} strokeWidth="18"
              strokeDasharray={`${Math.max(0, len - 2)} ${c}`} strokeDashoffset={-off} transform={`rotate(-90 ${size / 2} ${size / 2})`}>
              <title>{`${d.label}: ${d.value}`}</title>
            </circle>
          );
          off += len;
          return el;
        })}
        <text x="50%" y="48%" textAnchor="middle" fontSize="24" fontWeight="700" fill="var(--ink)">{total}</text>
        <text x="50%" y="62%" textAnchor="middle" fontSize="11" fill="var(--muted)">{label ?? 'cəmi'}</text>
      </svg>
      <div style={{ display: 'grid', gap: 8 }}>
        {data.map((d) => (
          <div key={d.label} className="row small">
            <i style={{ width: 10, height: 10, borderRadius: 3, background: d.color, display: 'inline-block' }} />
            <span>{d.label}</span>
            <span className="strong" style={{ marginLeft: 6 }}>{d.value}</span>
            <span className="muted">({Math.round((d.value / total) * 100)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function VBars({ data, height = 160, color = 'var(--accent)' }: { data: { label: string; value: number }[]; height?: number; color?: string }) {
  const m = Math.max(1, ...data.map((d) => d.value));
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: height + 40 }}>
      {data.map((d) => (
        <div key={d.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 0 }} title={`${d.label}: ${d.value}`}>
          <span className="small strong">{d.value}</span>
          <div style={{ width: '100%', maxWidth: 42, height: Math.max(3, (d.value / m) * height), background: color, borderRadius: '6px 6px 2px 2px', transition: 'height .5s' }} />
          <span className="small muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export function useDebounced<T>(v: T, ms = 250): T {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
}
