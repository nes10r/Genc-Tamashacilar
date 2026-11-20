import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Plus, Calendar, Clock, User, Pencil, Trash2, Star } from 'lucide-react';
import { useCreateEvaluation, useDepartments, useDeleteTraining, useEmployees, useEvaluations, useSaveTraining, useTrainings } from '../api/hooks';
import { Avatar, EmployeePicker, Empty, Field, HBars, Modal, Person, Stars, Tabs, useConfirm } from '../components/ui';
import { cx, fmtDate, fullName, norm, todayISO } from '../lib/utils';
import type { Evaluation, Training as T } from '../types';

const STATUS_TONE: Record<T['status'], string> = { planlaşdırılıb: 'b-info', 'davam edir': 'b-warning', tamamlandı: 'b-success' };

export default function Training() {
  const [params] = useSearchParams();
  const [tab, setTab] = useState<'trainings' | 'eval'>(params.get('tab') === 'eval' ? 'eval' : 'trainings');
  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Təlim və qiymətləndirmə</h1>
          <div className="page-sub">Peşəkar inkişaf proqramları, master-klasslar və mövsümi performans qiymətləndirməsi</div>
        </div>
      </div>
      <Tabs value={tab} onChange={setTab} items={[{ id: 'trainings', label: 'Təlimlər' }, { id: 'eval', label: 'Qiymətləndirmə' }]} />
      {tab === 'trainings' ? <Trainings /> : <Evaluations />}
    </>
  );
}

