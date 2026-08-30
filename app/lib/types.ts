// الأنواع الأساسية لصفحات الهبوط — تُدار كل صفحة من بيانات Product واحد

export interface Feature {
  title: string;
  copy: string;
}

export interface Testimonial {
  quote: string;
  name: string;
  city: string;
}

export interface Stat {
  value: string;
  label: string;
}

// قسم إضافي اختياري (مثال: قسم "Open Stereo" في صفحة Bestrio)
export interface ExtraSection {
  id: string;
  eyebrow: string;
  heading: string;
  copy: string[];
  chips?: string[];
  image?: string;
  imageCaption?: string;
}

// أسعار التوصيل الخاصة بالمنتج — تُلغِي القيم الافتراضية عند وجودها
export interface DeliveryPrices {
  home: number; // التوصيل للمنزل
  office: number; // الاستلام من المكتب
}

// أنماط التوصيل المتاحة للمنشئ
// - fixed: سعر توصيل واحد عام (المنزل/المكتب) يُطبَّق على كل الولايات
// - wilaya: سعر توصيل مخصّص لكل ولاية على حدة
export type DeliveryMode = "fixed" | "wilaya";

// أسعار التوصيل لولاية واحدة — منزل ومكتب
export interface WilayaPrice {
  home: number; // التوصيل للمنزل
  office: number; // الاستلام من المكتب
}

// خريطة أسعار التوصيل حسب الولاية — المفتاح هو رقم الولاية (code)
// تُستخدم عندما يكون وضع التوصيل "wilaya". القيمة إما زوج {home,office}
// أو رقم مفرد (legacy) يُفسَّر كسعر للمنزل مع إسقاط المكتب للافتراضي.
export type WilayaPrices = Record<number, WilayaPrice | number>;

// خيار لون متاح للمنتج — يختاره الزبون للعرض فقط (لا يُرسل للجدول)
export interface ProductColor {
  name: string; // اسم اللون (يظهر للزبون)
  hex: string; // كود اللون (للعرض فقط)
}

// الحدود القصوى لكل صفحة هبوط (متجر) — سقف نظامي أعلى يتّسع لخطة Gold.
// - حتى 10 منتجات في الصفحة الواحدة.
// - حتى 10 صور إجمالاً تُوزَّع بحرية على منتجات الصفحة (صورة رئيسية لكل منتج
//   + صور إضافية)؛ المجموع لا يتجاوز 10 صور للصفحة ككل.
// ملاحظة: هذا سقف نظامي فقط — الحصة الفعلية لكل مستخدم تبقى محكومة بخطته
// (sub.maxProducts/maxImages)، فرفع السقف لا يمنح basic أكثر من حصّته.
export const MAX_LANDING_PRODUCTS = 10;
export const MAX_LANDING_IMAGES = 10;

// يعدّ كل صور الصفحة (صورة رئيسية + إضافية) عبر منتجاتها — للتحقق من الحد.
export function countPageImages(products: Product[]): number {
  return products.reduce((total, p) => {
    const n = (p.image ? 1 : 0) + (p.images?.filter(Boolean).length ?? 0);
    return total + n;
  }, 0);
}

// لوحة ألوان المنتج — تُشتق تلقائياً من الصورة أو تُحدَّد يدوياً
export interface Theme {
  mode: "dark" | "light";
  primary: string; // اللون الأساسي (أزرار، توهجات)
  accent: string; // لون التمييز (عناوين فرعية، hover)
  bg: string; // خلفية الصفحة
  surface: string; // خلفية البطاقات والنماذج
  text: string; // النص الرئيسي
  muted: string; // النص الثانوي
  // اختيارات — تُشتق تلقائياً عند الغياب
  primaryStrong?: string;
  primarySoft?: string;
  primaryText?: string;
  bgAlt?: string; // خلفية قسم الطلب
  bandBg?: string; // خلفية قسم المميزات (يمكن أن يخالف bg)
  bandText?: string;
  bandMuted?: string;
  promoBg?: string; // خلفية شريط العروض — يمكن أن يكون CSS gradient كاملاً
  promoText?: string;
  glow?: string;
  inputBg?: string;
  inputBorder?: string;
  placeholder?: string;
  surface2?: string;
  featuresLayout?: "grid" | "list"; // list = جدول مواصفات (Bestrio)
}

export interface Product {
  id: string; // slug فريد
  name: string;
  nameEn?: string;
  brand?: string; // اسم الشعار في الترويسة
  price: number;
  oldPrice?: number;
  image: string; // "/products/x.jpg" أو data:URL
  images?: string[]; // صور إضافية للمعرض
  description?: string;
  tagline?: string; // العنوان الرئيسي الكبير
  eyebrow?: string; // شارة صغيرة فوق العنوان
  badge?: string;
  features?: Feature[];
  testimonials?: Testimonial[];
  stats?: Stat[];
  tags?: string[];
  extras?: ExtraSection;
  theme: Theme;
  sheetWebhook?: string; // رابط Apps Script (مخبأ/قديم) — يُستخدم كاحتياط إن تعذّر الحل الديناميكي
  sheetEmail?: string; // بريد مالك الجدول — هوية ثابتة يُحلّ عبرها الرابط ديناميكياً
  sheetKey?: string; // مفتاح الجدول الفريد — هوية ثابتة تبقى صالحة عبر إعادة النشر
  delivery?: DeliveryPrices; // أسعار توصيل مخصصة لهذا المنتج — تُغلب الافتراضية
  deliveryMode?: DeliveryMode; // وضع التوصيل: ثابت (fixed) أو حسب الولاية (wilaya)
  wilayaPrices?: WilayaPrices; // أسعار التوصيل المخصّصة (للمنزل + للمكتب) لكل ولاية — تُستخدم عند deliveryMode="wilaya"
  colors?: ProductColor[]; // خيارات الألوان المتاحة — يختارها الزبون للعرض فقط (لا تُرسل للجدول)
  pixelId?: string; // Meta Pixel لصاحب المتجر — يُحقن سكريبته في صفحة /p/<slug> إن وُجد
  whatsapp?: string; // رقم واتساب صاحب المتجر (دولي بلا +) — يبني زر إرسال الطلب بعد نجاح النموذج
  ownerDisplayName?: string; // الاسم الودّي للمتجر — يظهر في بطاقة المتجر العام فقط إذا أذن صاحبه
  category?: string | null; // تصنيف المتجر (إلكترونيات/ملابس/إكسسوارات/...) — يُستخدم لتجميع البطاقات في المتجر العام

  // ── وضع المتجر (منتجات متعددة في صفحة واحدة) ──
  // عند وجوده: هذه الصفحة = متجر يحوي حتى MAX_LANDING_PRODUCTS منتجاً،
  // والزبون يختار منتجاً فيظهر سعره ديناميكياً. الصور تُوزَّع بين المنتجات
  // بشرط ألا يتجاوز مجموعها MAX_LANDING_IMAGES للصفحة كلها.
  // التوافق العكسي: غياب هذا الحقل = صفحة منتج واحد (السلوك القديم).
  products?: Product[];
}

export interface PaletteResult {
  theme: Theme;
  swatches: string[];
  suggestedMode: "dark" | "light";
}
