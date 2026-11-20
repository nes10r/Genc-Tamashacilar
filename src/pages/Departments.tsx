import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, Users, Crown } from 'lucide-react';
import { useDeleteDepartment, useDepartments, useEmployees, useSaveDepartment } from '../api/hooks';
import { Avatar, Field, Modal, Skel, useConfirm } from '../components/ui';
import { fullName, money } from '../lib/utils';
import type { Department } from '../types';

const COLORS = ['#8c1c2b', '#c8963e', '#5b3a8c', '#2f7d6d', '#2b5c9e', '#b4572a', '#6b7a2a', '#a3376f', '#4a5560'];

export default function Departments() {
  const { data: depts = [], isLoading } = useDepartments();
  const { data: emps = [] } = useEmployees();
  const save = useSaveDepartment();
  const del = useDeleteDepartment();
  const confirm = useConfirm();
  const [form, setForm] = useState<Partial<Department> | null>(null);
  const active = emps.filter((e) => e.status !== 'işdən çıxıb');

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Təşkilati struktur</h1>
          <div className="page-sub">{depts.length} bölmə · {active.length} işçi · aylıq fond {money(active.reduce((s, e) => s + e.salary, 0))}</div>
        </div>
        <button className="btn btn-primary" onClick={() => setForm({ name: '', description: '', color: COLORS[depts.length % COLORS.length] })}><Plus size={16} /> Yeni bölmə</button>
      </div>

      <div className="grid g-3">
        {isLoading && Array.from({ length: 6 }, (_, i) => <div key={i} className="card card-pad"><Skel h={120} /></div>)}
        {depts.map((d) => {
          const members = active.filter((e) => e.departmentId === d.id);
          const head = emps.find((e) => e.id === d.headId);
          return (
            <div key={d.id} className="card" style={{ borderTop: `4px solid ${d.color}`, display: 'flex', flexDirection: 'column' }}>
              <div className="card-pad" style={{ flex: 1 }}>
                <div className="row between" style={{ alignItems: 'flex-start' }}>
                  <div>
                    <div className="card-title" style={{ fontSize: 16 }}>{d.name}</div>
                    <div className="small muted mt-8">{d.description}</div>
                  </div>
                  <div className="row" style={{ gap: 2 }}>
                    <button className="icon-btn sm" onClick={() => setForm(d)} aria-label="Redaktə"><Pencil size={15} /></button>
                    <button className="icon-btn sm" aria-label="Sil" onClick={async () => {
                      if (await confirm({ title: `"${d.name}" bölməsini silmək?`, text: 'Bölmədə aktiv işçi varsa, silinməyə icazə verilməyəcək.', confirm: 'Sil', danger: true })) del.mutate(d.id);
                    }}><Trash2 size={15} /></button>
                  </div>
                </div>
                {head && (
                  <Link to={`/employees/${head.id}`} className="row mt-16" style={{ gap: 10 }}>
                    <Avatar e={head} size="sm" />
                    <div><div className="small strong row" style={{ gap: 4 }}><Crown size={12} color="var(--gold)" /> {fullName(head)}</div><div className="small muted">{head.position}</div></div>
                  </Link>
                )}
              </div>
              <div className="row between" style={{ padding: '12px 20px', borderTop: '1px solid var(--line-2)' }}>
                <div className="avatar-stack">
                  {members.slice(0, 7).map((m) => <Avatar key={m.id} e={m} size="xs" />)}
                  {members.length > 7 && <span className="avatar xs" style={{ background: 'var(--muted)' }}>+{members.length - 7}</span>}
                </div>
                <Link to={`/employees?dept=${d.id}`} className="btn btn-ghost btn-sm"><Users size={14} /> {members.length} işçi</Link>
              </div>
            </div>
          );
        })}
      </div>

      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? 'Bölməni redaktə et' : 'Yeni bölmə'}
        footer={<>
          <button className="btn" onClick={() => setForm(null)}>Ləğv et</button>
          <button className="btn btn-primary" disabled={!form?.name || save.isPending} onClick={() => save.mutate(form!, { onSuccess: () => setForm(null) })}>Yadda saxla</button>
        </>}>
        {form && (
          <div className="form-grid">
            <Field label="Bölmənin adı *" full><input className="input" autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Təsvir" full><textarea className="textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
            <Field label="Rəhbər">
              <select className="select" value={form.headId ?? ''} onChange={(e) => setForm({ ...form, headId: e.target.value || undefined })}>
                <option value="">—</option>
                {active.filter((e) => !form.id || e.departmentId === form.id).map((e) => <option key={e.id} value={e.id}>{fullName(e)} — {e.position}</option>)}
              </select>
            </Field>
            <Field label="Rəng">
              <div className="row wrap" style={{ gap: 6 }}>
                {COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => setForm({ ...form, color: c })} aria-label={c}
                    style={{ width: 26, height: 26, borderRadius: 7, background: c, border: form.color === c ? '3px solid var(--ink)' : '0', cursor: 'pointer' }} />
                ))}
              </div>
            </Field>
          </div>
        )}
      </Modal>
    </>
  );
}
