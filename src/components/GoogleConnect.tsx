import { useEffect, useState } from 'react';
import { CalendarPlus, CheckCircle2, ExternalLink, LogIn, LogOut, ChevronDown, Info } from 'lucide-react';
import { connectGoogle, disconnectGoogle, gcalStatus, getGCalConfig, onGCalChange, setGCalConfig } from '../api/google/gis';
import { createCalendar, getUsage, verifyCalendar } from '../api/google/calendar';
import { Field, Modal } from './ui';
import { toast } from '../lib/toast';
import { cx } from '../lib/utils';

export function useGCalStatus() {
  const [s, setS] = useState(gcalStatus());
  useEffect(() => onGCalChange(() => setS(gcalStatus())), []);
  return s;
}

export function GoogleSetupGuide() {
  const [open, setOpen] = useState(false);
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
  return (
    <div className="guide">
      <button type="button" className="row small strong" style={{ background: 'none', border: 0, cursor: 'pointer', padding: 0, color: 'var(--info)' }} onClick={() => setOpen(!open)}>
        <Info size={15} /> Pulsuz Client ID necə alınır? <ChevronDown size={14} style={{ transform: open ? 'rotate(180deg)' : undefined }} />
      </button>
      {open && (
        <ol className="small" style={{ margin: '10px 0 0', paddingLeft: 20, lineHeight: 1.7 }}>
          <li><a href="https://console.cloud.google.com/projectcreate" target="_blank" rel="noreferrer">Google Cloud Console</a>-da yeni layihə yaradın (ödəniş kartı tələb olunmur).</li>
          <li><a href="https://console.cloud.google.com/apis/library/calendar-json.googleapis.com" target="_blank" rel="noreferrer">Google Calendar API</a>-nı aktiv edin (<b>Enable</b>).</li>
          <li><b>OAuth consent screen</b>: “External”, status “Testing”; teatr əməkdaşlarının Google hesablarını <b>Test users</b> siyahısına əlavə edin.</li>
          <li><b>Credentials → Create credentials → OAuth client ID → Web application</b>.</li>
          <li><b>Authorized JavaScript origins</b>: <code>{origin}</code> (və istehsal domeniniz).</li>
          <li>Yaranan <b>Client ID</b>-ni (…apps.googleusercontent.com) aşağıya yapışdırın. API açarı və client secret lazım deyil.</li>
        </ol>
      )}
    </div>
  );
}

