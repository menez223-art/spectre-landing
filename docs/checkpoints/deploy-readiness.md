# دراسة الإنتاج + جاهزية النسخة الجديدة للنشر (قراءة فقط — لا نشر)

التاريخ: 2026-11-20 · الحالة: ✅ الدراسة تمت · النسخة جاهزة · **بانتظار قرار المالك للنشر**

## 1) خريطة الإنتاج (كما طُلب: Vercel أساسي + GitHub احتياط + Supabase تخزين)
- **Vercel (الأساسي):** المشروع `spectre` (`prj_soKB8oGco759lmmcgIgrrfWSGb9o`، فريق `team_2j1ggW9PO6c18z6RafaMiOVy`)، إطار Next.js، Node 24.x. الحي `https://spectre-dz.vercel.app/` = **200** (Server: Vercel، HSTS، X-Vercel-Cache: STALE) ويخدم **النسخة القديمة قبل إعادة الهوية**. `/pricing` و`/p/<slug>` = 200. cron يومي `03:00` على `/api/admin/link-health?action=auto` (vercel.json).
- **Supabase (التخزين):** المشروع `vvvwnsaddkhdnrgbwdda` (eu-west-1، Postgres 17.6، ACTIVE_HEALTHY). جدول `public.kv` (RLS مفعّل، PK=key، value jsonb، updated_at) = **84 صفاً**: ratelimit 40 · studio-auth 20 (أجهزة) · stats 8 · published 5 · published-meta 5 · subs 3 · site-copy 1 · test 1 · zz-debug-xfer 1. **5 صفحات منشورة** (host=vercel، listed=true، بلا حظر/إخفاء/تجربة): 33e6f5b7dc، 901e82e2aa، 9e74f6fb44، ab9f5f417b، f5a8d43739. **3 اشتراكات gold/active**. دالة `bump_kv_num` (RPC العدّادات الذرّية، migration 0003) **موجودة** ✓.
- **GitHub (الاحتياط):** `githubPages.ts` يرفع HTML مستقل عبر Contents API إلى `GITHUB_REPO` تحت `p/<slug>.html` ويُفعّل عند علم `fallback_mode` (اقتراب السعة). الريبو origin = `menez223-art/spectre-landing`. حالياً كل الصفحات host=vercel (الاحتياط غير نشط).
- **مسار الطلبات:** `/api/sheet/order` → مصنع GAS (KV `sheet-factory/current-url` ← متغير `FACTORY_URL` ← `directWebhook` المضمّن المُقيَّد بنطاق Apps Script الرسمي). CAPI الخادمي حصري لمالك AMINE (بوابة بريد + `META_AMINE_PIXEL_ID`/`META_ACCESS_TOKEN`).

## 2) النسخة الجديدة = الإنتاج + إعادة الهوية (لا انحدار — مُثبَت)
- الفرع المحلي `master` قاعدته `54f3f6a`؛ `origin/main` رأسه `8097e41`. صافي فرق الشجرة base→production = **6 ملفات فقط** (أغلبها docs/بيانات وصفية)، رغم 63 التزاماً (ضجيج تاريخ دمج/نشر/توثيق).
- **إصلاح الطلبات ثلاثي المسار** (order/route.ts + OrderForm.tsx) كان غير ملتزم محلياً («نسيه المالك») ⇒ التُزم `796e61c` وهو **مطابق حرفياً لإنتاج `8097e41`** ✓.
- **layout.tsx:** وسم viewport اليدوي مكرر محذوف محلياً كما في الإنتاج (Next يحقنه تلقائياً) ✓ — الفرق فقط استيرادا neu.css + FA (إضافة إعادة الهوية).
- **CHECKPOINT.md:** الفرق عن الإنتاج **+57 سطراً إضافة فقط، صفر حذف** ⇒ لا انحدار توثيق.
- كل ملفات app المختلفة عن الإنتاج هي **ملفات إعادة الهوية حصراً** (تعديل/إضافة). لا ملف إنتاج مفقود أو مُرتجَع.
- ⇒ **النسخة الجديدة = محتوى الإنتاج الحالي + إعادة الهوية، إضافةً محضة.**

## 3) جاهزية النشر
- **بناء نظيف:** tsc=0 · lint=0 · build=0. الخادم المحلي رملي معزول يعمل (localhost:3000).
- **توافق عكسي كامل:** صفحات الهبوط `/p/<slug>` لم تُمس (الصفحات الخمس الحية تعمل كما هي) · خانة السلاغ معامل اختياري مُضاف (لا يكسر النشر القديم) · نموذج بيانات kv unchanged.
- **لا migration جديد ولا متغير بيئة جديد مطلوب:** إعادة الهوية أصول ثابتة مضمّنة (خطوط/FA محلية) + تنسيق. متغيرات الإنتاج المطلوبة (أسماء فقط، بلا قيم): SUPABASE_URL/SERVICE_ROLE_KEY، NEXT_PUBLIC_SUPABASE_URL/ANON_KEY، GITHUB_TOKEN/REPO/BRANCH، FACTORY_URL/SECRET، META_AMINE_PIXEL_ID/META_ACCESS_TOKEN، RESEND_API_KEY، ADMIN_EMAIL/MASTER_USERNAME/CRON_SECRET/AGENT_TRIAL_KEY، NEXT_PUBLIC_SITE_URL/ADMIN_WHATSAPP. (الإنتاج حي ويعمل ⇒ موجودة).
- ملاحظة محتوى (ليست عيباً): صفحات الهبوط/التسعير ما زالت تعرض «58 ولاية» (إرثي) مقابل 69 في الرئيسية — خارج نطاق إعادة الهوية.

## 4) لوجستيات النشر + العوائق (لقرار المالك)
- **المسار:** دفع إلى `origin/main` (GitHub) ⇒ Vercel يبني تلقائياً (أو نشر يدوي). الفرع المحلي `master` مقابل البعيد `main`؛ التاريخ متباعد تاريخياً (الشجرة = الإنتاج+الهوية لكن ليس تاريخ main). **الأنظف:** rebase التزامات إعادة الهوية الأربعة فوق `origin/main` (أو دمج origin/main في master) ثم دفع fast-forward إلى main. **لم يُنفَّذ أي دمج/دفع/نشر — بانتظار الأمر.**
- **عائق وصول Vercel:** واجهة MCP تعطي 403/404 (نطاق token لا يطابق فريق spectre — نفس عائق 2026-09-08 الموثّق)، وCLI المحلي `Not authorized`. ⇒ للنشر عبري يلزم **إعادة ربط Vercel بالنطاق الصحيح** (`team_2j1ggW9PO6c18z6RafaMiOVy`)، أو ينشر المالك بنفسه (CLI/لوحة Vercel أو دفع GitHub). **لم يُسحب أي سر/قيمة env** (التزام §4).
- **Supabase MCP يعمل** (دراسة قراءة فقط تمت). **صفر كتابة على الإنتاج** (لا setKv/حذف/حظر/DDL). مفاتيح/قيم الإنتاج لم تُقرأ ولم تُطبع.

## 5) الالتزامات المحلية
f043960 (م3–5+سلاغ+إيموجي) · edfaccd (م6 الأدمن) · 16e2cb6 (م8 تنظيف+checkpoint) · 796e61c (إصلاح الطلبات المنسيّ = مطابق للإنتاج) · + هذا المستند.

## 6) الحماية (§4) محترَمة بالكامل
لا نشر · لا commit للإنتاج · لا vercel env pull/قيم · لا كتابة قاعدة الإنتاج · لا تعديل env الإنتاج. العمل محلي + دراسة قراءة فقط. **القرار للمالك.**
