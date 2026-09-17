// تجاوزات نصوص الواجهة — طبقة فوق قاموس `i18n.ts`.
//
// الفكرة: المالك يعدّل نصوص **الصفحة الرئيسية** من «الإعدادات المتقدمة» في لوحة
// الأدمن، فتُخزَّن هنا في القاعدة ولا تُفقد عند أي تحديث للكود. أي مفتاح **بلا
// تجاوز** يرجع تلقائياً للقاموس المدمج — فالتعديل الجزئي آمن، والحذف = استرجاع.
//
// ⚠️ هذا الملف **آمن للعميل** (لا يستورد KV ولا `fs`) — لأن مزوّد اللغة ولوحة
//    الأدمن (كلاهما عميل) يحتاجان الأنواع وقائمة المفاتيح. القراءة/الكتابة في
//    `siteCopy.ts` (خادم فقط).

import type { I18nKey } from "./i18n";

export type Lang = "ar" | "en";

// { ar: { heroTitle1: "..." }, en: { heroTitle1: "..." } }
export type SiteCopy = Record<Lang, Partial<Record<I18nKey, string>>>;

export const EMPTY_SITE_COPY: SiteCopy = { ar: {}, en: {} };

// ── النصوص القابلة للتعديل: ٣٧ نصاً في ٧ مجموعات ──
// المجموعات تجعل النافذة مفهومة بدل قائمة مسطّحة طويلة.
export interface CopyGroup {
  id: string;
  keys: I18nKey[];
}

export const SITE_COPY_GROUPS: CopyGroup[] = [
  {
    id: "header",
    keys: ["brand", "products", "studio", "adminLoginTitle"],
  },
  {
    id: "hero",
    keys: [
      "heroBadge",
      "heroTitle1",
      "heroTitle2",
      "heroSub",
      "ctaStart",
      "ctaBrowse",
      "tryDemo",
      "tryDemoSub",
    ],
  },
  {
    id: "stats",
    keys: ["statPages", "statPagesLabel", "statWilayas", "statWilayasLabel", "statCod", "statCodLabel"],
  },
  {
    id: "how",
    keys: [
      "howEyebrow",
      "howTitle",
      "howSub",
      "step1Title",
      "step1Copy",
      "step2Title",
      "step2Copy",
      "step3Title",
      "step3Copy",
    ],
  },
  {
    id: "catalog",
    keys: ["catalogEyebrow", "catalogTitle", "catalogSub", "browseStore", "newPage"],
  },
  {
    id: "subs",
    keys: ["subsEyebrow", "subsTitle", "subsCta"],
  },
  {
    id: "footer",
    keys: ["footer1", "footer2"],
  },
];

// كل المفاتيح القابلة للتعديل — مسطّحة (تُستعمل في الفلترة والتحقق).
export const SITE_COPY_KEYS: I18nKey[] = SITE_COPY_GROUPS.flatMap((g) => g.keys);

export const EDITABLE_KEYS = new Set<string>(SITE_COPY_KEYS);

