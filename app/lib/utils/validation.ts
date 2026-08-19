// وظائف التحقق والتنظيف الموحدة

import { PATTERNS } from "./constants";

/**
 * التحقق من صحة عنوان البريد الإلكتروني
 */
export function isValidEmail(email: string): boolean {
  return PATTERNS.EMAIL.test(email.trim());
}

/**
 * التحقق من صحة رابط webhook لـ Google Apps Script
 */
export function isValidWebhook(url: string): boolean {
  return PATTERNS.WEBHOOK.test(url.trim());
}

/**
 * التحقق من صحة رمز التفعيل (6 أرقام)
 */
export function isValidCode(code: string): boolean {
  return /^\d{6}$/.test(code.trim());
}

/**
 * تنظيف وتوحيد عنوان البريد الإلكتروني
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * التحقق من أن القيمة رقم صحيح موجب
 */
export function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/**
 * التحقق من أن القيمة رقم صحيح غير سالب
 */
export function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/**
 * التحقق من أن القيمة سلسلة نصية غير فارغة
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * التحقق من أن القيمة تاريخ ISO صالح
 */
export function isValidISODate(value: string): boolean {
  if (!value) return false;
  const timestamp = Date.parse(value);
  return !isNaN(timestamp);
}

/**
 * التحقق من انتهاء صلاحية التاريخ (moved to date.ts to avoid duplication)
 */
