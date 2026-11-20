import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, Plus, Download, RefreshCw, ExternalLink, MapPin, Clock, Users, Pencil, Trash2, AlertTriangle, CloudOff, Cloud, Repeat, X,
} from 'lucide-react';
import { useDepartments, useEmployees, useLeaves } from '../api/hooks';
import { useHolidays } from '../api/holidays';
import { holidayOn } from '../lib/holidays';
import {
  LOCATIONS, REPERTOIRE, TYPE_META, downloadICS, syncLeavesToGoogle, useCalEvents, useCalendarMode, useDeleteEvent, useSaveEvent,
} from '../api/calendarStore';
import { GoogleConnectModal, useGCalStatus } from '../components/GoogleConnect';
import { Avatar, EmployeePicker, Field, Modal, useConfirm } from '../components/ui';
import { addDays, cx, fmtDate, fullName, MONTHS, norm, pad, parseISO, todayISO, WEEKDAYS, WEEKDAYS_SHORT } from '../lib/utils';
import { toast } from '../lib/toast';
import type { CalEvent, CalEventInput, CalEventType, Employee } from '../types';

type View = 'month' | 'week' | 'agenda';
const HOUR_FROM = 8, HOUR_TO = 23, HOUR_PX = 46;
const weekStart = (iso: string) => addDays(iso, -((parseISO(iso).getDay() + 6) % 7));
const day = (s: string) => s.slice(0, 10);
const time = (s: string) => s.slice(11, 16);
const mins = (s: string) => Number(s.slice(11, 13)) * 60 + Number(s.slice(14, 16));