function Trainings() {
  const { data = [] } = useTrainings();
  const { data: emps = [] } = useEmployees();
  const save = useSaveTraining();
  const del = useDeleteTraining();
  const confirm = useConfirm();
  const [form, setForm] = useState<Partial<T> | null>(null);
  const [filter, setFilter] = useState('');
  const byId = new Map(emps.map((e) => [e.id, e]));
  const list = filter ? data.filter((t) => t.status === filter) : data;
  const totalHours = data.filter((t) => t.status === 'tamamlandı').reduce((s, t) => s + t.durationHours * t.participants.length, 0);

  return (
    <>
      <div className="row between wrap mb-16">
        <div className="chips">
          {['', 'planlaşdırılıb', 'davam edir', 'tamamlandı'].map((s) => <button key={s} className={cx('chip', filter === s && 'active')} onClick={() => setFilter(s)}>{s || 'Hamısı'}</button>)}
        </div>
        <div className="row">
          <span className="small muted">Bu il: {totalHours} adam-saat təlim</span>
          <button className="btn btn-primary" onClick={() => setForm({ title: '', category: 'Peşəkar inkişaf', trainer: '', date: todayISO(), durationHours: 4, participants: [], status: 'planlaşdırılıb' })}><Plus size={16} /> Yeni təlim</button>
        </div>
      </div>
      <div className="grid g-2">
        {list.length === 0 && <div className="card" style={{ gridColumn: '1/-1' }}><Empty title="Təlim yoxdur" /></div>}
        {list.map((t) => (
          <div key={t.id} className="card card-pad">
            <div className="row between" style={{ alignItems: 'flex-start' }}>
              <div><span className="tag">{t.category}</span><div className="strong mt-8" style={{ fontSize: 15 }}>{t.title}</div></div>
              <span className={cx('badge', STATUS_TONE[t.status])}>{t.status}</span>
            </div>
            <div className="row wrap small muted mt-8" style={{ gap: 14 }}>
              <span className="row" style={{ gap: 4 }}><Calendar size={13} />{fmtDate(t.date)}</span>
              <span className="row" style={{ gap: 4 }}><Clock size={13} />{t.durationHours} saat</span>
              <span className="row" style={{ gap: 4 }}><User size={13} />{t.trainer}</span>
            </div>
            <div className="row between mt-16">
              <div className="row">
                <div className="avatar-stack">{t.participants.slice(0, 8).map((p) => <Avatar key={p} e={byId.get(p)} size="xs" />)}</div>
                <span className="small muted">{t.participants.length} iştirakçı</span>
              </div>
              <div className="row" style={{ gap: 2 }}>
                {t.status !== 'tamamlandı' && <button className="btn btn-sm" onClick={() => save.mutate({ ...t, status: 'tamamlandı' })}>Tamamlandı</button>}
                <button className="icon-btn sm" onClick={() => setForm(t)} aria-label="Redaktə"><Pencil size={14} /></button>
                <button className="icon-btn sm" aria-label="Sil" onClick={async () => { if (await confirm({ title: 'Təlimi silmək?', confirm: 'Sil', danger: true })) del.mutate(t.id); }}><Trash2 size={14} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <TrainingForm t={form} onClose={() => setForm(null)} />
    </>
  );
}

function TrainingForm({ t, onClose }: { t: Partial<T> | null; onClose: () => void }) {
  const save = useSaveTraining();
  const { data: emps = [] } = useEmployees();
  const { data: depts = [] } = useDepartments();
  const [f, setF] = useState<Partial<T>>({});
  const [q, setQ] = useState('');
  useEffect(() => { if (t) { setF(t); setQ(''); } }, [t]);
  const active = emps.filter((e) => e.status !== 'işdən çıxıb');
  const sel = new Set(f.participants ?? []);
  const toggle = (id: string) => { const s = new Set(sel); s.has(id) ? s.delete(id) : s.add(id); setF({ ...f, participants: [...s] }); };
  const addDept = (d: string) => setF({ ...f, participants: [...new Set([...sel, ...active.filter((e) => e.departmentId === d).map((e) => e.id)])] });

  return (
    <Modal open={!!t} onClose={onClose} wide title={f.id ? 'Təlimi redaktə et' : 'Yeni təlim'}
      footer={<><button className="btn" onClick={onClose}>Ləğv et</button><button className="btn btn-primary" disabled={!f.title || save.isPending} onClick={() => save.mutate(f, { onSuccess: onClose })}>Yadda saxla</button></>}>
      <div className="form-grid">
        <Field label="Mövzu *" full><input className="input" autoFocus value={f.title ?? ''} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Kateqoriya"><select className="select" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{['Peşəkar inkişaf', 'Yaradıcı', 'Texniki', 'Əmək təhlükəsizliyi', 'Rəhbərlik'].map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Təlimçi"><input className="input" value={f.trainer ?? ''} onChange={(e) => setF({ ...f, trainer: e.target.value })} /></Field>
        <Field label="Tarix"><input type="date" className="input" value={f.date ?? ''} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="Müddət (saat)"><input type="number" min={1} className="input" value={f.durationHours ?? 1} onChange={(e) => setF({ ...f, durationHours: Number(e.target.value) })} /></Field>
        <Field label="Status"><select className="select" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as T['status'] })}><option>planlaşdırılıb</option><option>davam edir</option><option>tamamlandı</option></select></Field>
        <Field label={`İştirakçılar (${sel.size})`} full>
          <div className="row wrap" style={{ gap: 6 }}>
            <input className="input" style={{ maxWidth: 240 }} placeholder="Axtar…" value={q} onChange={(e) => setQ(e.target.value)} />
            <select className="select" style={{ maxWidth: 240 }} value="" onChange={(e) => e.target.value && addDept(e.target.value)}><option value="">+ Bütün bölməni əlavə et</option>{depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
            {sel.size > 0 && <button type="button" className="btn btn-sm btn-ghost" onClick={() => setF({ ...f, participants: [] })}>Təmizlə</button>}
          </div>
          <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: 8, marginTop: 6 }}>
            {active.filter((e) => norm(fullName(e) + e.position).includes(norm(q))).map((e) => (
              <label key={e.id} className="check list-item" style={{ padding: '6px 12px' }}><input type="checkbox" checked={sel.has(e.id)} onChange={() => toggle(e.id)} /><Avatar e={e} size="xs" /> {fullName(e)} <span className="muted small">· {e.position}</span></label>
            ))}
          </div>
        </Field>
      </div>
    </Modal>
  );
}

