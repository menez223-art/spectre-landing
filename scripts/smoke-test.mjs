// تست شامل لخصائص Spectre بعد التعديلات (أ/ب/ج)
// يفحص: الصفحة الرئيسية، صفحة هبوط منشورة، بوابات الأدمن،
// مسار رصد الروابط (403 بدون صلاحية)، سلامة NODE_ENV.
// لا يتطلب قاعدة بيانات حية — يكتفي بفحص استجابات HTTP وحماية المسارات.

const BASE = process.env.BASE || "http://localhost:3000";
const results = [];
function rec(name, pass, detail = "") {
  results.push({ name, pass, detail });
  console.log(`${pass ? "✅" : "❌"} ${name}${detail ? " — " + detail : ""}`);
}

async function get(path) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    const res = await fetch(BASE + path, { method: "GET", redirect: "manual", signal: ctrl.signal, cache: "no-store" });
    clearTimeout(t);
    const text = await res.text().catch(() => "");
    return { status: res.status, text };
  } catch (e) {
    return { status: 0, text: String(e) };
  }
}

async function post(path, body) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    const res = await fetch(BASE + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
      redirect: "manual",
      signal: ctrl.signal,
    });
    clearTimeout(t);
    return { status: res.status, json: await res.json().catch(() => ({})) };
  } catch (e) {
    return { status: 0, json: {} };
  }
}

async function run() {
  // 1) الصفحة الرئيسية
  const home = await get("/");
  rec("الصفحة الرئيسية تستجيب 200", home.status === 200, `status=${home.status}`);

  // 2) صفحة هبوط منشورة (slug افتراضي إن وُجد) — نتأكد أنها لا تُعطي 500
  const p = await get("/p/test");
  rec("مسار /p/[slug] لا ينهار (200/404/301 مقبول)", [200, 301, 302, 404].includes(p.status) || p.status === 200, `status=${p.status}`);

  // 3) حماية مسار رصد الروابط بدون صلاحية = 403
  const lh = await post("/api/admin/link-health", { action: "run" });
  rec("مسار رصد الروابط محمي (403 بدون صلاحية)", lh.status === 403, `status=${lh.status}`);

  // 4) حماية مسار الاشتراكات بدون صلاحية = 403
  const sub = await post("/api/admin/subscription", { action: "validity", userId: "x@y.z", validityUnit: "day", validityDays: 30 });
  rec("مسار الاشتراكات محمي (403 بدون صلاحية)", sub.status === 403, `status=${sub.status}`);

  // 5) مسار fallback الإداري محمي = 403
  const fb = await post("/api/admin/fallback", { action: "enable" });
  rec("مسار الاحتياط محمي (403 بدون صلاحية)", fb.status === 403, `status=${fb.status}`);

  // 6) مسار حساب عام بدون بصمة لا ينهار
  const acct = await get("/api/auth/account");
  rec("مسار الحساب العام لا ينهار", acct.status === 200 || acct.status === 400, `status=${acct.status}`);

  // 7) لوحة الأدمن تُحمّل (نقطة الدخول) — 307 = إعادة توجيه لتسجيل الدخول (محمية ✅)
  const admin = await get("/admin");
  rec("صفحة /admin تستجيب (200 أو 307 حماية)", [200, 301, 302, 307].includes(admin.status), `status=${admin.status}`);

  // 8) مسار النشر لا يقبل طلباً فارغاً بـ 500
  const pub = await post("/api/publish", {});
  rec("مسار النشر لا ينهار بطلب فارغ", pub.status !== 500, `status=${pub.status}`);

  const passed = results.filter((r) => r.pass).length;
  console.log(`\n=== النتيجة: ${passed}/${results.length} نجح ===`);
  if (passed < results.length) process.exit(1);
}

run().catch((e) => {
  console.error("تعذّر تشغيل التست:", e);
  process.exit(2);
});
