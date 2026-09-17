// تطبيع + تجزئة SHA-256 وفق مواصفات Meta Advanced Matching / CAPI.
// النتيجة: lowercase hex، 64 حرفاً، بلا 0x أو padding.
// يجب أن يطابق الإخراج في كل من العميل والخادم كي يُلصَق Meta الحدث نفسه.

// security.client.ts بالتحديد (لا security.ts) كي لا يُجَرّ polyfill لـ node:crypto
// إلى حزمة العميل (325KB) — see security.ts header note.
import { sha256Hex } from "./security.client";

/** تجزئة بريد وفق Meta: trim + lowercase + SHA-256. ترجع سلسلة فارغة لو فارغ. */
export async function hashEmail(raw: string): Promise<string> {
  const v = (raw ?? "").trim().toLowerCase();
  if (!v) return "";
  return sha256Hex(v);
}

/**
 * تطبيع هاتف جزائري إلى صيغة E.164 (أرقام فقط، برمز الدولة، بلا «+»).
 * مطلوب من Meta لحقل ph في Advanced Matching/CAPI — وإلا انخفضت جودة
 * المطابقة إلى الصفر لأن Meta يقارن بالصيغة الدولية المخزّنة عنده.
 *   "0551234567"      → "213551234567"  (صيغة وطنية: استبدال الصفر)
 *   "+213 551 23 45"  → "2135512345"
 *   "00213555111111"  → "213555111111"  (بادئة دولية مزدوجة)
 *   "213555111111"    → "213555111111"  (سليم لا يُلامَس)
 */
export function normalizePhoneE164(raw: string): string {
  let d = String(raw ?? "").replace(/[^\d]/g, "");
  if (!d) return "";
  if (d.startsWith("00")) d = d.slice(2); // بادئة دولية صريحة
  if (d.startsWith("213")) return d; // رمز الجزائر موجوداً
  if (d.startsWith("0")) d = "213" + d.slice(1); // صيغة وطنية 0XXXXXXXXX
  return d;
}

/** تجزئة هاتف وفق Meta: تطبيع E.164 + SHA-256. ترجع سلسلة فارغة لو فارغ. */
export async function hashPhone(raw: string): Promise<string> {
  const digits = normalizePhoneE164(raw);
  if (!digits) return "";
  return sha256Hex(digits);
}

/** تجزئة اسم أول وفق Meta: trim + lowercase + SHA-256. */
export async function hashFirstName(raw: string): Promise<string> {
  const v = (raw ?? "").trim().toLowerCase();
  if (!v) return "";
  return sha256Hex(v);
}

/** تجزئة اسم أخير وفق Meta: trim + lowercase + SHA-256. */
export async function hashLastName(raw: string): Promise<string> {
  const v = (raw ?? "").trim().toLowerCase();
  if (!v) return "";
  return sha256Hex(v);
}

/** تقسيم اسم عربي/أجنبي إلى أول+باقي (Meta تتوقع first/last منفصلين). */
export function splitFullName(full: string): { first: string; last: string } {
  const v = (full ?? "").trim().replace(/\s+/g, " ");
  if (!v) return { first: "", last: "" };
  const parts = v.split(" ");
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

/** تجزئة البصمة لاستخدامها كـ external_id. البصمة نفسها 64-char hex؛
 *  نُجزّها مرة ثانية بدون pepper لتجنّب تسريب DEVICE_PEPPER لـ Meta. */
export async function hashExternalId(fingerprint: string): Promise<string> {
  if (!fingerprint) return "";
  return sha256Hex(fingerprint);
}

/** تطبيع اسم مدينة لإرسال Meta ct. Meta تتوقع lowercase ascii قدر الإمكان. */
function normLocation(raw: string): string {
  return (raw ?? "").trim().toLowerCase();
}

/** بناء كائن user_data الجاهز للإرسال لـ Meta (يُرجع فقط الحقول غير الفارغة).
 *  حقول Meta المدعومة:
 *  - em (hashed) - البريد الإلكتروني
 *  - ph (hashed) - الهاتف
 *  - fn (hashed) - الاسم الأول
 *  - ln (hashed) - اسم العائلة
 *  - external_id (hashed) - معرّف ثابت للجهاز/الزبون
 *  - ct (raw) - المدينة/البلدية
 *  - st (raw) - الولاية/المحافظة (كود أو اسم)
 *  - zp (raw) - الرمز البريدي
 *  - country (raw) - رمز الدولة ISO 3166-1 alpha-2 (DZ للجزائر)
 */
export async function buildMetaUserData(input: {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  fingerprint?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (input.email) out.em = await hashEmail(input.email);
  if (input.phone) out.ph = await hashPhone(input.phone);
  if (input.firstName) out.fn = await hashFirstName(input.firstName);
  if (input.lastName) out.ln = await hashLastName(input.lastName);
  if (input.fingerprint) out.external_id = await hashExternalId(input.fingerprint);
  const city = normLocation(input.city ?? "");
  const state = normLocation(input.state ?? "");
  const zip = (input.zip ?? "").trim();
  const country = (input.country ?? "").trim().toLowerCase();
  if (city) out.ct = city;
  if (state) out.st = state;
  if (zip) out.zp = zip;
  if (country) out.country = country;
  return out;
}