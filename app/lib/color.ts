// رياضيات الألوان — دوال نقية آمنة للـ SSR (لا تستخدم window/document)

export type RGB = [number, number, number];

// يقبل hex (#rgb/#rrggbb) أو rgb()/rgba()
export function parseColor(color: string): RGB | null {
  if (!color) return null;
  const hex = color.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    const [r, g, b] = hex.split("").map((c) => parseInt(c + c, 16));
    return [r, g, b];
  }
  if (/^[0-9a-fA-F]{6}$/.test(hex)) {
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
    ];
  }
  const m = color.match(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*[\d.]+)?\s*\)/i
  );
  if (m) {
    return [
      Math.min(255, Number(m[1])),
      Math.min(255, Number(m[2])),
      Math.min(255, Number(m[3])),
    ];
  }
  return null;
}

export function rgbToHex([r, g, b]: RGB): string {
  const to = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

// لون شفاف من hex/rgb — ينتج rgba(...) جاهزة
export function rgba(color: string, alpha: number): string {
  const rgb = parseColor(color);
  if (!rgb) return color;
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a.toFixed(2)})`;
}

// إضاءة نسبية (WCAG) — 0..1
export function luminance(rgb: RGB): number {
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(fg: string, bg: string): number {
  const a = parseColor(fg);
  const b = parseColor(bg);
  if (!a || !b) return 0;
  const l1 = luminance(a);
  const l2 = luminance(b);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

// مزج لونين — t=0 → a، t=1 → b
export function mix(a: string, b: string, t: number): string {
  const ca = parseColor(a);
  const cb = parseColor(b);
  if (!ca || !cb) return a;
  const w = Math.max(0, Math.min(1, t));
  return rgbToHex([
    ca[0] + (cb[0] - ca[0]) * w,
    ca[1] + (cb[1] - ca[1]) * w,
    ca[2] + (cb[2] - ca[2]) * w,
  ]);
}

export function lighten(color: string, amount: number): string {
  return mix(color, "#ffffff", amount);
}

export function darken(color: string, amount: number): string {
  return mix(color, "#000000", amount);
}

// يضمن أن fg فوق bg يحقق تبايناً لا يقل عن min — يتحرك fg نحو الأبيض أو الأسود
export function ensureContrast(fg: string, bg: string, min = 4.5): string {
  const rgb = parseColor(fg);
  const bgRgb = parseColor(bg);
  if (!rgb || !bgRgb) return fg;
  if (contrastRatio(fg, bg) >= min) return fg;
  const toWhite = contrastRatio("#ffffff", bg) > contrastRatio("#000000", bg);
  const target: RGB = toWhite ? [255, 255, 255] : [0, 0, 0];
  let lo = 0;
  let hi = 1;
  let best = fg;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    const cand = rgbToHex([
      rgb[0] + (target[0] - rgb[0]) * mid,
      rgb[1] + (target[1] - rgb[1]) * mid,
      rgb[2] + (target[2] - rgb[2]) * mid,
    ]);
    if (contrastRatio(cand, bg) >= min) {
      best = cand;
      hi = mid;
    } else {
      lo = mid;
    }
  }
  return best;
}

// أفتح/أغمق الخلفية حتى يتحقق التباين المطلوب مع fg ثابت
export function ensureBg(fg: string, bg: string, min = 4.5, dark = false): string {
  const bgRgb = parseColor(bg);
  if (!bgRgb) return bg;
  if (contrastRatio(fg, bg) >= min) return bg;
  let current = bg;
  for (let i = 0; i < 24; i++) {
    current = dark ? darken(current, 0.06) : lighten(current, 0.06);
    if (contrastRatio(fg, current) >= min) return current;
  }
  return dark ? "#000000" : "#ffffff";
}

// متوسط إضاءة مجموعة ألوان — 0..1
export function meanLuminance(colors: string[]): number {
  const lums = colors
    .map(parseColor)
    .filter((c): c is RGB => Boolean(c))
    .map(luminance);
  if (!lums.length) return 0.5;
  return lums.reduce((a, b) => a + b, 0) / lums.length;
}

// نص واضح (أبيض أو أسود) فوق خلفية معينة
export function readableOn(bg: string): string {
  return contrastRatio("#ffffff", bg) >= 4.5 ? "#ffffff" : "#10131a";
}

// تشبّع تقريبي 0..1
export function saturation([r, g, b]: RGB): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === 0) return 0;
  return (max - min) / max;
}
