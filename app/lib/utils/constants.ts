// ثوابت التطبيق الموحدة — مركزية وقابلة للتهيئة

// ── المدد والمهلات الزمنية ──
export const TIME_CONSTANTS = {
  CODE_TTL_MS: 15 * 60 * 1000, // صلاحية رموز التفعيل: 15 دقيقة
  DAY_MS: 24 * 60 * 60 * 1000, // يوم واحد بالميليثانية
  SESSION_MAX_AGE: 60 * 60 * 24 * 365, // صلاحية الجلسة: سنة
  FALLBACK_EXPIRY_DAYS: 7, // مدة صلاحية صفحة الاحتياط: أسبوع
} as const;

// ── حدود السعة والحصص ──
export const BANDWIDTH_LIMITS = {
  WARN_BYTES: 90 * 1024 * 1024 * 1024, // حد الإنذار التراكمي: 90GB (نقل CDN فيرصل Hobby=100GB)
  MAX_BYTES: 100 * 1024 * 1024 * 1024, // الحد الأقصى: 100GB
  // إنذار شهري استباقي: 3GB. السقف الحاكم فعلياً على الخطط المجانية هو خروج
  // Supabase الشهري (~5GB) لا نقل فيرصل — التبديل الاستباقي لوضع الاحتياط
  // (GitHub Pages) عند 3GB يُبقي تجربة الزوار سلسة قبل ملامسة الجدار.
  MONTHLY_WARN_BYTES: 3 * 1024 * 1024 * 1024,
} as const;

export const RESOURCE_LIMITS = {
  MAX_LANDING_PRODUCTS: 10, // حد المنتجات لكل صفحة (سقف نظامي — الحصة الفعلية بالخطة)
  MAX_LANDING_IMAGES: 10, // حد الصور لكل صفحة (سقف نظامي — الحصة الفعلية بالخطة)
  MAX_AUTH_TRIES: 5, // حد محاولات التحقق
} as const;

// حدّ حجم ملف المصدر للصورة حسب الخطة (بايت، قبل الضغط) — يُطبَّق عميلياً في
// الاستوديو قبل استدعاء الضغط. الضغط التلقائي يبقى بعده فيظل المخزَّن صغيراً؛
// الحماية النهائية لحجم الجسم المرفوع هي MAX_BODY_BYTES في مسار النشر.
export const IMAGE_MAX_BYTES_BY_PLAN: Record<string, number> = {
  basic: 2_000_000, // ~2MB
  pro: 4_000_000, // ~4MB
  gold: 10_000_000, // ~10MB
};
export const IMAGE_MAX_BYTES_DEFAULT = 2_000_000; // سقوط آمن لأي خطة مجهولة

// ── بادئات التخزين في KV ──
export const KV_PREFIXES = {
  PUBLISHED: "published/",
  PUBLISHED_META: "published-meta/",
  SUBSCRIPTIONS: "subs/",
  DEVICES: "studio-auth/devices/",
  PROFILES: "studio-auth/profiles/",
  PENDING_CODES: "studio-auth/pending/",
  LINK_PENDING: "studio-auth/link-pending/",
  MANUAL_PENDING: "studio-auth/manual-pending/",
  STATS: "stats/",
} as const;

// ── مفاتيح تخزين محددة ──
export const KV_KEYS = {
  ACCOUNT: "studio-auth/account.json",
  BANDWIDTH: "stats/bandwidth",
  FALLBACK_WARNING: "fallback_warning",
  FALLBACK_MODE: "fallback_mode",
} as const;

// ── مفاتيح التخزين المحلي ──
export const STORAGE_KEYS = {
  SESSION: "landing-studio-session",
  SESSION_COOKIE: "landing-studio-session",
  LEGACY_SHEET_URL: "landing-studio-sheet-url",
  LEGACY_USERS: "landing-studio-users",
} as const;

// ── الروابط والعناوين ──
export const URLS = {
  SITE_HOME: process.env.NEXT_PUBLIC_SITE_URL || "https://spectre-dz.vercel.app/",
  FACEBOOK_PRICING: "https://www.facebook.com/share/1Ep7pL32L4/",
} as const;

// ── التعابير النمطية للتحقق ──
export const PATTERNS = {
  WEBHOOK: /^https:\/\/script\.google\.com\/macros\/s\/AKfycb[A-Za-z0-9_-]+\/exec$/,
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
} as const;

// ── رموز HTTP الشائعة ──
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  REDIRECT: 307,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  SERVER_ERROR: 500,
} as const;


// حدود النشر والاشتراك (منع التشتت)
export const RESOURCE_LIMITS_ADDITIONAL = {
  MAX_PUBLISH_BODY_BYTES: 3_800_000, // حد جسم النشر (Vercel 4.5MB)
  MAX_QUANTITY_PER_ORDER: 10, // حد الكمية الواحدة في الطلب
  SUBSCRIPTION_POLL_INTERVAL_MS: 15_000, // استطلاع حالة الاشتراك (15 ثانية)
  GH_PAGES_POLL_MAX: 20, // محاولات استطلاع GitHub Pages
  GH_PAGES_POLL_INTERVAL_MS: 2_000, // فترة الاستطلاع (2 ثانية)
  DEFAULT_VALIDITY_DAYS: 30, // صلاحية افتراضية للاشتراك
  DEVICE_HASH_PREFIX_LENGTH: 24, // طول الجزء المستخدم لتعريف الجهاز
};

// ── تحويل العملات ──
// Meta CAPI و Meta Pixel يقبلان USD فقط (DZD غير مدعومة). نحول من DZD إلى USD
// بسعر تقريبي ثابت. كان مُعرَّفاً محلياً في route.ts ثم نُقل هنا ليُستخدم من
// OrderForm.tsx أيضاً.
const DZD_PER_USD = 135; // سعر تقريبي: 1 USD ≈ 135 DZD
export function dzdToUsd(dzd: number): number {
  if (!Number.isFinite(dzd) || dzd <= 0) return 0;
  return Number((dzd / DZD_PER_USD).toFixed(2));
}
