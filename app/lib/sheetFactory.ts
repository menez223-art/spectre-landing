// استدعاء Sheet Factory (سكريبت Apps Script) لإنشاء جدول مستقل لكل بريد — server only
// المتغيرات: FACTORY_URL (رابط /exec بعد النشر) و FACTORY_SECRET (نفس قيمة SECRET في السكريبت)

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function hasSheetFactory(): boolean {
  return Boolean(process.env.FACTORY_URL && process.env.FACTORY_SECRET);
}

export interface FactoryResult {
  key: string;
  sheetId: string;
  url: string;
}

export async function createSheetForEmail(email: string): Promise<FactoryResult | null> {
  const url = process.env.FACTORY_URL;
  const secret = process.env.FACTORY_SECRET;
  if (!url || !secret) return null;

  const clean = email.trim().toLowerCase();
  if (!EMAIL_RE.test(clean)) return null;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ action: "create_sheet", secret, email: clean }),
    });
    const text = await res.text();

    // المصنع يرد "ERR <msg>" عند الخطأ، و JSON عند النجاح
    if (text.trim().startsWith("ERR")) {
      console.error("[sheetFactory] خطأ المصنع:", text.trim());
      return null;
    }
    const parsed = JSON.parse(text) as {
      ok?: boolean;
      key?: string;
      sheetId?: string;
      url?: string;
    };
    if (parsed.ok && parsed.key && parsed.sheetId && parsed.url) {
      return { key: parsed.key, sheetId: parsed.sheetId, url: parsed.url };
    }
    return null;
  } catch (err) {
    console.error("[sheetFactory] فشل الاتصال بالمصنع:", err);
    return null;
  }
}
