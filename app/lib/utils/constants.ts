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
  WARN_BYTES: 90 * 1024 * 1024 * 1024, // حد الإنذار: 90GB
  MAX_BYTES: 100 * 1024 * 1024 * 1024, // الحد الأقصى: 100GB
} as const;

export const RESOURCE_LIMITS = {
  MAX_LANDING_PRODUCTS: 5, // حد المنتجات لكل صفحة
  MAX_LANDING_IMAGES: 5, // حد الصور لكل صفحة
  MAX_AUTH_TRIES: 5, // حد محاولات التحقق
} as const;

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
  SITE_HOME: process.env.NEXT_PUBLIC_SITE_URL || "https://spectre-tau-five.vercel.app/",
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
