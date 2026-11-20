import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Server, PlugZap, RotateCcw, Save, PartyPopper, KeyRound, Eye, EyeOff } from 'lucide-react';
import { api, getApiConfig, setApiConfig, type ApiConfig } from '../api/client';
import { mockRoutes, resetMockDb } from '../api/mock/server';
import { fetchHolidays, getHolidayKey, setHolidayKey } from '../api/holidays';
import { clearHolidayCache } from '../lib/holidays';
import { Field, useConfirm } from '../components/ui';
import { GoogleCalendarSettings } from '../components/GoogleConnect';
import { toast } from '../lib/toast';
import { cx } from '../lib/utils';

export default function Settings() {
  const [cfg, setCfg] = useState<ApiConfig>(getApiConfig());
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [hKey, setHKey] = useState(getHolidayKey());
  const [showKey, setShowKey] = useState(false);
  const [hResult, setHResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [hTesting, setHTesting] = useState(false);
  const qc = useQueryClient();
  const confirm = useConfirm();

  const test = async () => {
    setTesting(true); setResult(null);
    const t0 = performance.now();
    try {
      const r = await api<{ status: string }>('GET', '/health', undefined, cfg);
      setResult({ ok: true, text: `Bağlantı uğurludur (${Math.round(performance.now() - t0)} ms) — status: ${r?.status ?? 'ok'}` });
    } catch (e) {
      setResult({ ok: false, text: (e as Error).message });
    } finally { setTesting(false); }
  };
  const saveCfg = () => { setApiConfig(cfg); qc.invalidateQueries(); toast.success(cfg.mode === 'mock' ? 'Demo API rejimi aktivdir' : 'Canlı API-ya keçildi'); };

  const testHoliday = async () => {
    setHolidayKey(hKey);
    setHTesting(true); setHResult(null);
    const y = new Date().getFullYear();
    const r = await fetchHolidays(y, { force: true });
    qc.setQueryData(['holidays', y], r);
    qc.invalidateQueries({ queryKey: ['holidays'] });
    qc.invalidateQueries({ queryKey: ['attendance'] });
    setHResult(r.source === 'local' ? { ok: false, text: r.message ?? 'Uğursuz' } : { ok: true, text: `${y}-ci il üçün ${r.holidays.length} bayram günü yükləndi${r.requests ? ` · qalan sorğu: ${r.requests.available}` : ''}` });
    setHTesting(false);
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Ayarlar və API</h1>
          <div className="page-sub">Backend bağlantısı, xarici xidmətlər və demo məlumatlar</div>
        </div>
      </div>

      <div className="grid g-2">
        <div className="card card-pad">
          <div className="card-title row mb-16"><Server size={17} /> HR backend API</div>
          <div className="seg mb-16">
            <button className={cfg.mode === 'mock' ? 'on' : ''} onClick={() => setCfg({ ...cfg, mode: 'mock' })}>Demo API (brauzerdə)</button>
            <button className={cfg.mode === 'live' ? 'on' : ''} onClick={() => setCfg({ ...cfg, mode: 'live' })}>Canlı API</button>
          </div>
          {cfg.mode === 'mock' ? (
            <div className="banner info">Portal daxili Demo API ilə işləyir: bütün əməliyyatlar real REST sorğuları kimi emal olunur və məlumatlar bu brauzerdə saxlanılır. Backend hazır olduqda "Canlı API" rejiminə keçin.</div>
          ) : (
            <div className="form-grid">
              <Field label="API ünvanı (base URL)" hint="məs. https://hr-api.gtt.az/api/v1" full><input className="input" value={cfg.baseUrl} onChange={(e) => setCfg({ ...cfg, baseUrl: e.target.value })} placeholder="https://…" /></Field>
              <Field label="Bearer token" hint="Authorization başlığında göndərilir" full><input className="input" type="password" value={cfg.token} onChange={(e) => setCfg({ ...cfg, token: e.target.value })} /></Field>
            </div>
          )}
          {result && <div className={cx('banner mt-16', result.ok ? 'ok' : 'err')}>{result.text}</div>}
          <div className="row mt-16">
            <button className="btn" onClick={test} disabled={testing}><PlugZap size={15} /> {testing ? 'Yoxlanılır…' : 'Bağlantını yoxla'}</button>
            <button className="btn btn-primary" onClick={saveCfg}><Save size={15} /> Yadda saxla</button>
          </div>
        </div>

        <div className="card card-pad">
          <div className="card-title row mb-16"><PartyPopper size={17} /> Bayram günləri — holidayapi.com</div>
          <p className="small muted" style={{ marginTop: 0 }}>
            Azərbaycanın rəsmi bayram günləri <b>holidayapi.com/v1/holidays</b> (country=AZ) xidmətindən yüklənir və tabeldə, məzuniyyət hesablamasında, əmək haqqı normasında istifadə olunur.
          </p>
          {cfg.mode === 'live' ? (
            <div className="banner info">Canlı rejimdə bayramlar backend proksi vasitəsilə alınır: <code>GET {'{API}'}/holidays?country=AZ&amp;year=YYYY</code>. API açarı serverdə saxlanılmalıdır.</div>
          ) : (
            <Field label="Holiday API açarı" hint="holidayapi.com hesabınızdan. Açar yalnız bu brauzerdə saxlanılır.">
              <div className="row">
                <div className="input-icon" style={{ flex: 1 }}><KeyRound size={15} /><input className="input" type={showKey ? 'text' : 'password'} value={hKey} onChange={(e) => setHKey(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" /></div>
                <button className="icon-btn" onClick={() => setShowKey(!showKey)} aria-label="Göstər">{showKey ? <EyeOff size={16} /> : <Eye size={16} />}</button>
              </div>
            </Field>
          )}
          {hResult && <div className={cx('banner mt-16', hResult.ok ? 'ok' : 'err')}>{hResult.text}</div>}
          <div className="row mt-16 wrap">
            <button className="btn btn-primary" onClick={testHoliday} disabled={hTesting}><Save size={15} /> {hTesting ? 'Yüklənir…' : 'Saxla və bayramları yüklə'}</button>
            <button className="btn" onClick={() => { clearHolidayCache(); qc.invalidateQueries({ queryKey: ['holidays'] }); toast.info('Bayram keşi təmizləndi'); }}>Keşi təmizlə</button>
          </div>
          <p className="small muted mt-16" style={{ marginBottom: 0 }}>Açar olmadıqda və ya xidmət əlçatan olmadıqda Əmək Məcəlləsinin 105-ci maddəsinə əsaslanan daxili siyahı istifadə olunur.</p>
        </div>

        <GoogleCalendarSettings />

        <div className="card card-pad">
          <div className="card-title row mb-16"><RotateCcw size={17} /> Demo məlumatlar</div>
          <p className="small muted" style={{ marginTop: 0 }}>Demo API-dakı bütün dəyişiklikləri silib ilkin nümunə məlumatlarını bərpa edin.</p>
          <button className="btn btn-danger" disabled={cfg.mode !== 'mock'} onClick={async () => {
            if (await confirm({ title: 'Demo məlumatları sıfırlamaq?', text: 'Əlavə etdiyiniz işçilər, sorğular və əmrlər silinəcək.', confirm: 'Sıfırla', danger: true })) { resetMockDb(); qc.invalidateQueries(); toast.success('Demo məlumatlar bərpa edildi'); }
          }}><RotateCcw size={15} /> Sıfırla</button>
        </div>

        <div className="card" style={{ gridColumn: '1/-1' }}>
          <div className="card-head"><div><div className="card-title">REST API müqaviləsi</div><div className="card-sub">Backend komandası bu endpoint-ləri eyni formatda (JSON) realizə etməlidir</div></div></div>
          <div className="table-wrap mt-8">
            <table className="table">
              <thead><tr><th>Metod</th><th>Endpoint</th><th>Təsvir</th></tr></thead>
              <tbody>
                {[...mockRoutes, { method: 'GET', pattern: '/holidays', doc: 'Bayram günləri — holidayapi.com proksisi (?country=AZ&year=)' }].map((r) => (
                  <tr key={r.method + r.pattern}>
                    <td><span className={cx('badge plain', r.method === 'GET' ? 'b-info' : r.method === 'DELETE' ? 'b-danger' : r.method === 'POST' ? 'b-success' : 'b-warning')} style={{ fontFamily: 'monospace' }}>{r.method}</span></td>
                    <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{r.pattern}</td>
                    <td className="small muted">{r.doc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
