"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

// سياق لغة مستقل لصفحة الهبوط — مخصص للزبون (لا يتعارض مع لغة واجهة الاستوديو).
// يحفظ الاختيار في localStorage ويعكسه على اتجاه الحاوية (dir) فقط،
// كي لا يمسّ إعداد لغة الاستوديو المخزّن في المفتاح الآخر.
const LANDING_LANG_KEY = "landing-customer-lang";

type Lang = "ar" | "en";

const LANDING_AR: Record<string, string> = {
  // ── الترويسة والتنقل ──
  noImage1: "أضف صورة المنتج",
  noImage2: "لعرضها هنا",
  navProduct: "المنتج",
  shot: "لقطة",
  navFeatures: "المميزات",
  navSpecs: "المواصفات",
  navTestimonials: "آراء الزبائن",
  navOrder: "الطلب",
  orderNow: "اطلب الآن",

  // ── الشريط العلوي ──
  promoDelivery: "التوصيل لـ 58 ولاية · الدفع عند الاستلام",

  // ── الأقسام ──
  secFeatures: "المميزات",
  secSpecs: "المواصفات",
  secTestimonials: "آراء الزبائن",
  secOrder: "اطلب بسهولة",
  secOrderSub: "املأ بياناتك وسيصل طلبك إلى باب منزلك.",
  orderCta: "اطلبه الآن",
  orderHeading: "احصل على {name} بتوصيل سريع.",
  orderSub: "اترك بياناتك وسيتصل بك فريقنا لتأكيد الطلب وعنوان التوصيل. الدفع عند الاستلام.",
  specsTitle: "تفاصيل {name}.",
  specsDefault: "كل المواصفات التقنية كما تظهر على العبوة.",
  whyTitle: "لماذا {name}؟",
  featuresTitle: "مميزات تصنع الفرق.",
  testimonialsTitle: "ماذا يقول من جرّبه؟",
  testimonialsSub: "تجارب حقيقية من زبائننا عبر الولايات.",

  // ── النموذج ──
  fullName: "الاسم الكامل",
  fullNamePh: "اكتب اسمك الكامل",
  phone: "رقم الهاتف",
  phonePh: "05 xx xx xx xx",
  wilaya: "الولاية",
  wilayaPh: "اختر ولايتك",
  commune: "البلدية",
  communePhWilaya: "اختر البلدية",
  communePhWait: "اختر الولاية أولاً",
  deliveryMethod: "طريقة الاستلام",
  deliveryMethodFor: "اختر طريقة التوصيل لـ {name}",
  qty: "الكمية",
  priceLine: "سعر {name} ({qty} × {price})",
  deliveryLine: "التوصيل",
  total: "المجموع الكلي",
  confirm: "تأكيد الطلب ←",
  success: "تم تسجيل طلبك بنجاح ✅ سنتصل بك لتأكيد الطلب.",
  orderSendWhatsapp: "أرسل طلبك عبر واتساب",
  orderWhatsappTail: "✅ أؤكد طلبي أعلاه.",
  blocked: "⚠ الطلبات موقوفة حالياً — اربط جدول Google Sheets من الإعدادات لتسجيل الطلبات.",
  consent: "بإرسال هذا النموذج، أنت توافق على التواصل معك بخصوص طلبك. بياناتك تبقى خاصة.",
  specialTag: "عرض خاص",
  deliveryPick: "اختر ولايتك من القائمة ليظهر خيارا التوصيل (للمنزل/للمكتب) وأسعارهما المخصّصة.",
  home: "التوصيل للمنزل",
  homeHint: "حتى باب منزلك",
  office: "الاستلام من المكتب",
  officeHint: "أسرع وأوفر",

  // ── CTA الثابت ──
  stickyDelivery: "التوصيل لـ 58 ولاية",

  // ── التذييل ──
  footerCustom: "صفحة مخصصة لـ {name}.",
  footerDelivery: "التوصيل لـ 58 ولاية · الدفع عند الاستلام",

  // ── الميزة الإضافية (ExtrasSection) ──
  extrasChips: "أبرز ما في العرض",
};

