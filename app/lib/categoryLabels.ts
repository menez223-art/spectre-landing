// تسميات الفئات العربية — مشتركة مع جسر Agent
const CATEGORY_LABELS: Record<string, string> = {
  restaurant: "مطعم",
  cafe: "مقهى",
  fast_food: "وجبات سريعة",
  food_court: "ساحة طعام",
  bar: "مقهى مسائي",
  pharmacy: "صيدلية",
  clinic: "عيادة",
  dentist: "عيادة أسنان",
  doctors: "عيادة طبية",
  healthcare: "مركز صحي",
  supermarket: "سوبرماركت",
  convenience: "بقالة",
  bakery: "مخبزة",
  butcher: "جزارة",
  clothes: "ملابس",
  florist: "محل زهور",
  furniture: "مفروشات",
  jewelry: "مجوهرات",
  mobile_phone: "هواتف ذكية",
  hairdresser: "صالون حلاقة",
  office: "مكتب",
  craft: "حرفة",
};

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}
