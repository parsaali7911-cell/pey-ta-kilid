# گزارش کامل پروژه پی‌تا‌کلید (Peytakilid)

تاریخ به‌روزرسانی: ۱۴۰۴/۰۶/۲۶ (۱۶ سپتامبر ۲۰۲۶)  
ریپازیتوری: [parsaali7911-cell/pey-ta-kilid](https://github.com/parsaali7911-cell/pey-ta-kilid)

---

## ۱) خلاصهٔ محصول

**پی‌تا‌کلید** مارکت‌پلیس B2B مصالح و خدمات ساختمانی است که از یک جستجوی آزاد (متن / عکس / صدا) مسیر خرید کالا، فروش/عرضه، پیدا کردن متخصص، ثبت متخصص و طراحی در فضا را باز می‌کند.

- زبان‌های UI: **فارسی (پیش‌فرض RTL)** · انگلیسی · عربی  
- معماری: Monorepo — `apps/api` (NestJS) + `apps/web` (Next.js 15) + `packages/shared-types` + `packages/config`  
- دیتابیس: PostgreSQL + Prisma (۴۴ مدل، ۱۶ migration) · Redis برای کش/جلسه  
- احراز هویت: JWT + Refresh Token

---

## ۲) آنچه ساخته شده — بر اساس دامنه

### ۲.۱ احراز هویت و سازمان‌ها
- ثبت‌نام / ورود / تازه‌سازی توکن / خروج / `me`
- نقش پلتفرم: `SUPER_ADMIN` · `ADMIN` · `SUPPORT` · `FINANCE` · `USER`
- نقش سازمان: Owner / Admin / Staff / Viewer
- قابلیت سازمان: `canSell` · `canBuy` · `isProfessional` + تخصص اصلی
- صفحات: `/login` · `/register?intent=seller|professional|buyer`

### ۲.۲ کاتالوگ و Listing
- درخت Category با UoM پیش‌فرض هر برگ + Attributeهای وابسته
- Product / Variant / Listing / Media / AttributeValue
- جریان وضعیت: Draft → Pending Review → Approved → Published
- ویزارد ۶مرحله‌ای فروشنده + ویرایش Listing + آپلود رسانه
- صفحات: `/catalog` · `/catalog/[slug]`

### ۲.۳ جستجو و Intent
- Intent قاعده‌محور (بدون اجبار به LLM): خرید / فروش / متخصص / طراحی
- جستجوی متنی روی کاتالوگ منتشرشده + فیلتر مکان/بودجه/ویژگی
- جستجوی تصویری و صوتی (وقتی `AI_PROVIDER=openai`)
- لکسیکون ایران: ۳۱ استان · ~۳۸۷ شهر · ۳۳ دسته · ۵۹ تخصص
- صفحه: `/search` + نوار جستجو در هدر

### ۲.۴ قیمت، انبار، RFQ، پیشنهاد، سفارش، پرداخت
- قیمت Listing با حاشیه/FX (بدون افشای supplierCost به عموم)
- موجودی: ورود/خروج/رزرو/آزادسازی + دفتر کل
- RFQ خریدار → Quote فروشنده → Order
- پرداخت دستی حواله بانکی + تأیید ادمین (بدون درگاه آنلاین هنوز)
- پنل خریدار: تب‌های RFQ / Quote / Order

### ۲.۵ متخصصان (آخرین ویژگی بزرگ)
- دایرکتوری با فیلتر شهر/تخصص/فاصله و مرتب‌سازی با رتبه
- ثبت‌نام سریع: نام + تخصص + شهر + موبایل + کد ملی
- تأیید هویت: OTP موبایل · کد ملی (checksum + SHA-256، فقط ۴ رقم آخر عمومی) · عکس پروفایل
- **رتبه پروفایل ۰–۱۰۰** (موبایل ۲۰، کد ملی ۱۵، عکس ۱۵ + تکمیل بیو/سابقه/قیمت/نمونه کار…)
- `identityVerified` وقتی هر سه مورد هویت کامل باشد
- نمونه کار (portfolio) · نظرات مشتری (مهمان: در انتظار تأیید · کاربر لاگین: تأیید خودکار)
- صفحات: `/professionals` · `/professionals/[slug]`
- لید مشتری + claim/close در پنل فروشنده/متخصص

### ۲.۶ طراح فضا (Designer)
- آپلود عکس فضا + انتخاب Listing واقعی از کاتالوگ
- تولید تصویر با OpenAI Image وقتی AI فعال باشد
- صفحه: `/designer`

### ۲.۷ SEO چندزبانه
- تولید خودکار عنوان/توضیح Listing و پروفایل متخصص (بدون LLM)
- Sitemap / robots / hreflang برای fa|en|ar
- JSON-LD محصول بدون نشت دادهٔ خصوصی

### ۲.۸ پنل‌ها
| پنل | مسیر | امکانات اصلی |
|---|---|---|
| ادمین | `/admin` | صف Listing، تأیید پرداخت، لید متخصص، وضعیت AI، taxonomy |
| فروشنده | `/seller` | سازمان، انبار/موقعیت، Listing، تجارت، تب متخصص |
| خریدار | `/buyer` | RFQ، Quote، Order، پرداخت |

### ۲.۹ خانه / مارکت‌پلیس
- هیرو با جستجوی آزاد + مسیرهای ورود (کاتالوگ / نیاز / متخصص / فروشنده)
- کارت Listing با قیمت عمومی و لینک «در فضای من»
- تم بصری طلایی/تیل، فونت فارسی Estedad/Vazirmatn

### ۲.۱۰ موبایل (به‌روز)
- Viewport استاندارد + safe-area برای گوشی‌های notch
- منوی همبرگری + جستجوی موبایل در هدر
- گریدها و فرم‌های پنل تک‌ستونه زیر ۷۲۰px
- تب‌های پنل با اسکرول افقی لمسی
- هدف لمسی حداقل ۴۴px · فونت ۱۶px در input برای جلوگیری از زوم iOS
- فایل سراسری: `apps/web/app/styles/peytakilid-mobile.css`

---

## ۳) پشتهٔ فنی

| لایه | تکنولوژی |
|---|---|
| API | NestJS 11 · Prisma 6 · PostgreSQL · Redis · Passport JWT · Multer |
| Web | Next.js 15 · React 19 · TypeScript · App Router |
| Shared | shared-types · config (Zod) |
| Infra | Docker Compose (Postgres 16 + Redis 7) · Node ≥ 20 |
| AI اختیاری | OpenAI (vision / image / voice / translation) |
| ERP | Outbox آماده‌؛ ERPNext هنوز کلاینت ندارد (`none` \| `memory`) |

---

## ۴) آمار تقریبی

| مورد | مقدار |
|---|---|
| مدل‌های Prisma | ۴۴ |
| Migrationها | ۱۶ |
| Controllerهای Nest | ~۲۲ |
| صفحات locale وب | ۱۳ مسیر اصلی |
| تخصص‌های ساختمانی | ۵۹ |
| دسته‌های مصالح (lexicon) | ۳۳ |

---

## ۵) اکانت‌های دمو (seed)

- ادمین: `admin@peytakilid.local` / `ChangeMeAdmin123!`
- فروشنده: `seller@peytakilid.local` / `ChangeMeSeller123!`
- خریدار: `buyer@peytakilid.local` / `ChangeMeBuyer123!`

---

## ۶) عمداً باقی‌مانده / بعدی

1. **درگاه پرداخت واقعی** (الان فقط حواله + تأیید ادمین)
2. **کلاینت ERPNext** برای حسابداری (بعد از استقرار سرور — طبق تصمیم قبلی)
3. **SMS تولیدی OTP** (الان در محیط غیرپروداکشن `devCode` برمی‌گردد)
4. پنل اختصاصی نقش‌های `SUPPORT` / `FINANCE`
5. بهبود بیشتر PWA / نصب روی موبایل (اختیاری)

---

## ۷) مسیرهای مهم API (گروهی)

- `/api/auth/*` · `/api/organizations*`
- `/api/catalog/listings*` · `/api/seller/listings*` · `/api/admin/listings*`
- `/api/intent/nl` · `/api/search` · `/api/search/visual` · `/api/search/voice`
- `/api/professionals/*` · `/api/seller/professional-profile*`
- `/api/designer/*` · `/api/seo/*`
- `/api/buyer/rfqs*` · `/api/seller/quotes*` · `/api/buyer|seller/orders*` · `/api/admin/payments*`

---

## ۸) اجرا محلی

```bash
docker compose up -d
npm install
npm run db:migrate:deploy -w @peytakilid/api
npm run db:seed -w @peytakilid/api
npm run dev:api   # :4000
npm run dev:web   # :3000
```

سایت: `http://localhost:3000/fa`
