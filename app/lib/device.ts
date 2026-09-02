// بصمة الجهاز — SHA-256 لإشارات ثابتة من المتصفح (client only)
// تُستخدم لربط جهاز معتمد بجلسة الدخول. كل قناة داخل try/catch حتى لا تفشل الحساب كاملًا.
// تحذير أمان: البصمة تُحسب في المتصفح ويمكن محاكاتها تقنيًا — طبقة تحكّم لا أمان حقيقي.

let cached: string | null = null;
let inflight: Promise<string> | null = null;

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function canvasFingerprint(): Promise<string> {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 220;
    canvas.height = 40;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";
    ctx.textBaseline = "top";
    ctx.font = "14px Arial";
    ctx.fillStyle = "#f60";
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = "#069";
    ctx.fillText("Claude", 2, 15);
    ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
    ctx.fillText("studio.device", 4, 17);
    return canvas.toDataURL();
  } catch {
    return "";
  }
}

export async function computeDeviceFingerprint(): Promise<string> {
  if (cached) return cached;
  // سباق التزامن: استدعاءان متوازيان يحسبان البصمة مرتين (WebGL + canvas بطيئان)
  // — نضمن حساب واحد ثم نُرجع Promise نفسه للجميع.
  if (inflight) return inflight;
  inflight = (async () => {
    const signals: string[] = [];
    const add = (v: unknown) => signals.push(typeof v === "string" ? v : String(v ?? ""));

  add(navigator.userAgent);
  add(navigator.language);
  try {
    add(navigator.languages?.join(",") ?? "");
  } catch {
    add("");
  }
  add(navigator.platform);
  add(navigator.hardwareConcurrency);
  try {
    add((navigator as unknown as { deviceMemory?: number }).deviceMemory ?? "");
  } catch {
    add("");
  }
  add(navigator.maxTouchPoints);

  const s = window.screen;
  add(`${s.width}x${s.height}x${s.colorDepth}@${window.devicePixelRatio}`);
  add(new Date().getTimezoneOffset());

  try {
    const gl = document.createElement("canvas").getContext("webgl");
    if (gl) {
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      add(ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR));
      add(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    } else {
      add("");
    }
  } catch {
    add("");
  }

  add(await canvasFingerprint());

  const computed = await sha256Hex(signals.join("|"));

  // ثبات البصمة على الهاتف: إشارات الجوال تتغيّر بين الجلسات (أشرطة أدوات،
  // دوران الشاشة، تحديث المتصفح) فتولّد بصمة جديدة فيُعتبر المستخدم جهازاً
  // جديداً فيُطلب منه دخولاً من جديد ويضيع ملفه (واتساب/بيكسل/اسم المتجر).
  // الحل: نثبّت أول بصمة في localStorage ونعيد استخدامها دائماً — طبقة
  // التحكّم تبقى كما هي (الكود أصلاً يقرّ بسهولة محاكاتها).
  try {
    const KEY = "studio-device-fingerprint-v1";
    const stored = window.localStorage.getItem(KEY);
    if (stored && /^[a-f0-9]{64}$/.test(stored)) {
      cached = stored;
      return cached;
    }
    window.localStorage.setItem(KEY, computed);
  } catch {
    // وضع خاص/مساحة ممتلئة — نعود للبصمة المحسوبة دون تخزين
  }

  cached = computed;
  return cached;
  })();
  return inflight;
}
