// يبني حمولة اختبار شاملة: 5 منتجات + 5 صور إجمالاً (المقترح 2: 5/5)
import { writeFileSync } from "fs";

const PX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

// توزيع 5 صور على 5 منتجات: 2 + 1 + 1 + 1 + 0 = 5 (الحد الأقصى)
const products = [
  {
    id: "draft",
    name: "حذاء رياضي برو",
    nameEn: "Pro Running Shoes",
    price: 4500,
    oldPrice: 5000,
    image: PX,
    images: [PX], // 2 صور لهذا المنتج
    colors: [{ name: "أسود", hex: "#111827" }, { name: "أبيض", hex: "#f3f4f6" }],
    eyebrow: "الأكثر مبيعاً",
    badge: "جديد",
    tagline: "راحة قصوى لأداء عالٍ",
    description: "حذاء رياضي خفيف بوسادة هوائية.",
    stats: [{ label: "الوزن", value: "240g" }],
    tags: ["رياضة", "جري"],
  },
  {
    id: "draft",
    name: "حذاء جلد كلاسيك",
    nameEn: "Classic Leather",
    price: 6200,
    image: PX, // صورة واحدة
    images: [],
    colors: [{ name: "بني", hex: "#78350f" }],
    eyebrow: "كلاسيكي",
    badge: "",
    tagline: "أناقة تدوم",
    description: "حذاء جلد طبيعي لإطلالة رسمية.",
    stats: [],
    tags: ["جلد"],
  },
  {
    id: "draft",
    name: "صندل صيفي",
    nameEn: "Summer Sandal",
    price: 2100,
    image: PX, // صورة واحدة
    images: [],
    colors: [{ name: "أزرق", hex: "#1d4ed8" }],
    eyebrow: "صيفي",
    badge: "عرض",
    tagline: "انتعاش في الصيف",
    description: "صندل مريح للإجازات.",
    stats: [],
    tags: ["صيف"],
  },
  {
    id: "draft",
    name: "حذاء شتوي دافئ",
    nameEn: "Winter Boot",
    price: 7800,
    image: PX, // صورة واحدة
    images: [],
    colors: [{ name: "رمادي", hex: "#374151" }],
    eyebrow: "شتوي",
    badge: "",
    tagline: "دفء وحماية",
    description: "حذاء شتوي عازل للماء.",
    stats: [],
    tags: ["شتاء"],
  },
  {
    id: "draft",
    name: "خف رياضي خفيف",
    nameEn: "Light Trainer",
    price: 3300,
    image: "", // بلا صورة (المجموع يبقى aslum 5)
    images: [],
    colors: [{ name: "أخضر", hex: "#15803d" }],
    eyebrow: "تدريب",
    badge: "خفيف",
    tagline: "حرية الحركة",
    description: "خف خفيف للتمارين اليومية.",
    stats: [],
    tags: ["تمرين"],
  },
];

const payload = {
  id: "owner-stable-link-test",
  name: "متجر الأحذية التجريبي",
  nameEn: "Shoe Store Demo",
  price: 0,
  theme: { mode: "light", primary: "#4f46e5", secondary: "#0ea5e9" },
  products,
  sheetKey: "e140ccd4-4a1a-4117-9639-3d584097cf89",
  sheetEmail: "demo@spectre.dev",
};

writeFileSync("C:/Users/C-Ron/AppData/Local/Temp/full_payload.json", JSON.stringify(payload));
console.log("تم بناء الحمولة: 5 منتجات، صور إجمالية =",
  products.reduce((n, p) => n + (p.image ? 1 : 0) + (p.images?.length || 0), 0));
console.log("حجم JSON:", JSON.stringify(payload).length, "بايت");
