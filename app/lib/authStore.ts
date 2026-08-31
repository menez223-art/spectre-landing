// تخزين الأجهزة المعتمدة والرموز المعلّقة في Supabase Postgres — server only
// بصمة الجهاز تُعَدَّل بـ pepper خادمي (DEVICE_PEPPER) قبل التخزين،
// حتى لا تُفيد قراءة الملفات العامة أحدًا في انتحال جهاز معتمد.
// هذا البديل المجاني والمستقر عن Vercel Blob: لا فواتير ولا تعليق تلقائي.

import { deleteKv, getKv, listKv, setKv } from "./kvStore";
import { MASTER_USERNAME } from "./credentials";
import { KV_KEYS, KV_PREFIXES, RESOURCE_LIMITS, TIME_CONSTANTS } from "./utils/constants";
import { pepperFingerprint, getDeviceOwner, generateCode } from "./utils/security";
import { nowISO, createExpiryDate } from "./utils/date";

if (typeof window !== "undefined") {
  throw new Error("authStore.ts is server-only");
}

// إعادة تصدير للتوافق مع الكود الموجود
export { pepperFingerprint, getDeviceOwner, generateCode };

const ACCOUNT_PATH = KV_KEYS.ACCOUNT;
const DEVICE_PREFIX = KV_PREFIXES.DEVICES;
const CODE_TTL_MS = TIME_CONSTANTS.CODE_TTL_MS;
export const MAX_TRIES = RESOURCE_LIMITS.MAX_AUTH_TRIES;

export interface AccountRecord {
  username: string;
  devices: string[]; // بصمات مُعدَّلة بالـ pepper (دائمة — لا تنتهي)
  createdAt: string;
}

export interface PendingCode {
  code: string;
  fingerprint: string; // بصمة مُعدَّلة بالـ pepper
  username: string;
  createdAt: string;
  expiresAt: string;
  tries: number;
}

function pendingKey(fp: string): string {
  return `${KV_PREFIXES.PENDING_CODES}${fp}.json`;
}

// ── الحساب ──
// ملاحظة: المصفوفة devices داخل account.json أبقيناها للتوافق مع البيانات
// القديمة، لكن مصدر الحقيقة الجديد لاعتماد الأجهزة هو الصفوف المستقلة
// تحت DEVICE_PREFIX (ذرّية). القراءة تدمج المصدرين كاحتياط آمن.
export async function getAccount(): Promise<AccountRecord | null> {
  try {
    return await getKv<AccountRecord>(ACCOUNT_PATH);
  } catch {
    return null;
  }
}

export async function ensureAccount(): Promise<AccountRecord> {
  const existing = await getAccount();
  if (existing) return existing;
  const acc: AccountRecord = {
    username: MASTER_USERNAME,
    devices: [],
    createdAt: nowISO(),
  };
  await setKv(ACCOUNT_PATH, acc);
  return acc;
}

// قراءة كل الأجهزة المعتمدة (من الصفوف المستقلة + احتياط المصفوفة القديمة)
async function readAllDevices(): Promise<string[]> {
  const out: string[] = [];
  const seen: Record<string, boolean> = {};
  try {
    const rows = await listKv(DEVICE_PREFIX);
    for (const r of rows) {
      const v = r.value as { fingerprint?: string } | null;
      if (v?.fingerprint && !seen[v.fingerprint]) {
        seen[v.fingerprint] = true;
        out.push(v.fingerprint);
      }
    }
  } catch {
    // تجاهل فشل القراءة — سنعتمد على الاحتياط أدناه
  }
  // احتياط: دمج المصفوفة القديمة في account.json (لا ضرر)
  const acc = await getAccount();
  for (const d of acc?.devices ?? []) {
    if (!seen[d]) {
      seen[d] = true;
      out.push(d);
    }
  }
  return out;
}

// هل يوجد أي جهاز معتمد في النظام؟ (مصدران: الصفوف المستقلة + المصفوفة القديمة)
// fail-closed: أي فشل في القراءة يعني «ربما توجد أجهزة» — كي لا يُعتمد أول
// جهاز تلقائياً بسبب فقدان/عطب سجل الحساب (ثغرة bootstrap السابقة).
export async function hasAnyApprovedDevice(): Promise<boolean> {
  try {
    const rows = await listKv(DEVICE_PREFIX);
    if (rows.length > 0) return true;
  } catch {
    // تعذّر قراءة صفوف الأجهزة — نفترض وجود أجهزة (لا اعتماد تلقائي)
    return true;
  }
  try {
    const acc = await getAccount();
    if ((acc?.devices?.length ?? 0) > 0) return true;
  } catch {
    // تعذّر قراءة الحساب — نفس المنطق fail-closed
    return true;
  }
  return false;
}

