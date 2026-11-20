import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, FileText, Printer, PenLine, Trash2, Search, FileSignature } from 'lucide-react';
import { useCreateOrder, useDeleteOrder, useDepartments, useEmployees, useLeaves, useOrders, useUpdateOrder } from '../api/hooks';
import { EmployeePicker, Empty, Field, Modal, Person, SkelRows, useConfirm, useDebounced } from '../components/ui';
import { cx, fmtDate, fullName, money, norm, todayISO } from '../lib/utils';
import type { Department, Employee, HrOrder, LeaveRequest, OrderType } from '../types';

const TYPES: OrderType[] = ['İşə qəbul', 'İşdən azad', 'Məzuniyyət', 'Köçürmə', 'Mükafatlandırma', 'İntizam', 'Ezamiyyət'];

export function orderBody(o: HrOrder, e?: Employee, d?: Department, leave?: LeaveRequest): string {
  const fio = e ? `${e.lastName} ${e.firstName} ${e.fatherName}` : '________';
  const pos = e ? `${d?.name ?? ''} bölməsinin ${e.position.toLocaleLowerCase('az')}` : '________';
  const base = o.content ? `\n\n${o.content}` : '';
  switch (o.type) {
    case 'İşə qəbul':
      return `Azərbaycan Respublikası Əmək Məcəlləsinin 43-cü maddəsinə əsasən,\n\nƏMR EDİRƏM:\n\n1. ${fio} ${fmtDate(e?.hireDate)} tarixindən ${pos} vəzifəsinə ${money(e?.salary ?? 0)} aylıq vəzifə maaşı ilə işə qəbul edilsin.\n2. Əmək müqaviləsi ${e?.employmentType === 'Ştat' ? 'müddətsiz' : `${fmtDate(e?.contractEnd)} tarixinədək müddətli`} bağlanılsın.\n3. Mühasibatlığa tapşırılsın ki, əmək haqqının ödənilməsini təmin etsin.${base}\n\nƏsas: işçinin ərizəsi, əmək müqaviləsi.`;
    case 'İşdən azad':
      return `Azərbaycan Respublikası Əmək Məcəlləsinə əsasən,\n\nƏMR EDİRƏM:\n\n1. ${pos} ${fio} ${fmtDate(e?.terminatedAt ?? o.date)} tarixindən tutduğu vəzifədən azad edilsin.\n2. Mühasibatlığa tapşırılsın ki, istifadə olunmamış məzuniyyət günləri üçün kompensasiya ödənilsin və tam haqq-hesab aparılsın.${base}\n\nƏsas: işçinin ərizəsi.`;
    case 'Məzuniyyət':
      return `Azərbaycan Respublikası Əmək Məcəlləsinin 114-cü maddəsinə əsasən,\n\nƏMR EDİRƏM:\n\n1. ${pos} ${fio}-ə ${leave ? `${fmtDate(leave.startDate)} – ${fmtDate(leave.endDate)} tarixləri üçün ${leave.days} iş günü müddətində ${leave.type.toLocaleLowerCase('az')}` : 'növbəti əmək məzuniyyəti'} verilsin.\n2. Məzuniyyət dövrünə düşən bayram günləri məzuniyyət müddətinə daxil edilmir.\n3. Mühasibatlığa məzuniyyət haqqının hesablanması tapşırılsın.${base}\n\nƏsas: işçinin ərizəsi.`;
    case 'Köçürmə':
      return `ƏMR EDİRƏM:\n\n1. ${fio} ${fmtDate(o.date)} tarixindən ${pos} vəzifəsinə köçürülsün.${base}\n\nƏsas: işçinin razılığı.`;
    case 'Mükafatlandırma':
      return `Teatrın yaradıcılıq fəaliyyətində göstərdiyi fərqlənməyə və uşaq tamaşaçılar üçün hazırlanan tamaşalarda yüksək ifaya görə,\n\nƏMR EDİRƏM:\n\n1. ${pos} ${fio} pul mükafatı ilə mükafatlandırılsın.\n2. Mühasibatlığa tapşırılsın ki, mükafatın ödənilməsini cari ayın əmək haqqı ilə təmin etsin.${base}`;
    case 'İntizam':
      return `Əmək intizamının pozulmasına görə, Əmək Məcəlləsinin 186-cı maddəsinə əsasən,\n\nƏMR EDİRƏM:\n\n1. ${pos} ${fio}-ə töhmət elan edilsin.${base}\n\nƏsas: izahat, xidməti arayış.`;
    case 'Ezamiyyət':
      return `ƏMR EDİRƏM:\n\n1. ${pos} ${fio} qastrol səfəri ilə əlaqədar ezamiyyətə göndərilsin.\n2. Ezamiyyət xərcləri qüvvədə olan normalar əsasında ödənilsin.${base}`;
  }
}

