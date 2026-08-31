// وظائف التاريخ والوقت الموحدة

import { TIME_CONSTANTS } from "./constants";

/**
 * الحصول على التاريخ الحالي بصيغة ISO
 */
export function nowISO(): string {
  return new Date().toISOString();
}

/**
 * الحصول على timestamp الحالي بالميليثانية
 */
export function nowTimestamp(): number {
  return Date.now();
}

/**
 * إضافة أيام إلى تاريخ
 */
export function addDays(date: Date | string, days: number): Date {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Date(d.getTime() + days * TIME_CONSTANTS.DAY_MS);
}

/**
 * إضافة ميليثانية إلى تاريخ
 */
export function addMilliseconds(date: Date | string, ms: number): Date {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Date(d.getTime() + ms);
}

/**
 * حساب المدة المتبقية بالأيام (تقريب لأعلى)
 */
export function remainingDays(expiryDate: string | null): number | null {
  if (!expiryDate) return null;
  const diff = new Date(expiryDate).getTime() - Date.now();
  if (diff <= 0) return 0;
  return Math.ceil(diff / TIME_CONSTANTS.DAY_MS);
}

/**
 * التحقق من انتهاء صلاحية التاريخ
 */
export function isExpired(expiryDate: string | null): boolean {
  if (!expiryDate) return false;
  return new Date(expiryDate).getTime() < Date.now();
}

/**
 * إنشاء تاريخ انتهاء بعد مدة محددة
 */
export function createExpiryDate(ttlMs: number = TIME_CONSTANTS.CODE_TTL_MS): string {
  return new Date(Date.now() + ttlMs).toISOString();
}

/**
 * تنسيق التاريخ للعرض (نسبي أو مطلق)
 */
export function formatDate(date: string | Date, locale: string = "ar"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * حساب الفرق بين تاريخين بالأيام
 */
export function daysBetween(date1: string | Date, date2: string | Date): number {
  const d1 = typeof date1 === "string" ? new Date(date1) : date1;
  const d2 = typeof date2 === "string" ? new Date(date2) : date2;
  const diff = Math.abs(d2.getTime() - d1.getTime());
  return Math.floor(diff / TIME_CONSTANTS.DAY_MS);
}