// ── الأجهزة المعتمدة ──
// فحص الاعتماد مع احترام علم الحظر حتى في مسار الاحتياط (المصفوفة القديمة).
// عند فشل قراءة صفّ الجهاز المستقل لا نُسلّم الجهاز معتمداً تلقائياً؛ نتحقق
// من الحظر أولاً ثم من المصفوفة. هذا يغلق حافة «KV blip ⇒ جهاز محظور يمرّ».
export async function isDeviceApproved(rawFp: string): Promise<boolean> {
  const fp = pepperFingerprint(rawFp);
  try {
    const row = await getKv<{ fingerprint?: string; banned?: boolean }>(deviceKey(fp));
    if (row?.fingerprint === fp) return !row.banned;
  } catch {
    // احتياط: رجوع للمصفوفة القديمة — لكن بعد فحص الحظر
  }
  if (await isDeviceBanned(rawFp)) return false;
  const acc = await getAccount();
  return acc?.devices.includes(fp) ?? false;
}

// نسخة ترجع «معتمد» بغض النظر عن حالة الحظر — تُستخدم حيث نحتاج التمييز
// بين «غير معتمد أصلاً» و«معتمد لكن محظور» (مثل can-produce والنشر، كي نُرجع
// السبب الصحيح banned بدل unauthorized). الحماية العامة (دخول الاستوديو/
// صلاحية الأدمن) تبقى على isDeviceApproved التي ترفض المحظور.
export async function isDeviceApprovedOnly(rawFp: string): Promise<boolean> {
  const fp = pepperFingerprint(rawFp);
  try {
    const row = await getKv<{ fingerprint?: string }>(deviceKey(fp));
    if (row?.fingerprint === fp) return true;
  } catch {
    // احتياط: رجوع للمصفوفة القديمة
  }
  const acc = await getAccount();
  return acc?.devices.includes(fp) ?? false;
}

// مفتاح صف الجهاز المستقل
function deviceKey(fp: string): string {
  return `${DEVICE_PREFIX}${fp}.json`;
}

// قراءة صفّ الجهاز المستقل (يشمل حالة الحظر)
export async function getDeviceRow(rawFp: string): Promise<{ fingerprint?: string; banned?: boolean; createdAt?: string } | null> {
  try {
    return await getKv<{ fingerprint?: string; banned?: boolean; createdAt?: string }>(deviceKey(pepperFingerprint(rawFp)));
  } catch {
    return null;
  }
}

// هل البصمة المُعدَّلة بالـ pepper محظورة على مستوى صفّ الجهاز؟
export async function isDeviceBanned(rawFp: string): Promise<boolean> {
  const row = await getDeviceRow(rawFp);
  return Boolean(row?.banned) && row?.fingerprint === pepperFingerprint(rawFp);
}

