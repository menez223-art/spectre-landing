// استخراج لوحة ألوان من صورة المنتج — client only (يستخدم canvas)

import type { PaletteResult } from "./types";
import { darken, lighten, luminance, meanLuminance, mix, parseColor, rgbToHex, saturation } from "./color";
import { deriveTheme } from "./theme";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("تعذر تحميل الصورة"));
    img.src = src;
  });
}

// خطأ خاص عندما يمنع CORS قراءة بكسل الصورة (رابط خارجي) — يعالج برسالة ودية
export class PaletteCorsError extends Error {
  constructor() {
    super("CORS");
    this.name = "PaletteCorsError";
  }
}

interface Bin {
  r: number;
  g: number;
  b: number;
  count: number;
}

const BIN = 4; // 4×4×4 حاويات

// يقصّ الصورة لأقصى حجم معيّن ويعيد dataURL مضغوطة — يوفّر مساحة localStorage
export function compressImage(
  file: File,
  maxDim = 1024,
  quality = 0.85
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(compressDataUrl(String(reader.result), maxDim, quality));
    reader.onerror = () => reject(new Error("تعذر قراءة الملف"));
    reader.readAsDataURL(file);
  });
}

export function compressDataUrl(src: string, maxDim = 1024, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("canvas"));
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => reject(new Error("صورة غير صالحة"));
    img.src = src;
  });
}

// جوهر الاستخراج — يعمل على أي HTMLImageElement جاهز
async function extractPaletteFromImage(img: HTMLImageElement): Promise<PaletteResult> {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("canvas غير مدعوم");
  ctx.drawImage(img, 0, 0, size, size);
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, size, size).data;
  } catch (err) {
    // canvas ملوّث بلا CORS — لا يمكن قراءة البكسلات
    throw new PaletteCorsError();
  }

  const bins = new Map<number, Bin>();
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 128) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const key = (r >> (8 - BIN)) * BIN * BIN + (g >> (8 - BIN)) * BIN + (b >> (8 - BIN));
    const bin = bins.get(key);
    if (bin) {
      bin.r += r;
      bin.g += g;
      bin.b += b;
      bin.count += 1;
    } else {
      bins.set(key, { r, g, b, count: 1 });
    }
  }

  const candidates = Array.from(bins.values())
    .map((bin) => ({
      hex: rgbToHex([bin.r / bin.count, bin.g / bin.count, bin.b / bin.count]),
      count: bin.count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  if (!candidates.length) {
    // صورة شفافة بالكامل
    return {
      theme: deriveTheme("#3b82f6", "#e2e8f0", "light"),
      swatches: ["#3b82f6", "#e2e8f0"],
      suggestedMode: "light",
    };
  }

  const bySaturation = (c: { hex: string }) => {
    const rgb = parseColor(c.hex);
    return rgb ? saturation(rgb) : 0;
  };

  // اللون المحايد: الأكثر تكراراً مع تشبّع منخفض
  const neutralCandidate =
    candidates.find((c) => bySaturation(c) < 0.18) ?? candidates[0];

  // اللون الأساسي: الأكثر تكراراً بتشبّع كافٍ ولومانسيّة وسط
  const primaryCandidate =
    candidates.find((c) => {
      const rgb = parseColor(c.hex);
      if (!rgb) return false;
      const lum = luminance(rgb);
      return saturation(rgb) >= 0.22 && lum > 0.12 && lum < 0.88;
    }) ??
    [...candidates].sort((a, b) => bySaturation(b) - bySaturation(a))[0];

  const neutral = neutralCandidate.hex;
  const primary = primaryCandidate.hex;
  const suggestedMode: "dark" | "light" =
    meanLuminance(candidates.map((c) => c.hex)) < 0.45 ? "dark" : "light";

  const swatches = candidates.map((c) => c.hex).slice(0, 6);
  const theme = deriveTheme(primary, neutral, suggestedMode);

  return { theme, swatches, suggestedMode };
}

export async function extractPaletteFromDataUrl(dataUrl: string): Promise<PaletteResult> {
  return extractPaletteFromImage(await loadImage(dataUrl));
}

export async function extractPaletteFromUrl(url: string): Promise<PaletteResult> {
  try {
    const img = await loadImage(url);
    return await extractPaletteFromImage(img);
  } catch (e) {
    // فشل التحميل (غالباً بسبب CORS) أو تلويث canvas — نختصرها جميعاً لخطأ CORS
    if (e instanceof PaletteCorsError) throw e;
    throw new PaletteCorsError();
  }
}

// ألوان مساعدة للعرض في الاستوديو (ضوء/ظل)
export function previewShade(hex: string, amount: number): string {
  return amount >= 0 ? lighten(hex, amount) : darken(hex, -amount);
}

export { meanLuminance, mix };
