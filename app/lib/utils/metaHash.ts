// تطبيع + تجزئة SHA-256 وفق مواصفات Meta Advanced Matching / CAPI.
// النتيجة: lowercase hex، 64 حرفاً، بلا 0x أو padding.
// يجب أن يطابق الإخراج في كل من العميل والخادم كي يُلصَق Meta الحدث نفسه.

import { sha256Hex } from "./security";

/** تجزئة بريد وفق Meta: trim + lowercase + SHA-256. ترجع سلسلة فارغة لو فارغ. */
export async function hashEmail(raw: string): Promise<string> {
  const v = (raw ?? "").trim().toLowerCase();
  if (!v) return "";
  return sha256Hex(v);
}

/** تجزئة هاتف وفق Meta: إزالة كل ما عدا الأرقام + SHA-256. */
export async function hashPhone(raw: string): Promise<string> {
  const digits = (raw ?? "").replace(/[^0-9]/g, "");
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

/** بناء كائن user_data الجاهز للإرسال لـ Meta (يُرجع فقط الحقول غير الفارغة). */
export async function buildMetaUserData(input: {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  fingerprint?: string;
}): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (input.email) out.em = await hashEmail(input.email);
  if (input.phone) out.ph = await hashPhone(input.phone);
  if (input.firstName) out.fn = await hashFirstName(input.firstName);
  if (input.lastName) out.ln = await hashLastName(input.lastName);
  if (input.fingerprint) out.external_id = await hashExternalId(input.fingerprint);
  return out;
}