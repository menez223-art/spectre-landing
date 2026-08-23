# Spectre Landing Studio

منصّة لإنشاء **صفحات هبوط (Landing Pages) لمنتجات** مع استوديو متكامل
للنشر، ونظام اشتراكات وحظر صارم، ومتجر للطلبات. مبنية بـ Next.js 14
(App Router) + Supabase (Postgres)، وتُنشَر مجاناً على Vercel.

---

## ✨ أبرز المزايا

- **استوديو نشر ذاتي**: يولّد صفحة هبوط لكل منتج برابط عام `/p/<slug>`.
- **نظام اشتراكات كامل**: حالات `active | suspended | banned` + خطط + صلاحية مؤقّتة.
- **حظر صارم (fail-closed)**: عند حظر مستخدم، تُمنع صفحاته وروابطه عن أي زائر
  فوراً، ويُطرد من الاستوديو، ويُمنع من النشر ومن تسجيل الدخول.
- **متجر طلبات**: نموذج طلب سريع + ربط بـ Google Sheets (عبر Apps Script).
- **تعدد اللغات + ثيم فاتح/داكن**، وألوان ديناميكية مستخرجة من صورة المنتج.

---

## 🧱 البنية التقنية

| الطبقة | التقنية |
|--------|---------|
| الإطار | Next.js 14 (App Router) + React 18 + TypeScript |
| التخزين | Supabase Postgres — جدول `kv` واحد (مفتاح/قيمة) |
| الاستضافة | Vercel (Hobby — مجاني) |
| المصادقة | بصمة جهاز + ربط بريد + جلسة أدمن موقّعة (HMAC) |
| الصور | روابط URL خارجية (لا تُرفع ملفات — توفير تخزين) |

> **لماذا جدول KV واحد؟** بديل مجاني ومستقر عن Vercel Blob: لا فواتير
> ولا تعليق تلقائي. كل صفحة = صفّان: `published/<slug>.json` + `published-meta/<slug>.json`.

---

## 📁 المسارات الرئيسية

| المسار | الوظيفة |
|--------|---------|
| `/` | الصفحة الرئيسية (عرض المنتجات + نموذج الطلب) |
| `/studio` | استوديو النشر (يتطلب دخولاً معتمداً) |
| `/p/<slug>` | صفحة هبوط المنتج العامة |
| `/admin` | لوحة المشرف (اشتراكات/حظر) — محمية بجلسة |
| `POST /api/admin/login` | دخول الأدمن (بريد + كلمة مرور) |
| `POST /api/admin/subscription` | تحكّم بالاشتراكات والحظر |
| `GET /api/auth/account` | حالة الجهاز (يُرجع `blocked` عند الحظر) |
| `GET /api/auth/can-produce` | هل يُسمح للجهاز بالنشر؟ |
| `POST /api/publish` | نشر/تحديث منتج |

---

## 🚀 النشر (Vercel — مجاني)

1. **استنساخ المشروع**:
   ```bash
   git clone https://github.com/menez223-art/spectre-landing.git
   cd spectre-landing
   npm install
   ```

2. **إنشاء مشروع Supabase** (مجاني):
   - New project → انسخ `Project URL` و `service_role` key.
   - افتح **SQL Editor** وشغّل محتوى `supabase/0001_kv.sql` لإنشاء جدول `kv`.

3. **ضبط متغيرات البيئة** (Vercel → Project → Settings → Environment):
   ```
   SUPABASE_URL=https://xxxx.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJ...
   ADMIN_EMAIL=admin@example.com
   ADMIN_PASSWORD=كلمة-قوية
   ADMIN_SESSION_SECRET=سلسلة-عشوائية-32-حرف-فأكثر
   DEVICE_PEPPER=سلسلة-عشوائية-لتوقيع-الأجهزة
   ```

4. **النشر**:
   ```bash
   npx vercel --prod
   ```
   أو اربط المستودع بـ Vercel للنشر التلقائي عند كل `git push`.

---

## 🔑 ربط الأدمن الجديد (نقل الملكية)

الأدمن مُعرَّف **فقط** عبر متغيرات البيئة — لا حاجة لتعديل الكود:
1. غيّر `ADMIN_EMAIL` و `ADMIN_PASSWORD` إلى بريد/كلمة الأدمن الجديد.
2. ولّد `ADMIN_SESSION_SECRET` و `DEVICE_PEPPER` جديدين (عشوائيين).
3. أعد النشر (`npx vercel --prod`).
4. ادخل `/admin` بالبريد والكلمة الجديدين → تملك لوحة التحكم فوراً.

> 🔒 **أمان عند البيع**: قبل تسليم المشروع، غيّر `ADMIN_PASSWORD` و
> `DEVICE_PEPPER` و `ADMIN_SESSION_SECRET` القديمة كي لا يبقى لك وصول.

---

## 🚫 نظام الحظر (مُختبَر بالكامل)

عند ضغط المشرف «حظر» لمستخدم:
- يُمنع **النشر** (`can-produce` يرجع `allowed:false, reason:banned`).
- تُحرق كل **صفحاته وروابطه** (`/p/<slug>` تعرض «محظور»).
- يُطرد من **الاستوديو** فوراً (`account` يرجع `blocked:true` → `AuthGate` يوجّهه للرئيسية).
- يُمنع **الدخول** (`login` يرجع `403 + error:banned`).
- يعمل الحظر حتى لجهاز **بلا إيميل** (هويته `device:<hash>`).

الاختبار الشامل موجود في `scripts/ban-real-flow.mjs` و `scripts/ban-e2e.mjs`:
```bash
node scripts/ban-real-flow.mjs   # 12/12 ✓
node scripts/ban-e2e.mjs         # 18/18 ✓
```

---

## 📊 سقوف الخطط المجانية

| الخدمة | المجاني | ملاحظة |
|--------|---------|--------|
| **Vercel** | 100GB/شهر باندويدث · 1M استدعاء · مشاريع غير محدودة | كافٍ ل~1M زيارة/شهر |
| **Supabase** | 500MB DB · 5GB/شهر egress · 2 مشروع · 50k Auth MAU | ~300k+ صفحة مخزّنة |
| **Google Drive** | 15GB | غير مستخدم لتخزين المشروع |

> المشروع بعيد جداً عن أي سقف — قابل للتوسّع الكبير مجانياً.

---

## 🔧 متطلبات التطوير

- Node.js 18+ (مُختبر على 24)
- npm
- حساب Supabase مجاني

```bash
npm run dev      # تطوير محلي على http://localhost:3000
npm run build    # بناء الإنتاج
npm run start    # تشغيل بناء الإنتاج
```

---

## 📄 الترخيص

ملكية صاحب المشروع. انظر ملف `vip` (داخلي) لدليل البيع والتسليم.
