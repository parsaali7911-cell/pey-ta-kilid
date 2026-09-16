# پی‌تا‌کلید (Peytakilid)

مارکت‌پلیس مستقل مصالح و خدمات ساختمانی — **کاملاً جدا از هر پروژهٔ دیگر**.

این مخزن فقط Peytakilid است: API + وب + لکسیکون ایران + مسیر Intent سرچ اول.

## Stack

| مسیر | نقش |
|---|---|
| `apps/api` | NestJS + Prisma + PostgreSQL |
| `apps/web` | Next.js (fa / en / ar) |
| `packages/shared-types` | تایپ‌ها، Intent، لکسیکون شهر/صنف |
| `packages/config` | اعتبارسنجی env |

## قابلیت‌های فعلی (نشست اخیر)

- سرچ زبان طبیعی صفحهٔ اول → خرید / فروش / متخصص / عکس+متن
- لکسیکون **۳۱ استان** + **~۳۸۷ شهر** ایران با مختصات
- **۵۰+ تخصص** و **۳۰+ دسته** مصالح
- ذخیرهٔ لوکیشن + lat/lng برای فروشنده و متخصص (Facility + ServiceArea)
- Directory با فیلتر شهر/تخصص و فاصلهٔ کیلومتری
- ویزارد ثبت کالای فروشنده، RFQ/Quote/Order، رسانهٔ Listing

## اجرا

```bash
cp .env.example .env
docker compose up -d postgres redis
npm install
npm run build -w @peytakilid/shared-types
npm run db:generate
npm run db:migrate:deploy
npm run db:seed
npm run dev:api
npm run dev:web
```

Demo:

- `seller@peytakilid.local` / `ChangeMeSeller123!`
- `buyer@peytakilid.local` / `ChangeMeBuyer123!`
- `admin@peytakilid.local` / `ChangeMeAdmin123!`

## بازیابی از بکاپ

اگر محیط محدود شد، همین مخزن GitHub یا فایل bundle را کلون/استخراج کنید — وابستگی به پروژهٔ دیگری ندارد.
