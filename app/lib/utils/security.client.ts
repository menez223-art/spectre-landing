// جزء العميل من وظائف الأمان — يجب أن يبقى خالياً من أي استيراد Node.js
// (crypto/node) وإلا تُجَرّ polyfill بحجم 325KB إلى صفحات الهبوط.
// الدوال هنا تستخدم Web Crypto المتوفرة في المتصفح والخادم على حدٍ سواء.

/**
 * حساب SHA-256 لسلسلة نصية (Web Crypto — يعمل في العميل والخادم)
 */
export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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
