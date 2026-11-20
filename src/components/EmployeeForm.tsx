import { useEffect, useState } from 'react';
import { useDepartments, useSaveEmployee } from '../api/hooks';
import { Field, Modal } from './ui';
import type { Employee } from '../types';
import { todayISO } from '../lib/utils';

const EMPTY: Partial<Employee> = {
  firstName: '', lastName: '', fatherName: '', gender: 'K', position: '', departmentId: '', email: '', phone: '+994 ',
  birthDate: '', hireDate: todayISO(), salary: 800, status: 'aktiv', employmentType: 'Ştat', fin: '', address: '',
  education: '', title: '', skills: [], emergencyContact: '', notes: '',
};

export default function EmployeeForm({ open, onClose, initial, onSaved }: {
  open: boolean; onClose: () => void; initial?: Partial<Employee>; onSaved?: (e: Employee) => void;
}) {
  const { data: depts = [] } = useDepartments();
  const save = useSaveEmployee();
  const [f, setF] = useState<Partial<Employee>>(EMPTY);
  const [skills, setSkills] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      const v = { ...EMPTY, ...initial };
      setF(v);
      setSkills((v.skills ?? []).join(', '));
      setErrors({});
    }
  }, [open, initial]);

  const set = <K extends keyof Employee>(k: K, v: Employee[K]) => {
    setF((p) => ({ ...p, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: '' }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!f.firstName?.trim()) e.firstName = 'Ad tələb olunur';
    if (!f.lastName?.trim()) e.lastName = 'Soyad tələb olunur';
    if (!f.position?.trim()) e.position = 'Vəzifə tələb olunur';
    if (!f.departmentId) e.departmentId = 'Bölmə seçin';
    if (!f.hireDate) e.hireDate = 'Tarix tələb olunur';
    if (f.fin && !/^[0-9A-Z]{7}$/i.test(f.fin)) e.fin = 'FİN 7 simvoldan ibarət olmalıdır';
    if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) e.email = 'E-poçt düzgün deyil';
    if (f.employmentType !== 'Ştat' && !f.contractEnd) e.contractEnd = 'Müqavilə üzrə işçi üçün bitmə tarixi lazımdır';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = () => {
    if (!validate()) return;
    const payload = { ...f, fin: f.fin?.toUpperCase(), skills: skills.split(',').map((s) => s.trim()).filter(Boolean), salary: Number(f.salary) };
    if (payload.employmentType === 'Ştat') delete payload.contractEnd;
    save.mutate(payload, { onSuccess: (e) => { onSaved?.(e as Employee); onClose(); } });
  };

  return (
    <Modal open={open} onClose={onClose} wide title={f.id ? 'İşçi məlumatlarını redaktə et' : 'Yeni işçi'}
      footer={<>
        <button className="btn" onClick={onClose}>Ləğv et</button>
        <button className="btn btn-primary" onClick={submit} disabled={save.isPending}>{save.isPending ? 'Yadda saxlanılır…' : 'Yadda saxla'}</button>
      </>}>
      <form className="form-grid" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <div className="form-section">Şəxsi məlumatlar</div>
        <Field label="Ad *" error={errors.firstName}><input className={`input ${errors.firstName ? 'invalid' : ''}`} value={f.firstName} onChange={(e) => set('firstName', e.target.value)} autoFocus /></Field>
        <Field label="Soyad *" error={errors.lastName}><input className={`input ${errors.lastName ? 'invalid' : ''}`} value={f.lastName} onChange={(e) => set('lastName', e.target.value)} /></Field>
        <Field label="Ata adı"><input className="input" value={f.fatherName} placeholder="məs. Əli oğlu" onChange={(e) => set('fatherName', e.target.value)} /></Field>
        <Field label="Cins">
          <div className="seg" style={{ alignSelf: 'flex-start' }}>
            <button type="button" className={f.gender === 'K' ? 'on' : ''} onClick={() => set('gender', 'K')}>Kişi</button>
            <button type="button" className={f.gender === 'Q' ? 'on' : ''} onClick={() => set('gender', 'Q')}>Qadın</button>
          </div>
        </Field>
        <Field label="Doğum tarixi"><input type="date" className="input" value={f.birthDate} onChange={(e) => set('birthDate', e.target.value)} /></Field>
        <Field label="FİN" error={errors.fin} hint="Şəxsiyyət vəsiqəsindəki 7 simvol"><input className={`input ${errors.fin ? 'invalid' : ''}`} maxLength={7} value={f.fin} style={{ textTransform: 'uppercase' }} onChange={(e) => set('fin', e.target.value)} /></Field>
        <Field label="Telefon"><input className="input" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
        <Field label="E-poçt" error={errors.email}><input className={`input ${errors.email ? 'invalid' : ''}`} value={f.email} onChange={(e) => set('email', e.target.value)} /></Field>
        <Field label="Ünvan" full><input className="input" value={f.address} onChange={(e) => set('address', e.target.value)} /></Field>

        <div className="form-section">Əmək fəaliyyəti</div>
        <Field label="Bölmə *" error={errors.departmentId}>
          <select className="select" value={f.departmentId} onChange={(e) => set('departmentId', e.target.value)}>
            <option value="">Seçin…</option>
            {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </Field>
        <Field label="Vəzifə *" error={errors.position}><input className={`input ${errors.position ? 'invalid' : ''}`} value={f.position} list="positions" onChange={(e) => set('position', e.target.value)} /></Field>
        <datalist id="positions">
          {['Aktyor', 'Aparıcı aktyor', 'Kukla aktyoru', 'Gənc aktyor', 'Quruluşçu rejissor', 'Rejissor assistenti', 'Səhnə müdiri', 'Dekorator', 'Qrimçi', 'Geyim tikən', 'İşıq ustası', 'Səs rejissoru', 'Konsertmeyster', 'Musiqiçi', 'Dramaturq', 'Kassir', 'İnzibatçı', 'Mühasib'].map((p) => <option key={p} value={p} />)}
        </datalist>
        <Field label="İşə qəbul tarixi *" error={errors.hireDate}><input type="date" className="input" value={f.hireDate} onChange={(e) => set('hireDate', e.target.value)} /></Field>
        <Field label="Əmək haqqı (₼, aylıq)"><input type="number" min={0} step={25} className="input" value={f.salary} onChange={(e) => set('salary', Number(e.target.value))} /></Field>
        <Field label="Müqavilə növü">
          <select className="select" value={f.employmentType} onChange={(e) => set('employmentType', e.target.value as Employee['employmentType'])}>
            <option>Ştat</option><option>Müqavilə</option><option>Əvəzçilik</option>
          </select>
        </Field>
        {f.employmentType !== 'Ştat' ? (
          <Field label="Müqavilənin bitmə tarixi *" error={errors.contractEnd}><input type="date" className={`input ${errors.contractEnd ? 'invalid' : ''}`} value={f.contractEnd ?? ''} onChange={(e) => set('contractEnd', e.target.value)} /></Field>
        ) : <div />}
        <Field label="Fəxri ad" hint="Varsa"><select className="select" value={f.title ?? ''} onChange={(e) => set('title', e.target.value || undefined)}>
          <option value="">—</option><option>Xalq artisti</option><option>Əməkdar artist</option><option>Əməkdar incəsənət xadimi</option><option>Əməkdar mədəniyyət işçisi</option>
        </select></Field>
        <Field label="Təhsil"><input className="input" value={f.education} onChange={(e) => set('education', e.target.value)} /></Field>
        <Field label="Bacarıqlar" hint="Vergüllə ayırın: Vokal, Plastika, Kukla teatrı" full><input className="input" value={skills} onChange={(e) => setSkills(e.target.value)} /></Field>
        <Field label="Təcili əlaqə" full><input className="input" value={f.emergencyContact} placeholder="Ad — telefon" onChange={(e) => set('emergencyContact', e.target.value)} /></Field>
        <Field label="Qeydlər" full><textarea className="textarea" value={f.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
      </form>
    </Modal>
  );
}