const LANDING_EN: Record<string, string> = {
  noImage1: "Add the product image",
  noImage2: "to display it here",
  navProduct: "Product",
  shot: "Shot",
  navFeatures: "Features",
  navSpecs: "Specs",
  navTestimonials: "Reviews",
  navOrder: "Order",
  orderNow: "Order now",

  promoDelivery: "Delivery to 58 wilayas · Cash on delivery",

  secFeatures: "Features",
  secSpecs: "Specifications",
  secTestimonials: "Customer reviews",
  secOrder: "Order easily",
  secOrderSub: "Fill in your details and your order arrives at your doorstep.",
  orderCta: "Order now",
  orderHeading: "Get {name} with fast delivery.",
  orderSub: "Leave your details and our team will call to confirm your order and delivery address. Cash on delivery.",
  specsTitle: "Details of {name}.",
  specsDefault: "All technical specs as shown on the box.",
  whyTitle: "Why {name}?",
  featuresTitle: "Features that make the difference.",
  testimonialsTitle: "What people who tried it say?",
  testimonialsSub: "Real experiences from our customers across the wilayas.",

  fullName: "Full name",
  fullNamePh: "Enter your full name",
  phone: "Phone number",
  phonePh: "05 xx xx xx xx",
  wilaya: "Wilaya",
  wilayaPh: "Choose your wilaya",
  commune: "Commune",
  communePhWilaya: "Choose commune",
  communePhWait: "Choose wilaya first",
  deliveryMethod: "Delivery method",
  deliveryMethodFor: "Choose delivery method for {name}",
  qty: "Quantity",
  priceLine: "Price of {name} ({qty} × {price})",
  deliveryLine: "Delivery",
  total: "Total",
  confirm: "Confirm order →",
  success: "Your order has been recorded ✅ We will contact you to confirm.",
  orderSendWhatsapp: "Send your order via WhatsApp",
  orderWhatsappTail: "✅ I confirm my order above.",
  blocked: "⚠ Orders are currently paused — link a Google Sheets from settings to record orders.",
  consent: "By submitting this form you agree to be contacted about your order. Your data stays private.",
  specialTag: "Special offer",
  deliveryPick: "Choose your wilaya to reveal the delivery options (home/office) and their prices.",
  home: "Home delivery",
  homeHint: "To your doorstep",
  office: "Pick up from office",
  officeHint: "Faster and cheaper",

  stickyDelivery: "Delivery to 58 wilayas",

  footerCustom: "A page made for {name}.",
  footerDelivery: "Delivery to 58 wilayas · Cash on delivery",

  extrasChips: "Highlights",
};

interface LandingLangValue {
  lang: Lang;
  dir: "rtl" | "ltr";
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const Ctx = createContext<LandingLangValue>({
  lang: "ar",
  dir: "rtl",
  setLang: () => {},
  t: (k) => k,
});

export function useLandingLang(): LandingLangValue {
  return useContext(Ctx);
}

export function LandingLangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ar");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(LANDING_LANG_KEY);
      if (saved === "en" || saved === "ar") setLangState(saved);
    } catch {
      // تجاهل
    }
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      window.localStorage.setItem(LANDING_LANG_KEY, l);
    } catch {
      // تجاهل
    }
  };

  const t = (key: string, vars?: Record<string, string | number>) => {
    const dict = lang === "en" ? LANDING_EN : LANDING_AR;
    let str = dict[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
      }
    }
    return str;
  };

  const value = useMemo<LandingLangValue>(
    () => ({ lang, dir: lang === "ar" ? "rtl" : "ltr", setLang, t }),
    [lang]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// زر تبديل اللغة — يوضع في ترويسة صفحة الهبوط
export function LangToggle() {
  const { lang, setLang } = useLandingLang();
  const next = lang === "ar" ? "en" : "ar";
  return (
    <button
      type="button"
      onClick={() => setLang(next)}
      dir="ltr"
      className="rounded-full border border-[var(--c-border-strong)] bg-[var(--c-surface)] px-3 py-1.5 text-[11px] font-bold text-[var(--c-text)] backdrop-blur transition hover:bg-[var(--c-primary)] hover:text-[var(--c-primary-text)]"
      aria-label="Toggle language"
    >
      {lang === "ar" ? "EN" : "ع"}
    </button>
  );
}
