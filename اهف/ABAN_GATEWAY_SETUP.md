# SideWalk + Aban Gateway

## مشکل پیدا شده در نسخه قبلی

1. توکن آبان داخل `backend/.env` به‌صورت یک خط خام قرار گرفته بود و با نام `ABAN_API_TOKEN` تعریف نشده بود؛ بنابراین Node آن را به‌عنوان متغیر محیطی نمی‌خواند.
2. آدرس API روی `https://abangateway.ir/api/v1` هاردکد شده بود. نسخه اصلاح‌شده از آدرس API رسمی `https://api.abangateway.ir/api/v1` استفاده می‌کند و امکان override با `ABAN_API_BASE` دارد.
3. migration قبلی برخلاف توضیحات، ستون‌های پرداخت را به جدول `orders` اضافه نمی‌کرد.
4. callback قبلی GET بود، درحالی‌که آبان برای رویداد پرداخت یک webhook امضاشده POST ارسال می‌کند. نسخه جدید امضای HMAC را بررسی می‌کند و سپس verify سمت سرور انجام می‌دهد.

## 1) Supabase

فایل زیر را یک بار در SQL Editor اجرا کنید:

`backend/database/migration_aban_gateway.sql`

این migration قابل اجرای مجدد است و ستون‌ها/ایندکس‌های لازم را فقط در صورت نبودن اضافه می‌کند.

## 2) Render Environment Variables

در سرویس backend این متغیرها را بسازید:

- `ABAN_API_BASE` = `https://api.abangateway.ir/api/v1`
- `ABAN_API_TOKEN` = توکن جدید آبان شما
- `ABAN_WEBHOOK_SECRET` = Webhook Secret از پنل آبان
- `ABAN_CALLBACK_URL` = `https://sidewalk-menu-backend.onrender.com/api/orders/payment/webhook`
- `BACKEND_PUBLIC_URL` = `https://sidewalk-menu-backend.onrender.com`

توکن واقعی را داخل ZIP، Git یا فایل فرانت‌اند قرار ندهید.

## 3) Deploy

بعد از افزودن Environment Variables، backend را Redeploy/Restart کنید.

## 4) جریان پرداخت نسخه اصلاح‌شده

1. مشتری سفارش را ثبت می‌کند.
2. backend قیمت واقعی کالاها را از Supabase محاسبه می‌کند.
3. مبلغ تومان به ریال تبدیل و فاکتور آبان ساخته می‌شود.
4. `invoice_id` و `payment_url` در سفارش ذخیره می‌شوند.
5. فرانت‌اند مشتری را به `payment_url` می‌فرستد.
6. آبان بعد از تشخیص پرداخت، webhook امضاشده را به `/api/orders/payment/webhook` می‌فرستد.
7. backend امضای HMAC را بررسی می‌کند.
8. backend با API آبان `verify` انجام می‌دهد و مبلغ، `order_id` و `invoice_id` را با سفارش تطبیق می‌دهد.
9. فقط بعد از تأیید معتبر، `payment_status = paid` می‌شود.

## نکات عیب‌یابی

- اگر API خطای `insufficient_fee_wallet` داد، کیف پول کارمزد آبان باید شارژ شود.
- `no_card_registered` یعنی کارت فعال در حساب آبان وجود ندارد.
- `unsafe_callback_url` یعنی callback ثبت‌شده مورد قبول آبان نیست.
- `capacity_full` یعنی ظرفیت فاکتورهای همزمان کارت پر شده است.
- `already_verified` در نسخه جدید خطای شکست محسوب نمی‌شود؛ وضعیت فاکتور دوباره استعلام می‌شود و فقط اگر واقعاً `paid` باشد سفارش تأیید می‌شود.