export default function CalendarPage() {
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState<View>(() => (localStorage.getItem('gtt-cal-view') as View) || 'month');
  const [cursor, setCursor] = useState(todayISO());
  const [types, setTypes] = useState<Set<CalEventType>>(new Set(['performance', 'rehearsal', 'shift', 'leave', 'other']));
  const [person, setPerson] = useState<string>('');
  const [form, setForm] = useState<CalEventInput | null>(null);
  const [detail, setDetail] = useState<CalEvent | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);

  const { mode, calendarName } = useCalendarMode();
  const status = useGCalStatus();
  const { data: emps = [] } = useEmployees();
  const { data: leaves = [] } = useLeaves();
  useHolidays(Number(cursor.slice(0, 4)));
  useEffect(() => { try { localStorage.setItem('gtt-cal-view', view); } catch { /* */ } }, [view]);

  const [from, to] = useMemo(() => {
    if (view === 'week') { const s = weekStart(cursor); return [s, addDays(s, 6)]; }
    if (view === 'agenda') return [cursor, addDays(cursor, 30)];
    const s = weekStart(`${cursor.slice(0, 7)}-01`); return [s, addDays(s, 41)];
  }, [view, cursor]);

  const { data: calEvents = [], isFetching, error, refetch } = useCalEvents(from, to);

  useEffect(() => {
    if (params.get('new')) { openNew(todayISO()); setParams({}, { replace: true }); }
  }, [params]); // eslint-disable-line react-hooks/exhaustive-deps

  const empMap = useMemo(() => new Map(emps.map((e) => [e.id, e])), [emps]);
  const leaveEvents: CalEvent[] = useMemo(() => leaves
    .filter((l) => l.status !== 'rədd edildi' && l.startDate <= to && l.endDate >= from)
    .map((l) => ({
      id: `leave-${l.id}`, title: `${fullName(empMap.get(l.employeeId))} — ${l.type.toLocaleLowerCase('az')}`, type: 'leave' as const, allDay: true,
      start: l.startDate, end: l.endDate, participants: [l.employeeId], leaveId: l.id, source: 'portal' as const, pending: l.status === 'gözləyir',
    })), [leaves, from, to, empMap]);

  const events = useMemo(() => [...calEvents, ...leaveEvents]
    .filter((e) => types.has(e.type) && (!person || e.participants.includes(person)))
    .sort((a, b) => a.start.localeCompare(b.start)), [calEvents, leaveEvents, types, person]);

  const eventsOn = (iso: string) => events.filter((e) => day(e.start) <= iso && day(e.end) >= iso);

  function openNew(date: string, hour?: number) {
    const h = hour ?? 11;
    setForm({ title: '', type: 'rehearsal', allDay: false, start: `${date}T${pad(h)}:00`, end: `${date}T${pad(Math.min(h + 3, 23))}:00`, location: 'Məşq zalı', description: '', participants: [], repeatWeeks: 1 });
  }
  const shift = (dir: number) => setCursor((c) => {
    if (view === 'week') return addDays(c, dir * 7);
    if (view === 'agenda') return addDays(c, dir * 30);
    const d = parseISO(c); return `${new Date(d.getFullYear(), d.getMonth() + dir, 1).getFullYear()}-${pad(new Date(d.getFullYear(), d.getMonth() + dir, 1).getMonth() + 1)}-01`;
  });
  const title = view === 'month' ? `${MONTHS[parseISO(cursor).getMonth()]} ${cursor.slice(0, 4)}`
    : view === 'week' ? `${fmtDate(from, false)} – ${fmtDate(to)}` : `${fmtDate(from, false)} – ${fmtDate(to)}`;

  const sync = async () => {
    setSyncing('Hazırlanır…');
    try {
      const r = await syncLeavesToGoogle(leaves, emps, (d, t) => setSyncing(`${d}/${t}`));
      toast.success(r.created + r.updated + r.deleted === 0 ? 'Məzuniyyətlər artıq sinxrondur' : `Google Calendar: ${r.created} əlavə, ${r.updated} yeniləndi, ${r.deleted} silindi`);
    } catch (e) { toast.error((e as Error).message); } finally { setSyncing(null); }
  };

  const toggleType = (t: CalEventType) => setTypes((s) => { const n = new Set(s); n.has(t) ? n.delete(t) : n.add(t); return n; });
  const err = error as (Error & { status?: number }) | null;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Təqvim</h1>
          <div className="page-sub">Tamaşalar, məşqlər, iş növbələri və məzuniyyətlər — bir yerdə</div>
        </div>
        <div className="page-actions">
          {mode === 'google' ? (
            <>
              <span className="badge b-success" style={{ alignSelf: 'center' }}><Cloud size={12} /> {calendarName}</span>
              <button className="btn" onClick={sync} disabled={!!syncing || status !== 'connected'} title="Təsdiqlənmiş məzuniyyətləri Google Calendar-a köçür">
                <RefreshCw size={15} className={syncing ? 'spin' : ''} /> {syncing ? `Sinxron ${syncing}` : 'Məzuniyyətləri sinxronlaşdır'}
              </button>
            </>
          ) : (
            <button className="btn" onClick={() => setConnectOpen(true)}><Cloud size={15} /> Google Calendar-a qoş</button>
          )}
          <button className="btn" onClick={() => downloadICS(events, `teatr-teqvimi-${from}.ics`)} title="Outlook, Apple Calendar və s. üçün"><Download size={15} /> .ics</button>
          <button className="btn btn-primary" onClick={() => openNew(view === 'month' ? (cursor.slice(0, 7) === todayISO().slice(0, 7) ? todayISO() : cursor) : cursor)}><Plus size={16} /> Yeni hadisə</button>
        </div>
      </div>

      {mode === 'local' && (
        <div className="banner info mb-16">
          <CloudOff size={18} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>Təqvim hazırda <b>lokal rejimdə</b> işləyir (hadisələr bu brauzerdə saxlanılır). Google Calendar-a qoşulduqda hadisələr əməkdaşların telefonlarında da görünəcək — pulsuz, standart kvota ilə.</div>
          <button className="btn btn-sm" onClick={() => setConnectOpen(true)}>Qoş</button>
        </div>
      )}
      {mode === 'google' && (status === 'expired' || err?.status === 401) && (
        <div className="banner warn mb-16"><AlertTriangle size={18} /><div style={{ flex: 1 }}>Google sessiyası bitib (tokenlər 1 saat etibarlıdır). Hadisələri görmək və dəyişmək üçün yenidən daxil olun.</div><button className="btn btn-sm" onClick={() => setConnectOpen(true)}>Yenidən qoşul</button></div>
      )}
      {err && err.status !== 401 && <div className="banner err mb-16"><AlertTriangle size={18} /><div style={{ flex: 1 }}>{err.message}</div><button className="btn btn-sm" onClick={() => refetch()}>Təkrar</button></div>}

      <div className="toolbar">
        <div className="seg">
          <button onClick={() => shift(-1)} aria-label="Əvvəlki"><ChevronLeft size={15} /></button>
          <button className="on" style={{ minWidth: 170 }}>{title}</button>
          <button onClick={() => shift(1)} aria-label="Növbəti"><ChevronRight size={15} /></button>
        </div>
        <button className="btn btn-sm" onClick={() => setCursor(todayISO())}>Bu gün</button>
        <div className="seg">
          {([['month', 'Ay'], ['week', 'Həftə'], ['agenda', 'Siyahı']] as const).map(([v, l]) => <button key={v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>{l}</button>)}
        </div>
        <div style={{ width: 260 }}>
          <EmployeePicker employees={emps.filter((e) => e.status !== 'işdən çıxıb')} value={person} onChange={setPerson} placeholder="Bütün əməkdaşlar" />
        </div>
        {person && <button className="btn btn-sm btn-ghost" onClick={() => setPerson('')}><X size={14} /> Hamısı</button>}
        {isFetching && <span className="small muted">yüklənir…</span>}
      </div>
      <div className="chips mb-16">
        {(Object.keys(TYPE_META) as CalEventType[]).map((t) => (
          <button key={t} className={cx('chip', types.has(t) && 'active')} onClick={() => toggleType(t)} style={types.has(t) ? { background: TYPE_META[t].color, borderColor: TYPE_META[t].color } : undefined}>
            <i style={{ width: 8, height: 8, borderRadius: 99, background: types.has(t) ? '#fff' : TYPE_META[t].color, display: 'inline-block' }} />{TYPE_META[t].label}
          </button>
        ))}
      </div>

      {view === 'month' && <MonthView cursor={cursor} from={from} eventsOn={eventsOn} onDay={(d) => openNew(d)} onEvent={setDetail} />}
      {view === 'week' && <WeekView from={from} events={events} onSlot={openNew} onEvent={setDetail} />}
      {view === 'agenda' && <AgendaView from={from} to={to} eventsOn={eventsOn} onEvent={setDetail} empMap={empMap} />}

      <EventDetail ev={detail} empMap={empMap} onClose={() => setDetail(null)}
        onEdit={(e) => { setDetail(null); setForm({ ...e }); }} />
      <EventForm value={form} onClose={() => setForm(null)} emps={emps} allEvents={calEvents} mode={mode} />
      <GoogleConnectModal open={connectOpen} onClose={() => setConnectOpen(false)} />
    </>
  );
}

