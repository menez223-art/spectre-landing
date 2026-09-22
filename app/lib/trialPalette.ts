// لوحات ألوان التجارب — مستمدة من هوية agent (نفس روح فئاته) بصيغة Theme الخاصة بـ Spectre
import type { Theme } from "@/app/lib/types";

const THEMES: Record<string, Theme> = {
  food: {
    mode: "light",
    primary: "#ea580c",
    accent: "#c2410c",
    bg: "#fffaf5",
    surface: "#ffffff",
    text: "#2b1a10",
    muted: "#8a7360",
    bgAlt: "#fff4ea",
    promoBg: "linear-gradient(135deg,#ea580c,#c2410c)",
    promoText: "#ffffff",
  },
  health: {
    mode: "light",
    primary: "#0d9488",
    accent: "#0f766e",
    bg: "#f4fbfa",
    surface: "#ffffff",
    text: "#0f2622",
    muted: "#5f837d",
    bgAlt: "#e9f6f4",
    promoBg: "linear-gradient(135deg,#0d9488,#0f766e)",
    promoText: "#ffffff",
  },
  shop: {
    mode: "light",
    primary: "#6366f1",
    accent: "#4f46e5",
    bg: "#f7f7fd",
    surface: "#ffffff",
    text: "#191933",
    muted: "#6b6b8d",
    bgAlt: "#eef0fc",
    promoBg: "linear-gradient(135deg,#6366f1,#4f46e5)",
    promoText: "#ffffff",
  },
  services: {
    mode: "light",
    primary: "#b45309",
    accent: "#92400e",
    bg: "#fdfaf3",
    surface: "#ffffff",
    text: "#291c0c",
    muted: "#87765a",
    bgAlt: "#f7efdd",
    promoBg: "linear-gradient(135deg,#b45309,#92400e)",
    promoText: "#ffffff",
  },
};

export function paletteForCategory(category: string): Theme {
  const c = category.toLowerCase();
  if (/^(restaurant|cafe|fast_food|food_court|bar)$/.test(c)) return THEMES.food;
  if (/^(pharmacy|clinic|dentist|doctors)$/.test(c) || c === "healthcare") return THEMES.health;
  if (/^(craft|office)$/.test(c)) return THEMES.services;
  return THEMES.shop;
}