function Evaluations() {
  const { data = [] } = useEvaluations();
  const { data: emps = [] } = useEmployees();
  const { data: depts = [] } = useDepartments();
  const create = useCreateEvaluation();
  const [open, setOpen] = useState(false);
  const year = new Date().getFullYear();
  const blank: Partial<Evaluation> = { employeeId: undefined, period: `${year}/${year + 1} mövsümü`, score: 4, reviewer: 'Bədii rəhbər', strengths: '', improvements: '' };
  const [f, setF] = useState<Partial<Evaluation>>(blank);
  const byId = new Map(emps.map((e) => [e.id, e]));
  const deptAvg = depts.map((d) => {
    const ev = data.filter((x) => byId.get(x.employeeId)?.departmentId === d.id);
    return { label: d.name, value: ev.length ? Math.round((ev.reduce((s, x) => s + x.score, 0) / ev.length) * 10) / 10 : 0, color: d.color };
  }).filter((x) => x.value > 0);
  const notEvaluated = emps.filter((e) => e.status !== 'işdən çıxıb' && !data.some((x) => x.employeeId === e.id)).length;

  return (
    <div className="grid g-main">
      <div className="card">
        <div className="card-head">
          <div className="card-title">Qiymətləndirmələr</div>
          <button className="btn btn-primary btn-sm" onClick={() => { setF(blank); setOpen(true); }}><Plus size={15} /> Qiymətləndir</button>
        </div>
        <div className="table-wrap mt-8">
          {data.length === 0 ? <Empty icon={<Star size={40} />} title="Qiymətləndirmə yoxdur" /> : (
            <table className="table">
              <thead><tr><th>İşçi</th><th>Dövr</th><th>Qiymət</th><th>Güclü tərəflər</th></tr></thead>
              <tbody>{data.map((v) => (
                <tr key={v.id}><td><Link to={`/employees/${v.employeeId}`}><Person e={byId.get(v.employeeId)} /></Link></td><td className="small">{v.period}<div className="muted">{v.reviewer}</div></td><td><Stars value={v.score} /></td><td className="small muted">{v.strengths}</td></tr>
              ))}</tbody>
            </table>
          )}
        </div>
      </div>
      <div className="grid" style={{ alignContent: 'start' }}>
        <div className="card card-pad"><div className="card-title mb-16">Bölmələr üzrə orta qiymət</div><HBars data={deptAvg} max={5} /></div>
        <div className="card card-pad"><div className="card-title">Əhatə</div><div className="stat-value mt-8">{emps.length ? Math.round(((emps.length - notEvaluated) / emps.length) * 100) : 0}%</div><div className="small muted">{notEvaluated} işçi hələ qiymətləndirilməyib</div></div>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Performans qiymətləndirməsi"
        footer={<><button className="btn" onClick={() => setOpen(false)}>Ləğv et</button><button className="btn btn-primary" disabled={!f.employeeId || create.isPending} onClick={() => create.mutate(f, { onSuccess: () => setOpen(false) })}>Yadda saxla</button></>}>
        <div className="form-grid">
          <Field label="İşçi *" full><EmployeePicker employees={emps.filter((e) => e.status !== 'işdən çıxıb')} value={f.employeeId} onChange={(id) => setF({ ...f, employeeId: id })} /></Field>
          <Field label="Dövr"><input className="input" value={f.period} onChange={(e) => setF({ ...f, period: e.target.value })} /></Field>
          <Field label="Qiymətləndirən"><input className="input" value={f.reviewer} onChange={(e) => setF({ ...f, reviewer: e.target.value })} /></Field>
          <Field label="Ümumi qiymət" full><Stars value={f.score ?? 0} size={26} onChange={(s) => setF({ ...f, score: s })} /></Field>
          <Field label="Güclü tərəflər" full><textarea className="textarea" value={f.strengths} onChange={(e) => setF({ ...f, strengths: e.target.value })} /></Field>
          <Field label="İnkişaf sahələri" full><textarea className="textarea" value={f.improvements} onChange={(e) => setF({ ...f, improvements: e.target.value })} /></Field>
        </div>
      </Modal>
    </div>
  );
}