/* ---------------- Ay ---------------- */
function MonthView({ cursor, from, eventsOn, onDay, onEvent }: { cursor: string; from: string; eventsOn: (d: string) => CalEvent[]; onDay: (d: string) => void; onEvent: (e: CalEvent) => void }) {
  const today = todayISO();
  const month = cursor.slice(5, 7);
  return (
    <div className="cal">
      {[1, 2, 3, 4, 5, 6, 0].map((d) => <div key={d} className="cal-h">{WEEKDAYS_SHORT[d]}</div>)}
      {Array.from({ length: 42 }, (_, i) => addDays(from, i)).map((iso) => {
        const evs = eventsOn(iso);
        const h = holidayOn(iso);
        const monday = parseISO(iso).getDay() === 1;
        return (
          <div key={iso} className={cx('cal-d clickable-day', iso.slice(5, 7) !== month && 'out', iso === today && 'today', h && 'hol')} onClick={() => onDay(iso)}>
            <div className="row between"><span className="cal-n">{Number(iso.slice(8))}</span>{monday && !h && <span className="small muted" style={{ fontSize: 10 }}>istirahət</span>}</div>
            {h && <div className="cal-hol" title={h.name}>★ {h.name}</div>}
            {evs.slice(0, 3).map((e) => <EventChip key={e.id + iso} e={e} onClick={onEvent} />)}
            {evs.length > 3 && <div className="cal-more">+{evs.length - 3} daha</div>}
          </div>
        );
      })}
    </div>
  );
}

function EventChip({ e, onClick }: { e: CalEvent; onClick: (e: CalEvent) => void }) {
  const c = TYPE_META[e.type].color;
  return (
    <div className="cal-ev" title={`${e.allDay ? '' : time(e.start) + ' '}${e.title}${e.pending ? ' (təsdiq gözləyir)' : ''}`}
      style={{ background: e.pending ? 'transparent' : c, color: e.pending ? c : '#fff', border: e.pending ? `1px dashed ${c}` : 0, cursor: 'pointer' }}
      onClick={(x) => { x.stopPropagation(); onClick(e); }}>
      {!e.allDay && <b>{time(e.start)} </b>}{e.title}
    </div>
  );
}

