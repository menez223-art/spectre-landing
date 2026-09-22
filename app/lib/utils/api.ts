// وظائف API response الموحدة

import { HTTP_STATUS } from "./constants";

// إعادة تصدير HTTP_STATUS للاستخدام في API routes
export { HTTP_STATUS };

/**
 * نوع الاستجابة القياسي
 */
export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * إنشاء استجابة نجاح
 */
export function successResponse<T>(data: T, status: number = HTTP_STATUS.OK): Response {
  return Response.json({ ok: true, data }, { status });
}

/**
 * إنشاء استجابة خطأ
 */
export function errorResponse(error: string, status: number = HTTP_STATUS.BAD_REQUEST): Response {
  return Response.json({ ok: false, error }, { status });
}

/**
 * إنشاء استجابة غير مصرّح
 */
export function unauthorizedResponse(message: string = "غير مصرّح"): Response {
  return errorResponse(message, HTTP_STATUS.UNAUTHORIZED);
}

/**
 * إنشاء استجابة ممنوع
 */
export function forbiddenResponse(message: string = "ممنوع"): Response {
  return errorResponse(message, HTTP_STATUS.FORBIDDEN);
}

/**
 * إنشاء استجابة غير موجود
 */
export function notFoundResponse(message: string = "غير موجود"): Response {
  return errorResponse(message, HTTP_STATUS.NOT_FOUND);
}

/**
 * إنشاء استجابة خطأ خادم
 */
export function serverErrorResponse(message: string = "خطأ في الخادم"): Response {
  return errorResponse(message, HTTP_STATUS.SERVER_ERROR);
}

/**
 * استخراج بصمة الجهاز من طلب API
 */
export function extractFingerprint(request: Request): string | null {
  const url = new URL(request.url);
  const fingerprint = url.searchParams.get("fingerprint");
  return fingerprint?.trim() || null;
}

/**
 * استخراج JSON body من طلب API بأمان
 */
export async function extractJsonBody<T = Record<string, unknown>>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

/**
 * التحقق من وجود حقول مطلوبة في الجسم
 */
export function validateRequiredFields<T extends Record<string, unknown>>(
  body: T | null,
  fields: (keyof T)[]
): body is T {
  if (!body) return false;
  return fields.every((field) => body[field] !== undefined && body[field] !== null);
}

/**
 * إنشاء استجابة إعادة توجيه
 */
export function redirectResponse(url: string, status: number = HTTP_STATUS.REDIRECT): Response {
  return Response.redirect(url, status);
}
