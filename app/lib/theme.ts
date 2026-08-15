// محرك الألوان — يحوّل Theme إلى CSS Variables تُطبَّق على حاوية الصفحة
// القاعدة الحرجة: كل الألوان الشفافة تُحسب جاهزة كـ rgba() داخل المتغيرات،
// لأن Tailwind 3 لا يدعم تعديل شفافية على var (bg-[var(--x)]/20 مكسورة).

import type { Theme } from "./types";
import {
  darken,
  ensureBg,
  ensureContrast,
  lighten,
  mix,
  parseColor,
  readableOn,
  rgba,
} from "./color";

export function defaultTheme(mode: "dark" | "light" = "dark"): Theme {
  const dark = mode === "dark";
  return {
    mode,
    primary: dark ? "#2e3d56" : "#121828",
    accent: dark ? "#7a9ebc" : "#344d6f",
    bg: dark ? "#0d1117" : "#faf9f5",
    surface: dark ? "rgba(255,255,255,0.05)" : "#ffffff",
    text: dark ? "#ffffff" : "#121828",
    muted: dark ? "rgba(228,235,245,0.78)" : "#4a5a72",
  };
}

export function normalizeTheme(theme: Partial<Theme> | undefined): Theme {
  const dark = theme?.mode !== "light";
  const base = defaultTheme(dark ? "dark" : "light");
  return { ...base, ...theme, mode: dark ? "dark" : "light" };
}

// مجموعة CSS variables — يُرجع مفاتيح تُوضع في style الحاوية
export function buildCssVars(theme: Theme): Record<string, string> {
  const t = normalizeTheme(theme);
  const dark = t.mode === "dark";

  const primary = t.primary;
  const accent = t.accent;
  const bg = t.bg;
  const text = t.text;

  const surface = t.surface ?? (dark ? "rgba(255,255,255,0.05)" : "#ffffff");
  const surface2 = t.surface2 ?? (dark ? "rgba(255,255,255,0.03)" : mix(surface, bg, 0.35));

  // خلفية قسم الطلب
  const bgAlt = t.bgAlt ?? (dark ? bg : mix(bg, primary, 0.045));

  // قسم المميزات (يمكن أن يكون شريطاً مخالفاً للخلفية)
  const bandBg = t.bandBg ?? (dark ? bg : primary);
  const bandText = t.bandText ?? readableOn(bandBg);
  const bandMuted = t.bandMuted ?? rgba(bandText, 0.72);

  // شريط العروض العلوي — قد يكون gradient كاملاً
  const promoBg = t.promoBg ?? (dark ? mix(bg, primary, 0.14) : primary);
  const promoText = t.promoText ?? (dark ? text : bandText);

  const border = dark ? "rgba(255,255,255,0.10)" : rgba(text, 0.14);
  const borderStrong = rgba(primary, 0.55);

  const primaryStrong = t.primaryStrong ?? lighten(primary, 0.08);
  const primarySoft = t.primarySoft ?? rgba(primary, dark ? 0.14 : 0.10);
  const primaryText = t.primaryText ?? readableOn(primary);

  const label = dark ? rgba(text, 0.8) : rgba(text, 0.72);

  const inputBg = t.inputBg ?? (dark ? "rgba(255,255,255,0.05)" : "#ffffff");
  const inputBorder = t.inputBorder ?? (dark ? "rgba(255,255,255,0.10)" : rgba(text, 0.15));
  const placeholder = t.placeholder ?? rgba(text, 0.38);

  // تدرّج الصورة الرئيسية — أساسه الخلفية (داكن) أو اللون الأساسي (فاتح)
  const overlayBase = dark ? bg : primary;
  const imgOverlay = `linear-gradient(to top, ${rgba(overlayBase, 0.86)}, ${rgba(
    overlayBase,
    0.12
  )} 38%, ${rgba(overlayBase, 0)})`;

  return {
    "--c-bg": bg,
    "--c-bg-alt": bgAlt,
    "--c-text": text,
    "--c-muted": t.muted,
    "--c-accent": accent,
    "--c-primary": primary,
    "--c-primary-strong": primaryStrong,
    "--c-primary-soft": primarySoft,
    "--c-primary-text": primaryText,
    "--c-surface": surface,
    "--c-surface-2": surface2,
    "--c-border": border,
    "--c-border-strong": borderStrong,
    "--c-band-bg": bandBg,
    "--c-band-text": bandText,
    "--c-band-muted": bandMuted,
    "--c-band-border": rgba(bandText, 0.18),
    "--c-promo-bg": promoBg,
    "--c-promo-text": promoText,
    "--c-glow": t.glow ?? rgba(primary, dark ? 0.32 : 0.16),
    "--c-label": label,
    "--c-input-bg": inputBg,
    "--c-input-border": inputBorder,
    "--c-input-text": text,
    "--c-placeholder": placeholder,
    "--c-img-overlay": imgOverlay,
    "--c-sticky-bg": rgba(bg, 0.9),
  };
}

// بناء ثيم من الألوان المستخرجة من صورة المنتج
export function deriveTheme(
  primary: string,
  neutral: string,
  mode: "dark" | "light"
): Theme {
  const dark = mode === "dark";
  const bgRaw = dark ? darken(neutral, 0.5) : lighten(neutral, 0.42);
  const bg = parseColor(bgRaw) ? bgRaw : dark ? "#0d1117" : "#faf9f5";
  const text = dark ? "#f4f6fa" : "#14161d";
  const bgSafe = ensureBg(text, bg, 4.5, dark);
  const accent = dark
    ? ensureContrast(mix(primary, "#ffffff", 0.55), bgSafe, 3)
    : ensureContrast(mix(primary, "#14161d", 0.28), bgSafe, 4.5);
  const primarySafe = dark ? primary : primary;

  return {
    mode: dark ? "dark" : "light",
    primary: primarySafe,
    accent,
    bg: bgSafe,
    surface: dark ? "rgba(255,255,255,0.05)" : "#ffffff",
    text,
    muted: dark ? "rgba(226,232,242,0.78)" : mix(text, bgSafe, 0.42),
  };
}