/* ---------------- Həftə ---------------- */
function WeekView({ from, events, onSlot, onEvent }: { from: string; events: CalEvent[]; onSlot: (d: string, h: number) => void; onEvent: (e: CalEvent) => void }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  const today = todayISO();
  const hours = Array.from({ length: HOUR_TO - HOUR_FROM }, (_, i) => HOUR_FROM + i);
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60_000); return () => clearInterval(t); }, []);
  const nowTop = ((now.getHours() * 60 + now.getMinutes()) - HOUR_FROM * 60) / 60 * HOUR_PX;

  return (
    <div className="card week">
      <div className="week-head">
        <div />
        {days.map((d) => {
          const h = holidayOn(d);
          return (
            <div key={d} className={cx('week-day', d === today && 'today')}>
              <div className="small muted">{WEEKDAYS_SHORT[parseISO(d).getDay()]}</div>
              <div className="week-num">{Number(d.slice(8))}</div>
              {h && <div className="cal-hol" title={h.name}>★ {h.name}</div>}
            </div>
          );
        })}
      </div>
      <div className="week-allday">
        <div className="small muted" style={{ padding: '4px 6px' }}>bütün gün</div>
        {days.map((d) => (
          <div key={d} className="week-allday-cell">
            {events.filter((e) => e.allDay && day(e.start) <= d && day(e.end) >= d).map((e) => <EventChip key={e.id} e={e} onClick={onEvent} />)}
          </div>
        ))}
      </div>
      <div className="week-body" style={{ height: hours.length * HOUR_PX }}>
        <div className="week-hours">{hours.map((h) => <div key={h} style={{ height: HOUR_PX }}>{pad(h)}:00</div>)}</div>
        {days.map((d) => {
          const list = events.filter((e) => !e.allDay && day(e.start) === d);
          // Üst-üstə düşən hadisələr üçün zolaqlar
          const lanes: number[] = [];
          const placed = list.map((e) => {
            const s = mins(e.start), en = Math.max(mins(e.end), s + 30);
            let lane = lanes.findIndex((end) => end <= s);
            if (lane < 0) { lane = lanes.length; lanes.push(en); } else lanes[lane] = en;
            return { e, s, en, lane };
          });
          const n = Math.max(1, lanes.length);
          return (
            <div key={d} className={cx('week-col', parseISO(d).getDay() === 1 && 'rest', holidayOn(d) && 'hol')}>
              {hours.map((h) => <div key={h} className="week-slot" style={{ height: HOUR_PX }} onClick={() => onSlot(d, h)} />)}
              {placed.map(({ e, s, en, lane }) => (
                <div key={e.id} className="week-ev" onClick={() => onEvent(e)} title={e.title}
                  style={{ top: (s - HOUR_FROM * 60) / 60 * HOUR_PX, height: Math.max(22, (en - s) / 60 * HOUR_PX - 2), left: `calc(${(lane / n) * 100}% + 2px)`, width: `calc(${100 / n}% - 4px)`, background: TYPE_META[e.type].color }}>
                  <div className="strong" style={{ fontSize: 11.5 }}>{e.title}</div>
                  <div style={{ fontSize: 10.5, opacity: .9 }}>{time(e.start)}–{time(e.end)}{e.location ? ` · ${e.location}` : ''}</div>
                </div>
              ))}
              {d === today && nowTop > 0 && nowTop < hours.length * HOUR_PX && <div className="now-line" style={{ top: nowTop }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Siyahı ---------------- */
function AgendaView({ from, to, eventsOn, onEvent, empMap }: { from: string; to: string; eventsOn: (d: string) => CalEvent[]; onEvent: (e: CalEvent) => void; empMap: Map<string, Employee> }) {
  const days: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  const filled = days.filter((d) => eventsOn(d).length || holidayOn(d));
  if (!filled.length) return <div className="card empty">Bu dövrdə hadisə yoxdur</div>;
  return (
    <div className="card">
      {filled.map((d) => {
        const h = holidayOn(d);
        return (
          <div key={d} className="agenda-day">
            <div className="agenda-date">
              <div className="strong" style={{ fontSize: 22, color: d === todayISO() ? 'var(--accent)' : undefined }}>{Number(d.slice(8))}</div>
              <div className="small muted">{MONTHS[parseISO(d).getMonth()].slice(0, 3)}, {WEEKDAYS[parseISO(d).getDay()]}</div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              {h && <div className="cal-hol" style={{ marginBottom: 6 }}>★ {h.name}</div>}
              {eventsOn(d).map((e) => (
                <div key={e.id} className="agenda-ev" onClick={() => onEvent(e)}>
                  <i style={{ background: TYPE_META[e.type].color }} />
                  <span className="small muted" style={{ width: 92, flexShrink: 0 }}>{e.allDay ? 'bütün gün' : `${time(e.start)}–${time(e.end)}`}</span>
                  <span className="strong" style={{ flex: 1, minWidth: 0 }}>{e.title}{e.pending && <span className="badge b-warning plain" style={{ marginLeft: 6 }}>gözləyir</span>}</span>
                  {e.location && <span className="small muted row" style={{ gap: 4 }}><MapPin size={12} />{e.location}</span>}
                  <span className="avatar-stack">{e.participants.slice(0, 5).map((p) => <Avatar key={p} e={empMap.get(p)} size="xs" />)}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- Hadisə detalları ---------------- */
function EventDetail({ ev, onClose, onEdit, empMap }: { ev: CalEvent | null; onClose: () => void; onEdit: (e: CalEvent) => void; empMap: Map<string, Employee> }) {
  const del = useDeleteEvent();
  const confirm = useConfirm();
  if (!ev) return null;
  const portal = ev.source === 'portal';
  const remove = async (series: boolean) => {
    if (await confirm({ title: series ? 'Bütün seriyanı silmək?' : 'Hadisəni silmək?', text: series ? 'Bu təkrarlanan hadisənin bütün tarixləri silinəcək.' : ev.title, confirm: 'Sil', danger: true }))
      del.mutate({ ev, series }, { onSuccess: onClose });
  };
  return (
    <Modal open onClose={onClose} title={<span className="row"><i style={{ width: 12, height: 12, borderRadius: 3, background: TYPE_META[ev.type].color, display: 'inline-block' }} />{ev.title}</span>}
      footer={portal ? <a className="btn" href="/leaves">Məzuniyyətlər bölməsində aç</a> : <>
        <button className="btn btn-danger" style={{ marginRight: 'auto' }} onClick={() => remove(false)}><Trash2 size={15} /> Sil</button>
        {ev.recurringEventId && <button className="btn btn-danger" onClick={() => remove(true)}><Repeat size={15} /> Seriyanı sil</button>}
        {ev.htmlLink && <a className="btn" href={ev.htmlLink} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Google-da aç</a>}
        <button className="btn btn-primary" onClick={() => onEdit(ev)}><Pencil size={15} /> Redaktə</button>
      </>}>
      <div className="grid" style={{ gap: 10 }}>
        <div className="row wrap" style={{ gap: 8 }}>
          <span className="badge plain" style={{ background: TYPE_META[ev.type].color, color: '#fff' }}>{TYPE_META[ev.type].label}</span>
          {ev.pending && <span className="badge b-warning">Təsdiq gözləyir</span>}
          {ev.recurringEventId && <span className="badge plain"><Repeat size={11} /> Təkrarlanan</span>}
          <span className="badge plain">{ev.source === 'google' ? 'Google Calendar' : ev.source === 'portal' ? 'HR Portal' : 'Lokal'}</span>
        </div>
        <div className="row"><Clock size={15} className="muted" />{ev.allDay ? (ev.start === ev.end ? fmtDate(ev.start) : `${fmtDate(ev.start)} – ${fmtDate(ev.end)}`) : `${WEEKDAYS[parseISO(ev.start).getDay()]}, ${fmtDate(day(ev.start))} · ${time(ev.start)}–${time(ev.end)}`}</div>
        {ev.location && <div className="row"><MapPin size={15} className="muted" />{ev.location}</div>}
        {ev.description && <div className="small" style={{ whiteSpace: 'pre-wrap', color: 'var(--ink-2)' }}>{ev.description}</div>}
        {ev.participants.length > 0 && (
          <div>
            <div className="row small strong mb-16" style={{ marginBottom: 8 }}><Users size={15} /> İştirakçılar ({ev.participants.length})</div>
            <div className="row wrap" style={{ gap: 6 }}>
              {ev.participants.map((p) => { const e = empMap.get(p); return e ? <a key={p} href={`/employees/${p}`} className="tag row" style={{ gap: 6 }}><Avatar e={e} size="xs" />{fullName(e)}</a> : null; })}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ---------------- Yarat / redaktə ---------------- */
function EventForm({ value, onClose, emps, allEvents, mode }: { value: CalEventInput | null; onClose: () => void; emps: Employee[]; allEvents: CalEvent[]; mode: 'google' | 'local' }) {
  const save = useSaveEvent();
  const { data: leaves = [] } = useLeaves();
  const { data: depts = [] } = useDepartments();
  const [f, setF] = useState<CalEventInput | null>(null);
  const [q, setQ] = useState('');
  useEffect(() => { setF(value); setQ(''); }, [value]);
  const conflicts = useMemo(() => {
    if (!f) return [];
    const out: string[] = [];
    const s = day(f.start), e = day(f.end);
    for (let d = s; d <= e; d = addDays(d, 1)) {
      const h = holidayOn(d);
      if (h) out.push(`${fmtDate(d, false)} — rəsmi bayram: ${h.name}`);
      if (parseISO(d).getDay() === 1 && f.type !== 'leave') out.push(`${fmtDate(d, false)} — bazar ertəsi, teatrın istirahət günü`);
    }
    for (const p of f.participants) {
      const emp = emps.find((x) => x.id === p);
      const l = leaves.find((x) => x.employeeId === p && x.status !== 'rədd edildi' && x.startDate <= e && x.endDate >= s);
      if (l) out.push(`${fullName(emp)} həmin tarixdə məzuniyyətdədir${l.status === 'gözləyir' ? ' (sorğu gözləyir)' : ''}`);
      if (!f.allDay) {
        const clash = allEvents.find((x) => x.id !== f.id && !x.allDay && x.participants.includes(p) && day(x.start) === s && x.start < f.end && x.end > f.start);
        if (clash) out.push(`${fullName(emp)} eyni vaxtda "${clash.title}" (${time(clash.start)}–${time(clash.end)}) hadisəsindədir`);
      }
    }
    return [...new Set(out)];
  }, [f, leaves, emps, allEvents]);
  if (!f) return null;

  const date = day(f.start);
  const set = (p: Partial<CalEventInput>) => setF({ ...f, ...p });
  const setDate = (d: string) => f.allDay ? set({ start: d, end: d > f.end ? d : f.end }) : set({ start: `${d}T${time(f.start)}`, end: `${d}T${time(f.end)}` });
  const valid = f.title.trim() && (f.allDay ? f.end >= f.start : f.end > f.start);
  const sel = new Set(f.participants);
  const toggle = (id: string) => { const s = new Set(sel); s.has(id) ? s.delete(id) : s.add(id); set({ participants: [...s] }); };
  const active = emps.filter((e) => e.status !== 'işdən çıxıb');
  const pickType = (t: CalEventType) => {
    const loc = t === 'performance' ? 'Böyük səhnə' : t === 'rehearsal' ? 'Məşq zalı' : f.location;
    set({ type: t, location: loc, allDay: t === 'leave' ? true : f.allDay, ...(t === 'leave' ? { start: date, end: date } : {}) });
  };

  return (
    <Modal open onClose={onClose} wide title={f.id ? 'Hadisəni redaktə et' : 'Yeni hadisə'}
      footer={<>
        <span className="small muted" style={{ marginRight: 'auto' }}>{mode === 'google' ? 'Google Calendar-da saxlanılacaq' : 'Lokal saxlanılacaq'}</span>
        <button className="btn" onClick={onClose}>Ləğv et</button>
        <button className="btn btn-primary" disabled={!valid || save.isPending} onClick={() => save.mutate(f, { onSuccess: onClose })}>{save.isPending ? 'Saxlanılır…' : conflicts.length ? 'Xəbərdarlığa baxmayaraq saxla' : 'Yadda saxla'}</button>
      </>}>
      <div className="form-grid">
        <Field label="Növ" full>
          <div className="chips">
            {(['performance', 'rehearsal', 'shift', 'other'] as CalEventType[]).map((t) => (
              <button type="button" key={t} className={cx('chip', f.type === t && 'active')} onClick={() => pickType(t)} style={f.type === t ? { background: TYPE_META[t].color, borderColor: TYPE_META[t].color } : undefined}>{TYPE_META[t].label}</button>
            ))}
          </div>
        </Field>
        <Field label="Başlıq *" full>
          <input className="input" autoFocus list="repertoire" value={f.title} onChange={(e) => set({ title: e.target.value })}
            placeholder={f.type === 'performance' ? '«Cırtdan» — tamaşa' : f.type === 'rehearsal' ? '«Cırtdan» — məşq' : f.type === 'shift' ? 'Texniki heyət — növbə' : 'Başlıq'} />
          <datalist id="repertoire">{REPERTOIRE.flatMap((r) => [`${r} — tamaşa`, `${r} — məşq`]).map((x) => <option key={x} value={x} />)}</datalist>
        </Field>
        <Field label="Tarix"><input type="date" className="input" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} /></Field>
        <Field label="Vaxt">
          <div className="row">
            <label className="check small" style={{ whiteSpace: 'nowrap' }}><input type="checkbox" checked={f.allDay} onChange={(e) => set(e.target.checked ? { allDay: true, start: date, end: date } : { allDay: false, start: `${date}T11:00`, end: `${date}T14:00` })} /> Bütün gün</label>
            {!f.allDay && <>
              <input type="time" className="input" value={time(f.start)} onChange={(e) => set({ start: `${date}T${e.target.value}` })} />
              <span className="muted">–</span>
              <input type="time" className="input" value={time(f.end)} onChange={(e) => set({ end: `${date}T${e.target.value}` })} />
            </>}
          </div>
        </Field>
        {f.allDay && <Field label="Son gün"><input type="date" className="input" min={f.start} value={f.end} onChange={(e) => set({ end: e.target.value })} /></Field>}
        <Field label="Məkan">
          <input className="input" list="locations" value={f.location ?? ''} onChange={(e) => set({ location: e.target.value })} />
          <datalist id="locations">{LOCATIONS.map((l) => <option key={l} value={l} />)}</datalist>
        </Field>
        {!f.id && (
          <Field label="Təkrar" hint={mode === 'google' ? 'Google-da həftəlik RRULE kimi yaradılır' : undefined}>
            <select className="select" value={f.repeatWeeks ?? 1} onChange={(e) => set({ repeatWeeks: Number(e.target.value) })}>
              <option value={1}>Təkrarlanmır</option>
              {[2, 4, 6, 8, 12].map((n) => <option key={n} value={n}>Hər həftə · {n} dəfə</option>)}
            </select>
          </Field>
        )}
        <Field label="Qeyd" full><textarea className="textarea" style={{ minHeight: 60 }} value={f.description ?? ''} onChange={(e) => set({ description: e.target.value })} /></Field>
        <Field label={`İştirakçılar (${sel.size})`} full>
          <div className="row wrap" style={{ gap: 6 }}>
            <input className="input" style={{ maxWidth: 220 }} placeholder="Axtar…" value={q} onChange={(e) => setQ(e.target.value)} />
            <select className="select" style={{ maxWidth: 240 }} value="" onChange={(e) => e.target.value && set({ participants: [...new Set([...f.participants, ...active.filter((x) => x.departmentId === e.target.value).map((x) => x.id)])] })}>
              <option value="">+ Bölməni əlavə et</option>{depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            {sel.size > 0 && <button type="button" className="btn btn-sm btn-ghost" onClick={() => set({ participants: [] })}>Təmizlə</button>}
          </div>
          <div className="pick-list">
            {active.filter((e) => norm(fullName(e) + e.position).includes(norm(q))).map((e) => (
              <label key={e.id} className="check"><input type="checkbox" checked={sel.has(e.id)} onChange={() => toggle(e.id)} /><Avatar e={e} size="xs" /><span className="small">{fullName(e)}</span><span className="small muted">· {e.position}</span></label>
            ))}
          </div>
        </Field>
      </div>
      {conflicts.length > 0 && (
        <div className="banner warn mt-16"><AlertTriangle size={18} style={{ flexShrink: 0 }} />
          <div><b>Diqqət:</b><ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>{conflicts.slice(0, 6).map((c) => <li key={c} className="small">{c}</li>)}</ul>{conflicts.length > 6 && <div className="small">+{conflicts.length - 6} daha</div>}</div>
        </div>
      )}
    </Modal>
  );
}
