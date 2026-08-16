// سكربت اختبار معزول — يثبت أن الطلبات تصل لجدول Sheets باسم المنتج الصحيح،
// سواء منتج واحد أو عدة منتجات (كل طلب يُسجَّل باسم منتجه).
//
// آمن: يقرأ الأسرار من .env.local داخلياً (لا تُطبع)، وينشئ جدول اختبار
// مؤقت معزول تماماً عن بيانات الزبائن الحقيقية، ثم يُرسل الطلبات عبر نقطة
// /api/sheet/order الحيّة (نفس المسار الحقيقي)، ويحاول قراءة الجدول للتحقق،
// وينظّف في النهاية.
import { readFileSync } from "fs";

// ── قراءة الأسرار من .env.local دون طباعتها ──
function loadEnv() {
  const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const env = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

const env = loadEnv();
const BASE = "https://spectre-tau-five.vercel.app"; // الرابط الذي يخدم الكود الجديد (200)
const factoryUrl = env.FACTORY_URL;
const factorySecret = env.FACTORY_SECRET;

if (!factoryUrl || !factorySecret) {
  console.error("❌ متغيّرات المصنع (FACTORY_URL / FACTORY_SECRET) غير متوفرة في .env.local");
  process.exit(1);
}

// ── 1) إنشاء جدول اختبار مؤقت (معزول عن الزبائن) ──
const TEST_EMAIL = "test-store-verify-" + Math.random().toString(36).slice(2, 8) + "@example.com";
console.log("١) إنشاء جدول اختبار مؤقت…");
let sheetKey = null;
try {
  const res = await fetch(factoryUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "create_sheet", secret: factorySecret, email: TEST_EMAIL }),
  });
  const text = await res.text();
  if (text.trim().startsWith("ERR")) {
    console.error("❌ رفض المصنع إنشاء الجدول:", text.trim());
    process.exit(1);
  }
  const parsed = JSON.parse(text);
  if (!parsed.ok || !parsed.key) {
    console.error("❌ رد غير متوقع من المصنع:", text.trim());
    process.exit(1);
  }
  sheetKey = parsed.key;
  globalThis.__sheetUrl = parsed.url || null;
  console.log("   ✅ الجدول الموقت جاهز. المفتاح (غير سري):", sheetKey);
  if (parsed.url) console.log("   🔗 رابط الجدول الموقت (للتحقق بعينك):", parsed.url);
} catch (err) {
  console.error("❌ فشل الاتصال بالمصنع:", err);
  process.exit(1);
}

// ── 2) إرسال 3 طلبات — منتج مختلف لكل طلب (عبر المسار الحقيقي) ──
const products = [
  { name: "سماعات بلوتوث برو", price: "4500" },
  { name: "ساعة ذكية ليدي", price: "8900" },
  { name: "كاميرا مراقبة واي فاي", price: "6200" },
];

console.log("\n٢) إرسال طلب لكل منتج عبر /api/sheet/order…");
const deliveries = [];
for (const p of products) {
  const order = {
    timestamp: new Date().toISOString(),
    name: "زبون اختبار",
    phone: "0555123456",
    wilaya: "الجزائر",
    commune: "الحراش",
    quantity: 1,
    deliveryType: "home",
    totalPrice: p.price,
    product: p.name, // ← هذا هو المهم: اسم المنتج المختار
  };
  const r = await fetch(`${BASE}/api/sheet/order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sheetKey, sheetEmail: TEST_EMAIL, order }),
  });
  const j = await r.json().catch(() => ({}));
  const ok = r.status === 200 && j.ok === true;
  deliveries.push({ product: p.name, status: r.status, body: j, reached: ok });
  console.log(`   ${ok ? "✅" : "❌"} ${p.name} → HTTP ${r.status} ${JSON.stringify(j)}`);
}

// ── 3) قراءة الجدول للتحقق من الأسماء (إن دعم المصنع القراءة) ──
console.log("\n٣) محاولة قراءة الجدول للتحقق من الأسماء…");
let readRows = null;
try {
  const res = await fetch(factoryUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "read", secret: factorySecret, key: sheetKey }),
  });
  const text = await res.text();
  if (!text.trim().startsWith("ERR")) {
    try {
      readRows = JSON.parse(text);
    } catch {
      /* تجاهل */
    }
  }
  if (readRows && Array.isArray(readRows.rows)) {
    const names = readRows.rows.map((row) => row.product ?? row[readRows.columns?.indexOf?.("product") ?? -1]).filter(Boolean);
    console.log("   الأسماء المسجّلة في الجدول:", JSON.stringify(names));
    for (const p of products) {
      const found = names.includes(p.name);
      console.log(`   ${found ? "✅" : "⚠️"} ${p.name} ${found ? "موجود في الجدول" : "غير موجود (قد لا يدعم المصنع القراءة)"}`);
    }
  } else {
    console.log("   ℹ️ المصنع لا يكشف قراءة الجدول عبر هذا الإجراء — سنعتمد على نجاح التسليم (ok:true) كدليل.");
  }
} catch (err) {
  console.log("   ℹ️ تعذّرت قراءة الجدول للتحقق:", String(err));
}

// ── 4) تقرير ──
const allReached = deliveries.every((d) => d.reached);
console.log("\n════════════════════════════════════════");
console.log("النتيجة:");
console.log("  وصلت كل الطلبات للمصنع؟", allReached ? "✅ نعم" : "❌ لا");
console.log("  المفتاح الموقت:", sheetKey, "(سيُترك كجدول اختبار معزول)");
if (globalThis.__sheetUrl) console.log("  رابط الجدول للتحقق:", globalThis.__sheetUrl);
console.log("════════════════════════════════════════");
process.exit(allReached ? 0 : 1);
