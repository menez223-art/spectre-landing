# PORT-BRIEF — نقل الهوية البصرية إلى مكوّنات Next.js الحقيقية

مهمة: إعادة تنسيق مكوّنات React/Next قائمة إلى هوية Neumorphism المعتمدة، **دون أي تغيير في المنطق**.
الهوية معتمدة من المالك (9/10). العينات المرجعية في `design-samples/*.html` ونظام الأصناف في `app/neu.css`.

## القاعدة الذهبية: تنسيق فقط — لا منطق
المسموح تغييره حصراً:
1. سلاسل `className` (استبدال أصناف Tailwind/التدرّجات/الزجاج بأصناف `.neu-*`).
2. استبدال الإيموجي الزخرفي بأيقونات Font Awesome solid: `<i className="fa-solid fa-xxx" aria-hidden="true" />`.
3. إضافة غلاف `neu-app` على جذر الصفحة/المكوّن الرئيسي إن لزم.
4. إزالة أصناف التدرّج/الزجاج/النبض: `bg-gradient-*`, `liquid-glass*`, `animate-pulse`, `backdrop-blur*`, `shadow-lg shadow-*`, `ring-*` الزخرفية → استبدالها بأسطح neu.

**ممنوع منعاً باتاً تغيير:** أي منطق JS/TS، handlers، state، hooks، شرطيات، حلقات، حسابات، استدعاءات API، مفاتيح i18n (`t("...")`)، بنية المكوّنات/العناصر، خصائص accessibility، التجاوب (sm/md/lg)، اتجاه RTL، أو أي سلوك. لا حذف/إضافة عناصر وظيفية. لا تغيير النصوص إلا إزالة إيموجي زخرفي.
- خانة السلاغ الجديدة في `studio/page.tsx` (slugDraft / slugFieldLabel) **أُضيفت حديثاً — حافظ عليها كما هي**.
- لا تمسّ `authStore` / `isDeviceBanned` / منطق الحظر/الحصص/الملكية إطلاقاً.
- صفحات الهبوط (`app/p/`, `generateHtml.ts`, `ProductLanding`, `StoreLanding`) **خارج النطاق تماماً**.

## نظام الأصناف (app/neu.css — اقرأه كاملاً قبل البدء)
> ⚠️ الأسماء أدناه تقريبية. المرجع الملزم = `app/neu.css` + مهارة `neu-styling-port` (حمّلها أولاً). الأسماء الحقيقية BEM: `neu-btn--danger/--muted/--success/--warning/--lg/--block`، `t-muted/t-primary/t-success/t-warning/t-danger`، `neu-badge--*`، `neu-circle--*`. **لا يوجد** `neu-field/neu-label/neu-muted/neu-btn-primary/neu-btn-ghost` — استعمل `t-muted` للنص الثانوي و`grid gap-2` لغلاف الحقل و`neu-sub` للتلميح.
- حاوية: `.neu-app` (تضع الخلفية/الخط/اللون). ضعها على جذر الصفحة.
- أسطح: `.neu-card` (بارز), `.neu-inset` (غائر), `.neu-flat`.
- أزرار: `.neu-btn` (أساسي), `.neu-btn-primary`, `.neu-btn-ghost`, `.neu-btn-danger`, `.neu-circle` (دائري 45px).
- حقول: `.neu-field`, `.neu-label`, `.neu-input`, `.neu-textarea`, `.neu-select`.
- نصوص: `.neu-muted`, `.neu-title`, `.neu-eyebrow`.
- تبويبات: `.neu-tab` (+ `.is-active`), `.neu-tabs`.
- شارات: `.neu-badge`, `.neu-badge-success`, `.neu-badge-warn`, `.neu-badge-danger`.
- جداول/قوائم: `.neu-row`, `.neu-divider`.
- الوضع الليلي تلقائي عبر `.dark` على `<html>` (لا تضف data-theme).
- الألوان: primary `#2b6cb0` (ليلي `#4da3ff`)، نجاح أخضر، تحذير برتقالي، خطر أحمر — استخدم أصناف neu لا ألوان Tailwind عشوائية.
- الخطوط: Cairo/NeuPoppins محمّلة محلياً. الأيقونات FA 6 solid محمّلة محلياً (لا CDN، لا إيموجي).

## خريطة تحويل تقريبية
- `rounded-2xl/3xl border ... bg-white/bg-ivory-50 dark:bg-[#161b22] shadow` → `.neu-card`
- `bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-full` (زر أساسي) → `.neu-btn .neu-btn-primary`
- `border border-red-500/40 text-red-600 rounded-full` (زر خطر) → `.neu-btn .neu-btn-danger`
- `bg-navy-900 text-ivory-50 rounded-full` → `.neu-btn .neu-btn-primary`
- حقول `border ... rounded-xl px-3 py-2 bg-white` → `.neu-input`
- `animate-pulse` هياكل تحميل → `.neu-inset` ثابت (بلا نبض — جهاز ضعيف)
- إيموجي: ♻→fa-rotate, ✏️→fa-pen, 🌍→fa-globe, 🗑→fa-trash, ✓→fa-check, ⚠→fa-triangle-exclamation, ✕→fa-xmark, 💰→fa-sack-dollar, 📄→fa-file-lines, 🎨→fa-palette, 📋→fa-clipboard-list, 📊→fa-chart-simple, 🎁→fa-gift.

## التحقق الإلزامي قبل التسليم (شغّلها وأبلغ بالنتيجة)
```
cd "C:/Users/C-Ron/OneDrive/Bureau/nv3 buff"
node node_modules/typescript/bin/tsc --noEmit --incremental false   # يجب TSC=0
CODEBUDDY_SAFE_DELETE_ENABLED=0 node node_modules/next/dist/bin/next lint  # يجب 0 أخطاء
```
- لا تشغّل `next build` (مكلف — المنسّق يشغّله). لا تشغّل خادماً. لا commit. لا نشر.
- تأكد أن كل `t("key")` مستخدم موجود في i18n (لا مفاتيح جديدة إلا المضافة من المنسّق).
- أبلغ: الملفات المعدّلة، عدد تغييرات className، أي إيموجي استُبدل، نتيجة tsc/lint، وأي قرار اضطراري.

## أسلوب العمل
- اقرأ المكوّن كاملاً أولاً، افهم بنيته، ثم طبّق تغييرات className عبر patch تدريجي.
- حافظ على كل handler/state/شرط كما هو حرفياً.
- إذا شككت أن تغييراً يمس المنطق — لا تفعله؛ أبلغ المنسّق.
- الجهاز ضعيف: لا عمليات ثقيلة، لا بناء متكرر.