// تثبيت/رفع حظر صفّ الجهاز المستقل عبر البصمة المُعدَّلة بالـ pepper مباشرةً
// (يُستخدم من الأدمن عند حظر/إلغاء حظر إيميل — نحظر كل أجهزة صاحب الإيميل).
// هذا يغلق حافة «جهاز يهرب من حظر الإيميل»: يُمنع من الإنتاج فوراً حتى لو
// كانت بعض منشوراته مملوكة بصيغة device:hash تفلت من إعادة الإسناد.
export async function setDeviceBannedByPepper(fp: string, banned: boolean): Promise<void> {
  try {
    const existing = await getKv<{ fingerprint?: string; banned?: boolean; createdAt?: string }>(deviceKey(fp));
    const row: { fingerprint: string; banned: boolean; createdAt: string } = {
      fingerprint: existing?.fingerprint ?? fp,
      banned,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
    await setKv(deviceKey(fp), row);
  } catch {
    // تجاهل فشل الكتابة
  }
}

// حذف صفّ الجهاز المستقل عبر البصمة المُعدَّلة بالـ pepper (عند الحذف النهائي
// للمستخدم — يمحو الجهاز من الجذور فيتبقّى معتمداً إلا بإعادة تفعيل كامل).
export async function removeApprovedDeviceByPepper(fp: string): Promise<void> {
  try {
    await deleteKv(deviceKey(fp));
  } catch {
    // تجاهل فشل الحذف المستقل
  }
  try {
    const acc = await getAccount();
    if (acc && acc.devices.includes(fp)) {
      acc.devices = acc.devices.filter((d) => d !== fp);
      await setKv(ACCOUNT_PATH, acc);
    }
  } catch {
    // تجاهل
  }
}

export async function addApprovedDevice(rawFp: string): Promise<void> {
  const fp = pepperFingerprint(rawFp);
  // صف مستقل = كتابة ذرّية، لا تتأثر بكتابة متزامنة على account.json
  try {
    await setKv(deviceKey(fp), { fingerprint: fp, createdAt: nowISO() });
  } catch {
    // فشل نادر → احتياط على المصفوفة القديمة
    try {
      const acc = await ensureAccount();
      if (!acc.devices.includes(fp)) {
        acc.devices.push(fp);
        await setKv(ACCOUNT_PATH, acc);
      }
    } catch {
      // تجاهل
    }
  }
}

// إزالة جهاز معتمد (يُستخدم في التنظيف والإدارة)
export async function removeApprovedDevice(rawFp: string): Promise<void> {
  const fp = pepperFingerprint(rawFp);
  try {
    await deleteKv(deviceKey(fp));
  } catch {
    // تجاهل فشل الحذف المستقل
  }
  // تنظيف احتياطي من المصفوفة القديمة
  try {
    const acc = await getAccount();
    if (acc && acc.devices.includes(fp)) {
      acc.devices = acc.devices.filter((d) => d !== fp);
      await setKv(ACCOUNT_PATH, acc);
    }
  } catch {
    // تجاهل
  }
}

// ── الرموز المعلّقة ──
export async function getPendingCode(rawFp: string): Promise<PendingCode | null> {
  try {
    return await getKv<PendingCode>(pendingKey(pepperFingerprint(rawFp)));
  } catch {
    return null;
  }
}

export async function createPendingCode(rawFp: string): Promise<string | null> {
  const pending: PendingCode = {
    code: generateCode(),
    fingerprint: pepperFingerprint(rawFp),
    username: MASTER_USERNAME,
    createdAt: nowISO(),
    expiresAt: createExpiryDate(CODE_TTL_MS),
    tries: 0,
  };
  try {
    await setKv(pendingKey(pepperFingerprint(rawFp)), pending);
    return pending.code;
  } catch {
    return null;
  }
}

export async function incrementPendingTries(rawFp: string): Promise<void> {
  const pending = await getPendingCode(rawFp);
  if (!pending) return;
  pending.tries += 1;
  try {
    await setKv(pendingKey(pepperFingerprint(rawFp)), pending);
  } catch {
    // تجاهل فشل الكتابة
  }
}

export async function deletePendingCode(rawFp: string): Promise<void> {
  try {
    await deleteKv(pendingKey(pepperFingerprint(rawFp)));
  } catch {
    // تجاهل فشل الحذف
  }
}

// قائمة كل الرموز المعلّقة (للبحث عبر متصفحات مختلفة)
export async function listPendingCodes(): Promise<PendingCode[]> {
  try {
    const rows = await listKv(KV_PREFIXES.PENDING_CODES);
    return rows
      .map((row) => row.value as PendingCode | null)
      .filter((p): p is PendingCode => Boolean(p) && typeof p?.code === "string");
  } catch {
    return [];
  }
}

// ── رموز الربط اليدوي (كود مشرف لمرة واحدة أول جهاز) ──
// مفتاح بصمة الجهاز (مُعدَّلة بـ pepper) كي نعثر عليه عند التأكيد.
const MANUAL_PENDING_PREFIX = KV_PREFIXES.MANUAL_PENDING;

export interface ManualPendingCode {
  fingerprint: string; // بصمة مُعدَّلة بالـ pepper
  code: string; // كود المشرف للربط اليدوي
  tries: number;
  createdAt: string;
  expiresAt: string;
}

function manualPendingKey(rawFp: string): string {
  return `${MANUAL_PENDING_PREFIX}${pepperFingerprint(rawFp)}.json`;
}

export async function createManualPendingCode(rawFp: string): Promise<string | null> {
  const pending: ManualPendingCode = {
    fingerprint: pepperFingerprint(rawFp),
    code: generateCode(),
    tries: 0,
    createdAt: nowISO(),
    expiresAt: createExpiryDate(CODE_TTL_MS),
  };
  try {
    await setKv(manualPendingKey(rawFp), pending);
    return pending.code;
  } catch {
    return null;
  }
}

export async function getManualPendingCode(rawFp: string): Promise<ManualPendingCode | null> {
  try {
    return await getKv<ManualPendingCode>(manualPendingKey(rawFp));
  } catch {
    return null;
  }
}

export async function incrementManualTries(rawFp: string): Promise<void> {
  const pending = await getManualPendingCode(rawFp);
  if (!pending) return;
  pending.tries += 1;
  try {
    await setKv(manualPendingKey(rawFp), pending);
  } catch {
    // تجاهل فشل الكتابة
  }
}

export async function deleteManualPendingCode(rawFp: string): Promise<void> {
  try {
    await deleteKv(manualPendingKey(rawFp));
  } catch {
    // تجاهل فشل الحذف
  }
}
