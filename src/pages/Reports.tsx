import { useMemo } from 'react';
import { Download } from 'lucide-react';
import { useDepartments, useEmployees, useLeaves } from '../api/hooks';
import { Donut, HBars, Skel, VBars } from '../components/ui';
import { age, diffDays, downloadCSV, money, todayISO } from '../lib/utils';

export default function Reports() {
  const { data: emps = [], isLoading } = useEmployees();
  const { data: depts = [] } = useDepartments();
  const { data: leaves = [] } = useLeaves();
  const today = todayISO();
  const year = today.slice(0, 4);

  const r = useMemo(() => {
    const active = emps.filter((e) => e.status !== 'işdən çıxıb');
    const left12 = emps.filter((e) => e.terminatedAt && diffDays(e.terminatedAt, today) <= 365).length;
    const ages = [['< 25', 0, 24], ['25–34', 25, 34], ['35–44', 35, 44], ['45–54', 45, 54], ['55+', 55, 200]] as const;
    const ten = [['< 1 il', 0, 1], ['1–3 il', 1, 3], ['3–5 il', 3, 5], ['5–10 il', 5, 10], ['10+ il', 10, 99]] as const;
    const yrs = (h: string) => diffDays(h, today) / 365;
    const leaveByType = new Map<string, number>();
    leaves.filter((l) => l.status === 'təsdiqləndi' && l.startDate.startsWith(year)).forEach((l) => leaveByType.set(l.type, (leaveByType.get(l.type) ?? 0) + l.days));
    return {
      active,
      avgAge: active.length ? active.reduce((s, e) => s + age(e.birthDate), 0) / active.length : 0,
      avgTenure: active.length ? active.reduce((s, e) => s + yrs(e.hireDate), 0) / active.length : 0,
      turnover: active.length ? (left12 / (active.length + left12)) * 100 : 0,
      fund: active.reduce((s, e) => s + e.salary, 0),
      gender: [{ label: 'Kişi', value: active.filter((e) => e.gender === 'K').length, color: '#2b5c9e' }, { label: 'Qadın', value: active.filter((e) => e.gender === 'Q').length, color: '#a3376f' }],
      ages: ages.map(([label, a, b]) => ({ label, value: active.filter((e) => { const x = age(e.birthDate); return x >= a && x <= b; }).length })),
      tenure: ten.map(([label, a, b]) => ({ label, value: active.filter((e) => { const x = yrs(e.hireDate); return x >= a && x < b; }).length })),
      fundByDept: depts.map((d) => ({ label: d.name, value: Math.round(active.filter((e) => e.departmentId === d.id).reduce((s, e) => s + e.salary, 0)), color: d.color })).sort((a, b) => b.value - a.value),
      leaveByType: [...leaveByType.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value),
      titled: active.filter((e) => e.title).length,
    };
  }, [emps, depts, leaves, today, year]);

  const exportAll = () => downloadCSV(`hr-hesabat-${today}.csv`, [
    ['Göstərici', 'Dəyər'],
    ['Aktiv işçi sayı', r.active.length], ['Orta yaş', r.avgAge.toFixed(1)], ['Orta staj (il)', r.avgTenure.toFixed(1)],
    ['Kadr axıcılığı (12 ay, %)', r.turnover.toFixed(1)], ['Aylıq əmək haqqı fondu (₼)', r.fund], ['Fəxri adlı işçilər', r.titled],
    [], ['Bölmə', 'Əmək haqqı fondu (₼)'], ...r.fundByDept.map((d) => [d.label, d.value]),
    [], ['Yaş qrupu', 'Say'], ...r.ages.map((a) => [a.label, a.value]),
  ]);

  if (isLoading) return <Skel h={400} />;
  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Hesabatlar və analitika</h1>
          <div className="page-sub">Kadr potensialının əsas göstəriciləri · {year}</div>
        </div>
        <button className="btn" onClick={exportAll}><Download size={16} /> Hesabatı yüklə</button>
      </div>
      <div className="grid g-4 mb-16">
        <div className="card stat"><span className="stat-label">Orta yaş</span><span className="stat-value">{r.avgAge.toFixed(1)}</span></div>
        <div className="card stat"><span className="stat-label">Orta staj</span><span className="stat-value">{r.avgTenure.toFixed(1)} il</span></div>
        <div className="card stat"><span className="stat-label">Kadr axıcılığı (12 ay)</span><span className="stat-value">{r.turnover.toFixed(1)}%</span></div>
        <div className="card stat"><span className="stat-label">Aylıq əmək haqqı fondu</span><span className="stat-value" style={{ fontSize: 22 }}>{money(r.fund)}</span><span className="stat-foot">{r.titled} fəxri adlı əməkdaş</span></div>
      </div>
      <div className="grid g-2">
        <div className="card card-pad"><div className="card-title mb-16">Yaş strukturu</div><VBars data={r.ages} /></div>
        <div className="card card-pad"><div className="card-title mb-16">Staj üzrə bölgü</div><VBars data={r.tenure} color="var(--gold)" /></div>
        <div className="card card-pad"><div className="card-title mb-16">Gender balansı</div><Donut data={r.gender} label="işçi" /></div>
        <div className="card card-pad"><div className="card-title mb-16">Məzuniyyət günləri növlər üzrə ({year})</div>{r.leaveByType.length ? <HBars data={r.leaveByType.map((x) => ({ ...x, color: 'var(--info)' }))} /> : <div className="muted small">Məlumat yoxdur</div>}</div>
        <div className="card card-pad" style={{ gridColumn: '1/-1' }}><div className="card-title mb-16">Bölmələr üzrə aylıq əmək haqqı fondu (₼)</div><HBars data={r.fundByDept} /></div>
      </div>
    </>
  );
}