export function GoogleConnectModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const status = useGCalStatus();
  const [clientId, setClientId] = useState(getGCalConfig().clientId);
  const [busy, setBusy] = useState(false);
  const [choice, setChoice] = useState<'new' | 'existing'>('new');
  const [calId, setCalId] = useState('');
  const [err, setErr] = useState('');
  const cfg = getGCalConfig();
  const step = !cfg.clientId ? 1 : status === 'connected' && cfg.calendarId ? 3 : status === 'connected' ? 2 : 1.5;

  useEffect(() => { if (open) { setClientId(getGCalConfig().clientId); setErr(''); } }, [open]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setErr('');
    try { await fn(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  const signIn = () => run(async () => {
    if (!/\.apps\.googleusercontent\.com$/.test(clientId.trim())) throw new Error('Client ID “…apps.googleusercontent.com” ilə bitməlidir');
    setGCalConfig({ clientId: clientId.trim() });
    await connectGoogle();
  });

  const pickCalendar = () => run(async () => {
    if (choice === 'new') {
      const c = await createCalendar('GTT — Teatr təqvimi');
      setGCalConfig({ calendarId: c.id, calendarName: c.summary });
      toast.success('Google-da “GTT — Teatr təqvimi” yaradıldı');
    } else {
      const id = calId.trim() || 'primary';
      await verifyCalendar(id);
      setGCalConfig({ calendarId: id, calendarName: id === 'primary' ? 'Əsas təqvim' : id });
      toast.success('Təqvim qoşuldu');
    }
  });

  return (
    <Modal open={open} onClose={onClose} title="Google Calendar ilə əlaqə"
      footer={step === 3 ? <button className="btn btn-primary" onClick={onClose}>Hazırdır</button> : <button className="btn" onClick={onClose}>Bağla</button>}>
      <div className="steps mb-16">
        {['Client ID', 'Google girişi', 'Təqvim'].map((l, i) => (
          <div key={l} className={cx('step', step > i + 1 && 'done', Math.ceil(step) === i + 1 && 'cur')}><span>{step > i + 1 ? '✓' : i + 1}</span>{l}</div>
        ))}
      </div>

      {step < 2 && (
        <div className="grid" style={{ gap: 12 }}>
          <Field label="OAuth Client ID" hint="Yalnız bu brauzerdə saxlanılır">
            <input className="input" value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="1234567890-abc….apps.googleusercontent.com" />
          </Field>
          <GoogleSetupGuide />
          <button className="btn btn-primary" disabled={busy || !clientId} onClick={signIn}><LogIn size={16} /> {busy ? 'Gözləyin…' : 'Google ilə daxil ol'}</button>
          {status === 'expired' && <div className="small muted">Sessiya bitib (Google tokenləri 1 saat etibarlıdır) — yenidən daxil olun.</div>}
        </div>
      )}

      {step === 2 && (
        <div className="grid" style={{ gap: 12 }}>
          <div className="banner ok"><CheckCircle2 size={18} /> Google hesabına qoşuldunuz. İndi teatr hadisələrinin saxlanacağı təqvimi seçin.</div>
          <label className={cx('choice', choice === 'new' && 'on')}>
            <input type="radio" checked={choice === 'new'} onChange={() => setChoice('new')} />
            <div><div className="strong">Yeni “GTT — Teatr təqvimi” yarat (tövsiyə olunur)</div><div className="small muted">Ayrıca təqvim — şəxsi hadisələrinizə toxunulmur, əməkdaşlarla paylaşmaq asandır.</div></div>
          </label>
          <label className={cx('choice', choice === 'existing' && 'on')}>
            <input type="radio" checked={choice === 'existing'} onChange={() => setChoice('existing')} />
            <div style={{ flex: 1 }}>
              <div className="strong">Mövcud təqvimdən istifadə et</div>
              <div className="small muted">Təqvim ID-si (Google Calendar → Ayarlar → “Təqvimi inteqrasiya et”). Boş qalsa — əsas təqvim.</div>
              {choice === 'existing' && <input className="input mt-8" value={calId} onChange={(e) => setCalId(e.target.value)} placeholder="xxxx@group.calendar.google.com" />}
            </div>
          </label>
          <button className="btn btn-primary" disabled={busy} onClick={pickCalendar}><CalendarPlus size={16} /> {busy ? 'Gözləyin…' : 'Təqvimi qoş'}</button>
        </div>
      )}

      {step === 3 && (
        <div className="banner ok"><CheckCircle2 size={18} /><div>Təqvim qoşuldu: <b>{cfg.calendarName}</b>. Hadisələr artıq Google Calendar-da saxlanılır və telefonunuzda da görünəcək.</div></div>
      )}
      {err && <div className="banner err mt-16">{err}</div>}
    </Modal>
  );
}

/** Ayarlar səhifəsi üçün kart */
export function GoogleCalendarSettings() {
  const status = useGCalStatus();
  const [open, setOpen] = useState(false);
  const cfg = getGCalConfig();
  const usage = getUsage();
  return (
    <div className="card card-pad">
      <div className="card-title row mb-16"><CalendarPlus size={17} /> Google Calendar</div>
      <p className="small muted" style={{ marginTop: 0 }}>
        Tamaşa, məşq, iş növbələri və təsdiqlənmiş məzuniyyətlər Google Calendar API (v3) ilə sinxronlaşdırılır.
        API pulsuzdur və standart kvota ilə işləyir; portal sorğuları keşləyir və limitə çatanda avtomatik gözləyib təkrarlayır.
      </p>
      <div className="row wrap" style={{ gap: 8 }}>
        <span className={cx('badge', status === 'connected' && cfg.calendarId ? 'b-success' : status === 'expired' ? 'b-warning' : '')}>
          {status === 'not-configured' ? 'Qurulmayıb' : status === 'expired' ? 'Sessiya bitib' : cfg.calendarId ? `Qoşulub: ${cfg.calendarName}` : 'Təqvim seçilməyib'}
        </span>
        {cfg.calendarId && <span className="small muted">Bu gün {usage.count} API sorğusu</span>}
      </div>
      <div className="row wrap mt-16">
        <button className="btn btn-primary" onClick={() => setOpen(true)}><LogIn size={15} /> {cfg.calendarId ? (status === 'expired' ? 'Yenidən qoşul' : 'Bağlantını idarə et') : 'Qoş'}</button>
        {cfg.calendarId && <a className="btn" href="https://calendar.google.com/calendar/r" target="_blank" rel="noreferrer"><ExternalLink size={15} /> Google Calendar</a>}
        {(cfg.consented || cfg.calendarId) && <button className="btn btn-danger" onClick={() => { disconnectGoogle(); toast.info('Google Calendar bağlantısı kəsildi'); }}><LogOut size={15} /> Ayır</button>}
      </div>
      <p className="small muted mt-16" style={{ marginBottom: 0 }}>
        Kvota limitlərini Google Cloud Console → APIs &amp; Services → Google Calendar API → <b>Quotas</b> bölməsində görə bilərsiniz.
      </p>
      <GoogleConnectModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
