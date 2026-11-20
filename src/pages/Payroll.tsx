import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, CheckCircle2, Banknote, Printer, Lock, Info } from 'lucide-react';
import { useDepartments, useEmployees, usePayroll, useSavePayroll } from '../api/hooks';
import { useHolidays } from '../api/holidays';
import { holidaysBetween } from '../lib/holidays';
import { Modal, Person, SkelRows, useConfirm } from '../components/ui';
import { calcPayroll, countWorkDays, cx, downloadCSV, fullName, money, pad, periodLabel } from '../lib/utils';
import type { PayrollItem } from '../types';

const STATUS_TONE = { qaralama: 'b-warning', təsdiqləndi: 'b-info', ödənildi: 'b-success' } as const;

export default function Payroll() {
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() + 1 });
  const period = `${ym.y}-${pad(ym.m)}`;
  const { data: run, isLoading } = usePayroll(period);
  const { data: emps = [] } = useEmployees();
  const { data: depts = [] } = useDepartments();
  useHolidays(ym.y);
  const save = useSavePayroll();
  const confirm = useConfirm();
  const [items, setItems] = useState<PayrollItem[]>([]);
  const [dirty, setDirty] = useState(false);
  const [slip, setSlip] = useState<PayrollItem | null>(null);
  const [dept, setDept] = useState('');
  useEffect(() => { if (run) { setItems(run.items); setDirty(false); } }, [run]);

  const byId = new Map(emps.map((e) => [e.id, e]));
  const locked = run?.status !== 'qaralama';
  const first = `${period}-01`, last = `${period}-${pad(new Date(ym.y, ym.m, 0).getDate())}`;
  const normDays = countWorkDays(first, last);
  const monthHolidays = holidaysBetween(first, last);

  const rows = useMemo(() => items.filter((i) => !dept || byId.get(i.employeeId)?.departmentId === dept).map((i) => ({ i, c: calcPayroll(i.base, i.bonus, i.overtime) })), [items, dept, emps]); // eslint-disable-line
  const tot = rows.reduce((s, { c }) => ({ gross: s.gross + c.gross, tax: s.tax + c.incomeTax, social: s.social + c.dsmf + c.unemployment + c.medical, net: s.net + c.net }), { gross: 0, tax: 0, social: 0, net: 0 });

  const edit = (id: string, k: 'bonus' | 'overtime', v: number) => { setItems((xs) => xs.map((x) => (x.employeeId === id ? { ...x, [k]: v } : x))); setDirty(true); };
  const shift = (d: number) => setYm(({ y, m }) => { const t = new Date(y, m - 1 + d, 1); return { y: t.getFullYear(), m: t.getMonth() + 1 }; });

  const setStatus = async (status: 'təsdiqləndi' | 'ödənildi') => {
    const ok = await confirm({ title: status === 'təsdiqləndi' ? 'Cədvəli təsdiqləmək?' : 'Ödənildi kimi qeyd etmək?', text: status === 'təsdiqləndi' ? 'Təsdiqdən sonra məbləğlər dəyişdirilə bilməz.' : `${money(tot.net)} məbləğində ödəniş qeydə alınacaq.` });
    if (ok) save.mutate({ period, status, items }, { onSuccess: () => setDirty(false) });
  };

  const exportCsv = () => downloadCSV(`emek-haqqi-${period}.csv`, [
    ['İşçi', 'Vəzifə', 'Əsas', 'Mükafat', 'Əlavə iş', 'Hesablanıb', 'Gəlir vergisi', 'DSMF 3%', 'İşsizlik 0.5%', 'İTS 2%', 'Ödəniləcək'],
    ...rows.map(({ i, c }) => { const e = byId.get(i.employeeId); return [fullName(e), e?.position ?? '', i.base, i.bonus, i.overtime, c.gross.toFixed(2), c.incomeTax.toFixed(2), c.dsmf.toFixed(2), c.unemployment.toFixed(2), c.medical.toFixed(2), c.net.toFixed(2)]; }),
  ]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Əmək haqqı</h1>
          <div className="page-sub">Aylıq hesablama cədvəli, tutulmalar və hesablaşma vərəqələri</div>
        </div>
        <div className="page-actions">
          <div className="seg">
            <button onClick={() => shift(-1)} aria-label="Əvvəlki ay"><ChevronLeft size={15} /></button>
            <button className="on" style={{ minWidth: 140 }}>{periodLabel(period)}</button>
            <button onClick={() => shift(1)} aria-label="Növbəti ay"><ChevronRight size={15} /></button>
          </div>
          <button className="btn" onClick={exportCsv}><Download size={16} /> CSV</button>
          {run?.status === 'qaralama' && <>
            {dirty && <button className="btn" onClick={() => save.mutate({ period, items }, { onSuccess: () => setDirty(false) })}>Qaralamanı saxla</button>}
            <button className="btn btn-primary" onClick={() => setStatus('təsdiqləndi')}><CheckCircle2 size={16} /> Təsdiqlə</button>
          </>}
          {run?.status === 'təsdiqləndi' && <button className="btn btn-success" onClick={() => setStatus('ödənildi')}><Banknote size={16} /> Ödənildi</button>}
        </div>
      </div>

      <div className="grid g-4 mb-16">
        <div className="card stat"><span className="stat-label">Status</span><span className="stat-value" style={{ fontSize: 20 }}>{run ? <span className={cx('badge', STATUS_TONE[run.status])} style={{ fontSize: 14 }}>{run.status}</span> : '…'}</span><span className="stat-foot">{rows.length} işçi</span></div>
        <div className="card stat"><span className="stat-label">Hesablanıb (gross)</span><span className="stat-value" style={{ fontSize: 22 }}>{money(tot.gross)}</span></div>
        <div className="card stat"><span className="stat-label">Vergi və sığorta tutulmaları</span><span className="stat-value" style={{ fontSize: 22 }}>{money(tot.tax + tot.social)}</span><span className="stat-foot">Gəlir vergisi {money(tot.tax)}</span></div>
        <div className="card stat"><span className="stat-label">Ödəniləcək (net)</span><span className="stat-value" style={{ fontSize: 22, color: 'var(--success)' }}>{money(tot.net)}</span></div>
      </div>

      <div className="banner info mb-16">
        <Info size={18} style={{ flexShrink: 0 }} />
        <div>
          {periodLabel(period)} üzrə iş günü norması: <b>{normDays} gün</b> (teatr qrafiki){monthHolidays.length > 0 && <> · bayramlar: {monthHolidays.map((h) => h.name).join(', ')}</>}.
          Tutulmalar sadələşdirilmiş qaydada hesablanır (gəlir vergisi 14% / 25%, DSMF 3%, işsizlik 0.5%, İTS 2%) — mühasibatlıqla yoxlayın.
        </div>
      </div>

      <div className="toolbar">
        <select className="select" style={{ width: 240 }} value={dept} onChange={(e) => setDept(e.target.value)}>
          <option value="">Bütün bölmələr</option>
          {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        {locked && <span className="small muted row"><Lock size={13} /> Cədvəl kilidlənib</span>}
      </div>

      <div className="card table-wrap">
        {isLoading ? <SkelRows /> : (
          <table className="table">
            <thead><tr><th>İşçi</th><th className="num">Əsas</th><th className="num">Mükafat</th><th className="num">Əlavə iş</th><th className="num">Hesablanıb</th><th className="num">Tutulma</th><th className="num">Ödəniləcək</th><th /></tr></thead>
            <tbody>
              {rows.map(({ i, c }) => (
                <tr key={i.employeeId}>
                  <td><Person e={byId.get(i.employeeId)} /></td>
                  <td className="num">{money(i.base)}</td>
                  <td className="num">{locked ? money(i.bonus) : <input type="number" min={0} step={10} className="input" style={{ width: 100, textAlign: 'right' }} value={i.bonus} onChange={(e) => edit(i.employeeId, 'bonus', Number(e.target.value))} />}</td>
                  <td className="num">{locked ? money(i.overtime) : <input type="number" min={0} step={10} className="input" style={{ width: 100, textAlign: 'right' }} value={i.overtime} onChange={(e) => edit(i.employeeId, 'overtime', Number(e.target.value))} />}</td>
                  <td className="num">{money(c.gross)}</td>
                  <td className="num muted">−{money(c.deductions)}</td>
                  <td className="num strong">{money(c.net)}</td>
                  <td><button className="icon-btn sm" onClick={() => setSlip(i)} aria-label="Vərəqə" title="Hesablaşma vərəqəsi"><Printer size={15} /></button></td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td>Cəmi</td><td /><td /><td /><td className="num">{money(tot.gross)}</td><td className="num">−{money(tot.tax + tot.social)}</td><td className="num">{money(tot.net)}</td><td /></tr></tfoot>
          </table>
        )}
      </div>

      <Modal open={!!slip} onClose={() => setSlip(null)} title="Hesablaşma vərəqəsi" footer={<button className="btn btn-primary" onClick={() => window.print()}><Printer size={15} /> Çap et</button>}>
        {slip && (() => {
          const e = byId.get(slip.employeeId);
          const c = calcPayroll(slip.base, slip.bonus, slip.overtime);
          const line = (l: string, v: number, neg = false) => <tr><td>{l}</td><td className="num">{neg ? '−' : ''}{money(v)}</td></tr>;
          return (
            <div className="doc" style={{ padding: 28, whiteSpace: 'normal' }}>
              <div className="doc-org">Gənc Tamaşaçılar Teatrı</div>
              <h3>HESABLAŞMA VƏRƏQƏSİ</h3>
              <div style={{ textAlign: 'center' }}>{periodLabel(period)}</div>
              <p><b>{fullName(e)}</b><br />{e?.position} · İş günü norması: {normDays}</p>
              <table className="table" style={{ fontFamily: 'inherit' }}><tbody>
                {line('Vəzifə maaşı', slip.base)}{line('Mükafat', slip.bonus)}{line('Əlavə iş / tamaşa', slip.overtime)}
                <tr><td><b>Hesablanıb</b></td><td className="num"><b>{money(c.gross)}</b></td></tr>
                {line('Gəlir vergisi', c.incomeTax, true)}{line('DSMF (3%)', c.dsmf, true)}{line('İşsizlikdən sığorta (0.5%)', c.unemployment, true)}{line('İcbari tibbi sığorta (2%)', c.medical, true)}
                <tr><td><b>Ödəniləcək</b></td><td className="num"><b>{money(c.net)}</b></td></tr>
              </tbody></table>
            </div>
          );
        })()}
      </Modal>
    </>
  );
}
