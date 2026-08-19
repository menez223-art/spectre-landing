// وظائف التشفير والأمان الموحدة

import { createHash } from "crypto";

/**
 * حساب SHA-256 لسلسلة نصية
 */
export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * إنشاء رمز تفعيل عشوائي من 6 أرقام
 */
export function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * تعديل البصمة بـ pepper خادمي (server-only)
 */
export function pepperFingerprint(fp: string): string {
  const pepper = process.env.DEVICE_PEPPER || "";
  if (!pepper) {
    console.warn("[security] DEVICE_PEPPER غير معرّف — التخزين أضعف");
  }
  return createHash("sha256").update(fp + "|" + pepper).digest("hex");
}

/**
 * إنشاء هوية جهاز من البصمة (للاستخدام كمالك عند غياب البريد)
 */
export function getDeviceOwner(rawFp: string): string {
  return "device:" + pepperFingerprint(rawFp).slice(0, 24);
}

/**
 * تهريب النصوص قبل وضعها في HTML
 */
export function escapeHtml(value: unknown): string {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * تهريب نص ليُكتب داخل سلسلة JS (يمنع كسر <script>)
 */
export function escapeJsString(value: unknown): string {
  return JSON.stringify(value == null ? "" : String(value)).replace(/</g, "\\u003c");
}