export default function Orders() {
  const [params, setParams] = useSearchParams();
  const [type, setType] = useState('');
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const { data: orders = [], isLoading } = useOrders();
  const { data: emps = [] } = useEmployees();
  const { data: depts = [] } = useDepartments();
  const { data: leaves = [] } = useLeaves();
  const update = useUpdateOrder();
  const del = useDeleteOrder();
  const confirm = useConfirm();
  const [view, setView] = useState<HrOrder | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [preset, setPreset] = useState<string>();
  const byId = new Map(emps.map((e) => [e.id, e]));

  useEffect(() => {
    const id = params.get('id');
    if (id && orders.length) { const o = orders.find((x) => x.id === id); if (o) setView(o); setParams({}, { replace: true }); }
    if (params.get('new')) { setPreset(params.get('employee') ?? undefined); setNewOpen(true); setParams({}, { replace: true }); }
  }, [params, orders, setParams]);

  const list = useMemo(() => orders.filter((o) => (!type || o.type === type) && (!dq || norm(`${o.number} ${fullName(byId.get(o.employeeId))}`).includes(norm(dq)))), [orders, type, dq, emps]); // eslint-disable-line
  const current = view ? orders.find((o) => o.id === view.id) ?? view : null;
  const leaveFor = (o: HrOrder) => leaves.filter((l) => l.employeeId === o.employeeId && l.status === 'təsdiqləndi' && l.type !== 'Xəstəlik').sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const drafts = orders.filter((o) => o.status === 'qaralama').length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Əmrlər və sənədlər</h1>
          <div className="page-sub">Kadr əmrləri reyestri · {drafts} imza gözləyən layihə</div>
        </div>
        <button className="btn btn-primary" onClick={() => { setPreset(undefined); setNewOpen(true); }}><Plus size={16} /> Yeni əmr</button>
      </div>
      <div className="toolbar">
        <div className="input-icon grow"><Search size={16} /><input className="input" placeholder="Nömrə və ya işçi adı…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="chips">
          <button className={cx('chip', !type && 'active')} onClick={() => setType('')}>Hamısı</button>
          {TYPES.map((t) => <button key={t} className={cx('chip', type === t && 'active')} onClick={() => setType(t)}>{t}</button>)}
        </div>
      </div>
      <div className="card table-wrap">
        {isLoading ? <SkelRows /> : list.length === 0 ? <Empty icon={<FileText size={40} />} title="Əmr tapılmadı" /> : (
          <table className="table">
            <thead><tr><th>Nömrə</th><th>Növ</th><th>İşçi</th><th>Tarix</th><th>Status</th><th /></tr></thead>
            <tbody>
              {list.map((o) => (
                <tr key={o.id} className="clickable" onClick={() => setView(o)}>
                  <td className="strong" style={{ fontFamily: 'monospace' }}>№ {o.number}</td>
                  <td>{o.type}</td>
                  <td><Person e={byId.get(o.employeeId)} /></td>
                  <td className="small">{fmtDate(o.date)}</td>
                  <td><span className={cx('badge', o.status === 'imzalandı' ? 'b-success' : 'b-warning')}>{o.status}</span></td>
                  <td className="num" onClick={(e) => e.stopPropagation()}>
                    {o.status === 'qaralama' && <button className="btn btn-sm" onClick={() => update.mutate({ id: o.id, status: 'imzalandı' })}><PenLine size={14} /> İmzala</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={!!current} onClose={() => setView(null)} wide title={current ? `Əmr № ${current.number}` : ''}
        footer={current && <>
          {current.status === 'qaralama' && <button className="btn btn-danger" style={{ marginRight: 'auto' }} onClick={async () => { if (await confirm({ title: 'Əmr layihəsini silmək?', confirm: 'Sil', danger: true })) del.mutate(current.id, { onSuccess: () => setView(null) }); }}><Trash2 size={15} /> Sil</button>}
          <button className="btn" onClick={() => window.print()}><Printer size={15} /> Çap et</button>
          {current.status === 'qaralama' && <button className="btn btn-primary" onClick={() => update.mutate({ id: current.id, status: 'imzalandı' })}><FileSignature size={15} /> İmzala</button>}
        </>}>
        {current && (() => {
          const e = byId.get(current.employeeId);
          return (
            <div className="doc">
              <div className="doc-org">Azərbaycan Respublikası Mədəniyyət Nazirliyi{'\n'}Gənc Tamaşaçılar Teatrı</div>
              <h3>ƏMR</h3>
              <div className="doc-meta"><span>№ {current.number}</span><span>Bakı şəhəri</span><span>{fmtDate(current.date)}</span></div>
              <div style={{ textAlign: 'center', fontWeight: 700, marginBottom: 16 }}>{current.type} haqqında</div>
              {orderBody(current, e, depts.find((d) => d.id === e?.departmentId), current.type === 'Məzuniyyət' ? leaveFor(current) : undefined)}
              {'\n\n'}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <span><b>Direktor</b></span>
                <span>{current.status === 'imzalandı' ? <span className="stamp">İMZALANDI</span> : '____________'}</span>
              </div>
            </div>
          );
        })()}
      </Modal>

      <NewOrder open={newOpen} onClose={() => setNewOpen(false)} employeeId={preset} employees={emps} onCreated={(o) => setView(o)} />
    </>
  );
}

function NewOrder({ open, onClose, employeeId, employees, onCreated }: { open: boolean; onClose: () => void; employeeId?: string; employees: Employee[]; onCreated: (o: HrOrder) => void }) {
  const create = useCreateOrder();
  const [f, setF] = useState<Partial<HrOrder>>({});
  useEffect(() => { if (open) setF({ type: 'Mükafatlandırma', employeeId, date: todayISO(), content: '', status: 'qaralama' }); }, [open, employeeId]);
  return (
    <Modal open={open} onClose={onClose} title="Yeni əmr layihəsi"
      footer={<><button className="btn" onClick={onClose}>Ləğv et</button><button className="btn btn-primary" disabled={!f.employeeId || create.isPending} onClick={() => create.mutate(f, { onSuccess: (o) => { onClose(); onCreated(o as HrOrder); } })}>Layihəni yarat</button></>}>
      <div className="form-grid">
        <Field label="Əmrin növü" full><div className="chips">{TYPES.map((t) => <button type="button" key={t} className={cx('chip', f.type === t && 'active')} onClick={() => setF({ ...f, type: t })}>{t}</button>)}</div></Field>
        <Field label="İşçi *" full><EmployeePicker employees={employees} value={f.employeeId} onChange={(id) => setF({ ...f, employeeId: id })} /></Field>
        <Field label="Tarix"><input type="date" className="input" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        <div />
        <Field label="Əlavə bənd / qeyd" hint="Əmrin mətni seçilmiş növün şablonu əsasında avtomatik yaradılır" full><textarea className="textarea" value={f.content} onChange={(e) => setF({ ...f, content: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}
