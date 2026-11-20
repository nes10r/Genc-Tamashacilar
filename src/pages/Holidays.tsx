import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, RefreshCw, PartyPopper, Download, Settings2, Cloud, HardDrive } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { fetchHolidays, useHolidays } from '../api/holidays';
import { Empty, SkelRows } from '../components/ui';
import { MONTHS, WEEKDAYS, WEEKDAYS_SHORT, cx, downloadCSV, fmtDate, parseISO, pad, todayISO } from '../lib/utils';
import type { Holiday } from '../lib/holidays';

export default function Holidays() {
  const [year, setYear] = useState(new Date().getFullYear());
  const { data, isLoading, isFetching } = useHolidays(year);
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const today = todayISO();

  const refresh = async () => {
    setRefreshing(true);
    const r = await fetchHolidays(year, { force: true });
    qc.setQueryData(['holidays', year], r);
    qc.invalidateQueries({ queryKey: ['attendance'] });
    setRefreshing(false);
  };

  const holidays = data?.holidays ?? [];
  const offDays = useMemo(() => {
    const m = new Map<string, Holiday>();
    holidays.forEach((h) => { m.set(h.date, h); if (h.observed) m.set(h.observed, h); });
    return m;
  }, [holidays]);

  const months = useMemo(() => MONTHS.map((name, i) => {
    const days = new Date(year, i + 1, 0).getDate();
    let office = 0, theatre = 0, hol = 0;
    for (let d = 1; d <= days; d++) {
      const iso = `${year}-${pad(i + 1)}-${pad(d)}`;
      const wd = new Date(year, i, d).getDay();
      const isHol = offDays.has(iso);
      if (isHol) hol++;
      if (!isHol && wd !== 0 && wd !== 6) office++;   // 5 günlük iş həftəsi (inzibati heyət)
      if (!isHol && wd !== 1) theatre++;              // teatr qrafiki: bazar ertəsi istirahət
    }
    return { name, days, office, theatre, hol };
  }), [year, offDays]);

  const totals = months.reduce((s, m) => ({ office: s.office + m.office, theatre: s.theatre + m.theatre, hol: s.hol + m.hol }), { office: 0, theatre: 0, hol: 0 });
  const next = holidays.find((h) => h.date >= today);

  const exportCsv = () => downloadCSV(`bayramlar-${year}.csv`, [
    ['Tarix', 'Həftənin günü', 'Bayram', 'Köçürülmüş gün', 'Mənbə'],
    ...holidays.map((h) => [h.date, WEEKDAYS[parseISO(h.date).getDay()], h.name, h.observed ?? '', h.source === 'api' ? 'holidayapi.com' : 'Daxili siyahı']),
  ]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Bayram təqvimi</h1>
          <div className="page-sub">Azərbaycan Respublikasının rəsmi bayram və qeyri-iş günləri · holidayapi.com</div>
        </div>
        <div className="page-actions">
          <div className="seg">
            <button onClick={() => setYear(year - 1)} aria-label="Əvvəlki il"><ChevronLeft size={15} /></button>
            <button className="on">{year}</button>
            <button onClick={() => setYear(year + 1)} aria-label="Növbəti il"><ChevronRight size={15} /></button>
          </div>
          <button className="btn" onClick={refresh} disabled={refreshing}><RefreshCw size={15} className={refreshing ? 'spin' : ''} /> API-dan yenilə</button>
          <button className="btn" onClick={exportCsv} disabled={!holidays.length}><Download size={15} /> CSV</button>
        </div>
      </div>

      {data && (
        <div className={cx('banner mb-16', data.source === 'local' ? 'warn' : 'ok')}>
          {data.source === 'local' ? <HardDrive size={18} /> : <Cloud size={18} />}
          <div style={{ flex: 1 }}>
            <b>{data.source === 'api' ? 'Mənbə: holidayapi.com' : data.source === 'proxy' ? 'Mənbə: backend proksi (holidayapi.com)' : 'Mənbə: daxili siyahı'}</b>
            {data.message && <> — {data.message}</>}
            {data.requests && <span> · Sorğular: {data.requests.used}/{data.requests.used + data.requests.available}</span>}
            {data.source === 'local' && <div className="small" style={{ marginTop: 2 }}>Dini bayramların (Ramazan, Qurban) tarixləri təxminidir. Dəqiq məlumat üçün Holiday API açarını daxil edin.</div>}
          </div>
          {data.source === 'local' && <Link to="/settings" className="btn btn-sm"><Settings2 size={14} /> Açarı daxil et</Link>}
        </div>
      )}

      <div className="grid g-4 mb-16">
        <div className="card stat"><span className="stat-label">Bayram günləri</span><span className="stat-value">{holidays.length}</span><span className="stat-foot">{year}-ci il</span></div>
        <div className="card stat"><span className="stat-label">İş günləri (5 günlük həftə)</span><span className="stat-value">{totals.office}</span><span className="stat-foot">İnzibati heyət üçün norma</span></div>
        <div className="card stat"><span className="stat-label">İş günləri (teatr qrafiki)</span><span className="stat-value">{totals.theatre}</span><span className="stat-foot">Bazar ertəsi istirahət</span></div>
        <div className="card stat"><span className="stat-label">Növbəti bayram</span><span className="stat-value" style={{ fontSize: 18, paddingTop: 6 }}>{next ? next.name : '—'}</span><span className="stat-foot">{next ? fmtDate(next.date) : 'Bu il başqa bayram yoxdur'}</span></div>
      </div>

      <div className="grid g-main">
        <div className="card">
          <div className="card-head"><div className="card-title row"><PartyPopper size={16} /> Bayramlar siyahısı</div>{isFetching && <span className="small muted">yüklənir…</span>}</div>
          {isLoading ? <SkelRows /> : holidays.length === 0 ? <Empty title="Bayram tapılmadı" /> : (
            <div className="table-wrap mt-8">
              <table className="table">
                <thead><tr><th>Tarix</th><th>Gün</th><th>Bayram</th><th>Qeyd</th></tr></thead>
                <tbody>
                  {holidays.map((h) => {
                    const wd = parseISO(h.date).getDay();
                    const past = h.date < today;
                    return (
                      <tr key={h.date + h.name} style={{ opacity: past ? .55 : 1 }}>
                        <td className="strong" style={{ whiteSpace: 'nowrap' }}>{fmtDate(h.date)}</td>
                        <td className="small">{WEEKDAYS[wd]}</td>
                        <td>{h.name}{h.originalName && h.originalName !== h.name && <div className="small muted">{h.originalName}</div>}</td>
                        <td className="small">
                          {h.date === today && <span className="badge b-accent">Bu gün</span>}{' '}
                          {h.observed && <span className="badge b-info">{fmtDate(h.observed, false)} tarixinə keçirilib</span>}{' '}
                          {(wd === 0 || wd === 6) && !h.observed && <span className="badge plain">Həftəsonu</span>}{' '}
                          {h.approximate && <span className="badge b-warning">Təxmini</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-head"><div className="card-title">Aylar üzrə iş günü norması</div></div>
          <div className="table-wrap mt-8">
            <table className="table">
              <thead><tr><th>Ay</th><th className="num">Bayram</th><th className="num">5 günlük</th><th className="num">Teatr</th></tr></thead>
              <tbody>
                {months.map((m) => (
                  <tr key={m.name}>
                    <td>{m.name}</td>
                    <td className="num">{m.hol ? <span className="badge b-accent plain">{m.hol}</span> : <span className="muted">—</span>}</td>
                    <td className="num">{m.office}</td>
                    <td className="num">{m.theatre}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><td>Cəmi</td><td className="num">{totals.hol}</td><td className="num">{totals.office}</td><td className="num">{totals.theatre}</td></tr></tfoot>
            </table>
          </div>
        </div>
      </div>

      <div className="card card-pad mt-16">
        <div className="card-title mb-16">İllik təqvim</div>
        <div className="year-grid">
          {MONTHS.map((name, mi) => {
            const first = new Date(year, mi, 1).getDay();
            const lead = (first + 6) % 7; // Bazar ertəsindən başlayır
            const days = new Date(year, mi + 1, 0).getDate();
            return (
              <div key={name}>
                <div className="strong small" style={{ marginBottom: 6 }}>{name}</div>
                <div className="mini-cal">
                  {[1, 2, 3, 4, 5, 6, 0].map((d) => <span key={d} className="mh">{WEEKDAYS_SHORT[d]}</span>)}
                  {Array.from({ length: lead }, (_, i) => <span key={'l' + i} />)}
                  {Array.from({ length: days }, (_, i) => {
                    const iso = `${year}-${pad(mi + 1)}-${pad(i + 1)}`;
                    const h = offDays.get(iso);
                    const wd = new Date(year, mi, i + 1).getDay();
                    return <span key={iso} title={h?.name} className={cx('md', h && 'hol', (wd === 0 || wd === 6) && 'we', iso === today && 'now')}>{i + 1}</span>;
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <div className="legend mt-16">
          <span><i style={{ background: 'var(--accent)' }} /> Bayram / qeyri-iş günü</span>
          <span><i style={{ background: 'var(--line)' }} /> Şənbə, bazar</span>
          <span><i style={{ border: '2px solid var(--gold)' }} /> Bu gün</span>
        </div>
        <p className="small muted mt-16" style={{ marginBottom: 0 }}>
          Əmək Məcəlləsinin 105-ci maddəsinə əsasən bayram günü istirahət gününə düşdükdə, növbəti iş günü istirahət günü sayılır.
          Bu köçürmələr holidayapi.com-un "observed" sahəsindən götürülür. Bayramlar tabeldə, məzuniyyət günlərinin hesablanmasında və əmək haqqı normasında avtomatik nəzərə alınır.
        </p>
      </div>
    </>
  );
}
