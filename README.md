# Gənc Tamaşaçılar Teatrı — HR Portal

React 18 + TypeScript + Vite + TanStack Query ilə yazılmış HR portalının frontend hissəsi.

## İşə salmaq

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # dist/ qovluğuna production build
```

## Modullar

| Bölmə | İmkanlar |
|---|---|
| İdarə paneli | KPI-lar, məzuniyyətləri birbaşa təsdiq/rədd, ad günləri, bitən müqavilələr, yaxınlaşan bayramlar, son fəaliyyətlər |
| İşçilər | Axtarış (ə/e, ş/s fərqi nəzərə alınmır), filtr, sıralama, cədvəl/kart görünüşü, CSV, profil (məzuniyyət qalığı, davamiyyət, əmrlər, qiymətləndirmə), işdən azad etmə |
| Struktur | Bölmələr, rəhbərlər, heyət |
| Davamiyyət | Gündəlik qeyd (bir kliklə), aylıq tabel, CSV; bazar ertəsi (teatrın istirahət günü) və bayramlar avtomatik |
| Məzuniyyətlər | Sorğular, təsdiq prosesi, təqvim, illik qalıqlar; bayram günləri müddətə daxil edilmir, eyni bölmədə üst-üstə düşmə xəbərdarlığı |
| Bayram təqvimi | holidayapi.com-dan AZ bayramları, köçürülmüş günlər, aylıq iş günü norması, illik təqvim |
| İşə qəbul | Vakansiyalar, sürüklə-burax kanban (müraciət → müsahibə → **dinləmə** → təklif → qəbul), namizəddən birbaşa işçi kartı |
| Təlim və qiymətləndirmə | Təlimlər, iştirakçılar, mövsümi performans qiymətləndirməsi |
| Əmək haqqı | Aylıq cədvəl, tutulmalar, təsdiq → ödəniş axını, hesablaşma vərəqəsi (çap) |
| Əmrlər | Şablondan avtomatik mətn (işə qəbul, azad, məzuniyyət, …), imzalama, çap |
| Hesabatlar | Yaş, staj, gender, axıcılıq, əmək haqqı fondu |

Qısayollar: `Ctrl+K` və ya `/` — qlobal axtarış və tez əməliyyatlar.

## API inteqrasiyası

Bütün sorğular [src/api/client.ts](src/api/client.ts) üzərindən keçir. İki rejim var (Ayarlar → API):

- **Demo API** — [src/api/mock/server.ts](src/api/mock/server.ts) real REST backend-i təqlid edir, məlumatlar brauzerin `localStorage`-ında saxlanılır.
- **Canlı API** — `VITE_API_URL` və ya Ayarlarda göstərilən ünvana `fetch` ilə sorğu göndərilir (`Authorization: Bearer <token>`).

Backend realizə etməli olduğu endpoint-lərin tam siyahısı portalın **Ayarlar** səhifəsində görünür. Xətalar `{ "message": "..." }` formatında qaytarılmalıdır.

### Bayram günləri — holidayapi.com

[src/api/holidays.ts](src/api/holidays.ts):

- Demo rejimində: `GET https://holidayapi.com/v1/holidays?key=…&country=AZ&year=YYYY&public=true` (açar Ayarlarda və ya `VITE_HOLIDAY_API_KEY`).
- Canlı rejimdə: `GET {API}/holidays?country=AZ&year=YYYY` — backend holidayapi.com-a proksi etməlidir ki, açar brauzerə çıxmasın.
- Cavab 7 gün keşlənir, ingiliscə adlar azərbaycancaya tərcümə olunur, `observed` (köçürülmüş gün) nəzərə alınır.
- Açar olmadıqda və ya xəta baş verdikdə (401/402/429, şəbəkə, CORS) Əmək Məcəlləsinin 105-ci maddəsinə əsaslanan daxili siyahı istifadə olunur. Ramazan və Qurban bayramlarının tarixləri bu siyahıda təxminidir.

### Təqvim — Google Calendar API (pulsuz, standart kvota)

[src/api/google/](src/api/google/) və [src/api/calendarStore.ts](src/api/calendarStore.ts):

- Tamaşa, məşq, iş növbəsi hadisələri **Google Calendar API v3**-də saxlanılır; təsdiqlənmiş məzuniyyətlər bir kliklə sinxronlaşdırılır.
- Giriş Google Identity Services (OAuth token) ilə tam brauzerdə olur — server, API açarı və client secret lazım deyil.
- İcazələr: `calendar.app.created` (tətbiqin yaratdığı “GTT — Teatr təqvimi”) və `calendar.events` (mövcud təqvimdən istifadə üçün).
- Kvotaya qənaət: yalnız görünən tarix aralığı sorğulanır, `fields` ilə cavab kiçildilir, keşləmə, 403 rateLimit / 429 / 5xx üçün eksponensial təkrar.
- Google qoşulmayana qədər təqvim lokal rejimdə işləyir. `.ics` ixracı Outlook/Apple Calendar üçün.

Pulsuz Client ID: Google Cloud Console → yeni layihə → Google Calendar API-nı aktiv et → OAuth consent screen (External, Testing, test istifadəçiləri) → Credentials → OAuth client ID (Web application) → *Authorized JavaScript origins*: `http://localhost:5173` və istehsal domeni. Client ID-ni portalda **Ayarlar → Google Calendar** və ya `VITE_GOOGLE_CLIENT_ID` ilə daxil edin.
