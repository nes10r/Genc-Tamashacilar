import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, Mail, Phone, UserCheck, Briefcase } from 'lucide-react';
import {
  useCandidates, useCreateCandidate, useDeleteCandidate, useDeleteVacancy, useDepartments, useSaveVacancy, useUpdateCandidate, useVacancies,
} from '../api/hooks';
import EmployeeForm from '../components/EmployeeForm';
import { Field, Modal, Stars, useConfirm, Empty } from '../components/ui';
import { cx, fmtDate, todayISO } from '../lib/utils';
import { toast } from '../lib/toast';
import type { Candidate, CandidateStage, Employee, Vacancy } from '../types';

const STAGES: { id: CandidateStage; label: string; color: string }[] = [
  { id: 'müraciət', label: 'Müraciət', color: '#7a7168' },
  { id: 'müsahibə', label: 'Müsahibə', color: '#2b5c9e' },
  { id: 'dinləmə', label: 'Dinləmə (audition)', color: '#5b3a8c' },
  { id: 'təklif', label: 'Təklif', color: '#b8862f' },
  { id: 'qəbul', label: 'Qəbul edildi', color: '#2f7d4f' },
  { id: 'imtina', label: 'İmtina', color: '#b42318' },
];

export default function Recruitment() {
  const [params, setParams] = useSearchParams();
  const { data: vacancies = [] } = useVacancies();
  const { data: candidates = [] } = useCandidates();
  const { data: depts = [] } = useDepartments();
  const saveV = useSaveVacancy();
  const delV = useDeleteVacancy();
  const update = useUpdateCandidate();
  const confirm = useConfirm();
  const nav = useNavigate();
  const [vf, setVf] = useState<string>('');
  const [vForm, setVForm] = useState<Partial<Vacancy> | null>(null);
  const [cForm, setCForm] = useState<Partial<Candidate> | null>(null);
  const [detail, setDetail] = useState<Candidate | null>(null);
  const [hire, setHire] = useState<{ c: Candidate; init: Partial<Employee> } | null>(null);
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  useEffect(() => {
    if (params.get('new')) { setVForm({ title: '', departmentId: '', openings: 1, salaryRange: '', description: '', status: 'açıq' }); setParams({}, { replace: true }); }
  }, [params, setParams]);

  const deptName = (id: string) => depts.find((d) => d.id === id)?.name ?? '';
  const vac = (id: string) => vacancies.find((v) => v.id === id);
  const shown = vf ? candidates.filter((c) => c.vacancyId === vf) : candidates;

  const move = (c: Candidate, stage: CandidateStage) => {
    if (c.stage === stage) return;
    const prev = c.stage;
    update.mutate({ id: c.id, stage }, {
      onSuccess: () => {
        toast.success(`${c.name} → ${STAGES.find((s) => s.id === stage)!.label}`, { label: 'Geri al', onClick: () => update.mutate({ id: c.id, stage: prev }) });
        if (stage === 'qəbul') startHire(c);
      },
    });
  };
  const startHire = (c: Candidate) => {
    const v = vac(c.vacancyId);
    const [firstName, ...rest] = c.name.split(' ');
    setHire({ c, init: { firstName, lastName: rest.join(' '), email: c.email, phone: c.phone, position: v?.title ?? '', departmentId: v?.departmentId ?? '', hireDate: todayISO(), notes: c.notes } });
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">İşə qəbul</h1>
          <div className="page-sub">Vakansiyalar və namizədlərin seçim prosesi · kartları sürükləyərək mərhələni dəyişin</div>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => setCForm({ name: '', vacancyId: vf || vacancies.find((v) => v.status === 'açıq')?.id, email: '', phone: '+994 ', rating: 3, notes: '' })}><Plus size={16} /> Namizəd</button>
          <button className="btn btn-primary" onClick={() => setVForm({ title: '', departmentId: '', openings: 1, salaryRange: '', description: '', status: 'açıq' })}><Briefcase size={16} /> Vakansiya elan et</button>
        </div>
      </div>

      <div className="grid g-4 mb-16">
        {vacancies.map((v) => {
          const n = candidates.filter((c) => c.vacancyId === v.id);
          return (
            <div key={v.id} className={cx('card card-pad')} style={{ cursor: 'pointer', outline: vf === v.id ? '2px solid var(--accent)' : 'none', opacity: v.status === 'bağlı' ? .6 : 1 }} onClick={() => setVf(vf === v.id ? '' : v.id)}>
              <div className="row between" style={{ alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  <div className="strong">{v.title}</div>
                  <div className="small muted">{deptName(v.departmentId)}</div>
                </div>
                <span className={cx('badge', v.status === 'açıq' ? 'b-success' : '')}>{v.status}</span>
              </div>
              <div className="row between mt-16 small">
                <span className="muted">{v.openings} yer · {v.salaryRange}</span>
                <div className="row" style={{ gap: 2 }}>
                  <button className="icon-btn sm" onClick={(e) => { e.stopPropagation(); setVForm(v); }} aria-label="Redaktə"><Pencil size={14} /></button>
                  <button className="icon-btn sm" aria-label="Sil" onClick={async (e) => { e.stopPropagation(); if (await confirm({ title: 'Vakansiyanı silmək?', text: `"${v.title}" və ona bağlı ${n.length} namizəd silinəcək.`, confirm: 'Sil', danger: true })) delV.mutate(v.id); }}><Trash2 size={14} /></button>
                </div>
              </div>
              <div className="row mt-8" style={{ gap: 3 }}>
                {STAGES.slice(0, 5).map((s) => { const k = n.filter((c) => c.stage === s.id).length; return <div key={s.id} title={`${s.label}: ${k}`} style={{ flex: Math.max(k, .3), height: 5, borderRadius: 3, background: k ? s.color : 'var(--line-2)' }} />; })}
              </div>
              <div className="small muted mt-8">{n.length} namizəd</div>
            </div>
          );
        })}
      </div>
      {vf && <div className="banner info mb-16">Filtr: <b>{vac(vf)?.title}</b> <button className="btn btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setVf('')}>Filtri təmizlə</button></div>}

      <div className="kanban">
        {STAGES.map((s) => {
          const list = shown.filter((c) => c.stage === s.id);
          return (
            <div key={s.id} className={cx('kcol', over === s.id && 'over')}
              onDragOver={(e) => { e.preventDefault(); setOver(s.id); }} onDragLeave={() => setOver(null)}
              onDrop={() => { const c = candidates.find((x) => x.id === drag); if (c) move(c, s.id); setDrag(null); setOver(null); }}>
              <div className="kcol-head"><i style={{ width: 8, height: 8, borderRadius: 99, background: s.color, display: 'inline-block' }} />{s.label}<span className="muted" style={{ marginLeft: 'auto' }}>{list.length}</span></div>
              <div className="kcol-body">
                {list.map((c) => (
                  <div key={c.id} className={cx('kcard', drag === c.id && 'dragging')} draggable onDragStart={() => setDrag(c.id)} onDragEnd={() => setDrag(null)} onClick={() => setDetail(c)}>
                    <div className="strong small">{c.name}</div>
                    <div className="small muted">{vac(c.vacancyId)?.title}</div>
                    <div className="row between mt-8"><Stars value={c.rating} size={13} /><span className="small muted">{fmtDate(c.appliedAt, false)}</span></div>
                  </div>
                ))}
                {list.length === 0 && <div className="small muted" style={{ textAlign: 'center', padding: '20px 0', border: '1px dashed var(--line)', borderRadius: 8 }}>Buraya sürükləyin</div>}
              </div>
            </div>
          );
        })}
      </div>

      <VacancyForm v={vForm} onClose={() => setVForm(null)} onSave={(v) => saveV.mutate(v, { onSuccess: () => setVForm(null) })} depts={depts} />
      <CandidateForm c={cForm} onClose={() => setCForm(null)} vacancies={vacancies} />

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.name}
        footer={detail && <>
          <DeleteCandidate c={detail} onDone={() => setDetail(null)} />
          <button className="btn btn-success" onClick={() => { startHire(detail); setDetail(null); }}><UserCheck size={15} /> İşə qəbul et</button>
        </>}>
        {detail && (() => {
          const c = candidates.find((x) => x.id === detail.id) ?? detail;
          return (
            <div className="grid" style={{ gap: 14 }}>
              <div className="small muted">{vac(c.vacancyId)?.title} · müraciət {fmtDate(c.appliedAt)}</div>
              <div className="row wrap small" style={{ gap: 16 }}>
                {c.email && <a href={`mailto:${c.email}`} className="row" style={{ gap: 5 }}><Mail size={14} />{c.email}</a>}
                {c.phone && <span className="row" style={{ gap: 5 }}><Phone size={14} />{c.phone}</span>}
              </div>
              <Field label="Reytinq"><Stars value={c.rating} size={20} onChange={(r) => update.mutate({ id: c.id, rating: r })} /></Field>
              <Field label="Mərhələ">
                <div className="chips">{STAGES.map((s) => <button key={s.id} className={cx('chip', c.stage === s.id && 'active')} onClick={() => move(c, s.id)}>{s.label}</button>)}</div>
              </Field>
              <Field label="Qeydlər"><NotesEditor c={c} /></Field>
            </div>
          );
        })()}
      </Modal>

      <EmployeeForm open={!!hire} onClose={() => setHire(null)} initial={hire?.init}
        onSaved={(e) => { if (hire && hire.c.stage !== 'qəbul') update.mutate({ id: hire.c.id, stage: 'qəbul' }); nav(`/employees/${e.id}`); }} />
    </>
  );
}

function NotesEditor({ c }: { c: Candidate }) {
  const update = useUpdateCandidate();
  const [v, setV] = useState(c.notes);
  return <textarea className="textarea" value={v} onChange={(e) => setV(e.target.value)} onBlur={() => v !== c.notes && update.mutate({ id: c.id, notes: v })} placeholder="Müsahibə və dinləmə qeydləri… (avtomatik yadda saxlanılır)" />;
}

function DeleteCandidate({ c, onDone }: { c: Candidate; onDone: () => void }) {
  const del = useDeleteCandidate();
  const confirm = useConfirm();
  return <button className="btn btn-danger" style={{ marginRight: 'auto' }} onClick={async () => { if (await confirm({ title: 'Namizədi silmək?', confirm: 'Sil', danger: true })) del.mutate(c.id, { onSuccess: onDone }); }}><Trash2 size={15} /> Sil</button>;
}

function VacancyForm({ v, onClose, onSave, depts }: { v: Partial<Vacancy> | null; onClose: () => void; onSave: (v: Partial<Vacancy>) => void; depts: { id: string; name: string }[] }) {
  const [f, setF] = useState<Partial<Vacancy>>({});
  useEffect(() => { if (v) setF(v); }, [v]);
  return (
    <Modal open={!!v} onClose={onClose} title={f.id ? 'Vakansiyanı redaktə et' : 'Yeni vakansiya'}
      footer={<><button className="btn" onClick={onClose}>Ləğv et</button><button className="btn btn-primary" disabled={!f.title || !f.departmentId} onClick={() => onSave(f)}>Yadda saxla</button></>}>
      <div className="form-grid">
        <Field label="Vəzifə *" full><input className="input" autoFocus value={f.title ?? ''} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Bölmə *"><select className="select" value={f.departmentId ?? ''} onChange={(e) => setF({ ...f, departmentId: e.target.value })}><option value="">Seçin…</option>{depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
        <Field label="Yer sayı"><input type="number" min={1} className="input" value={f.openings ?? 1} onChange={(e) => setF({ ...f, openings: Number(e.target.value) })} /></Field>
        <Field label="Maaş aralığı"><input className="input" placeholder="800–1000 ₼" value={f.salaryRange ?? ''} onChange={(e) => setF({ ...f, salaryRange: e.target.value })} /></Field>
        <Field label="Status"><select className="select" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as Vacancy['status'] })}><option>açıq</option><option>bağlı</option></select></Field>
        <Field label="Təsvir və tələblər" full><textarea className="textarea" value={f.description ?? ''} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

function CandidateForm({ c, onClose, vacancies }: { c: Partial<Candidate> | null; onClose: () => void; vacancies: Vacancy[] }) {
  const create = useCreateCandidate();
  const [f, setF] = useState<Partial<Candidate>>({});
  useEffect(() => { if (c) setF(c); }, [c]);
  if (!vacancies.length && c) return <Modal open onClose={onClose} title="Namizəd"><Empty title="Əvvəlcə vakansiya yaradın" /></Modal>;
  return (
    <Modal open={!!c} onClose={onClose} title="Yeni namizəd"
      footer={<><button className="btn" onClick={onClose}>Ləğv et</button><button className="btn btn-primary" disabled={!f.name || !f.vacancyId || create.isPending} onClick={() => create.mutate(f, { onSuccess: onClose })}>Əlavə et</button></>}>
      <div className="form-grid">
        <Field label="Ad, soyad *" full><input className="input" autoFocus value={f.name ?? ''} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Vakansiya *" full><select className="select" value={f.vacancyId ?? ''} onChange={(e) => setF({ ...f, vacancyId: e.target.value })}>{vacancies.map((v) => <option key={v.id} value={v.id}>{v.title}{v.status === 'bağlı' ? ' (bağlı)' : ''}</option>)}</select></Field>
        <Field label="E-poçt"><input className="input" value={f.email ?? ''} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Telefon"><input className="input" value={f.phone ?? ''} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        <Field label="İlkin reytinq"><Stars value={f.rating ?? 3} size={20} onChange={(r) => setF({ ...f, rating: r })} /></Field>
        <Field label="Qeyd" full><textarea className="textarea" value={f.notes ?? ''} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

