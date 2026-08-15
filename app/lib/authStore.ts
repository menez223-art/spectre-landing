// تخزين الأجهزة المعتمدة والرموز المعلّقة في Supabase Postgres — server only
// بصمة الجهاز تُعَدَّل بـ pepper خادمي (DEVICE_PEPPER) قبل التخزين،
// حتى لا تُفيد قراءة الملفات العامة أحدًا في انتحال جهاز معتمد.
// هذا البديل المجاني والمستقر عن Vercel Blob: لا فواتير ولا تعليق تلقائي.

import { createHash } from "crypto";
import { deleteKv, getKv, listKv, setKv } from "./kvStore";
import { MASTER_USERNAME } from "./credentials";

if (typeof window !== "undefined") {
  throw new Error("authStore.ts is server-only");
}

const ACCOUNT_PATH = "studio-auth/account.json";
// كل جهاز معتمد يُخزَّن في صف KV مستقل (ذرّي — لا ضياع تحديثات عند التزامن).
// هذا يُصلح ثغرة lost update في كائن account.json الموحّد: أي كاتبين متزامنين
// (إضافة جهاز + حظر/إزالة من الأدمن) كانا يطمس أحدهما الآخر.
const DEVICE_PREFIX = "studio-auth/devices/";
const CODE_TTL_MS = 15 * 60 * 1000; // صلاحية الرمز: 15 دقيقة
export const MAX_TRIES = 5;

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

// ── pepper: إخفاء البصمات المخزّنة ──
export function pepperFingerprint(fp: string): string {
  const pepper = process.env.DEVICE_PEPPER || "";
  if (!pepper) console.warn("[authStore] DEVICE_PEPPER غير معرّف — التخزين أضعف");
  return createHash("sha256").update(fp + "|" + pepper).digest("hex");
}

// هوية سقوط للجهاز عند غياب بريد — تُستخدم كمالك للصفحات المنشورة
export function getDeviceOwner(rawFp: string): string {
  return "device:" + pepperFingerprint(rawFp).slice(0, 24);
}

function pendingKey(fp: string): string {
  return `studio-auth/pending/${fp}.json`;
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
    createdAt: new Date().toISOString(),
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

// ── الأجهزة المعتمدة ──
export async function isDeviceApproved(rawFp: string): Promise<boolean> {
  const fp = pepperFingerprint(rawFp);
  try {
    const row = await getKv<{ fingerprint?: string; banned?: boolean }>(deviceKey(fp));
    if (row?.fingerprint === fp) return !row.banned; // البصمة المحظورة = غير معتمد
  } catch {
    // احتياط: رجوع للمصفوفة القديمة
  }
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
    await setKv(deviceKey(fp), { fingerprint: fp, createdAt: new Date().toISOString() });
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

export function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function createPendingCode(rawFp: string): Promise<string | null> {
  const now = Date.now();
  const pending: PendingCode = {
    code: generateCode(),
    fingerprint: pepperFingerprint(rawFp),
    username: MASTER_USERNAME,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + CODE_TTL_MS).toISOString(),
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

// ── رموز ربط البريد (المصادقة المزدوجة) ──
// مفتاح ببريد المستخدم (غير مُعدَّل بـ pepper) كي نعثر عليه مباشرةً عند التأكيد.
const LINK_PENDING_PREFIX = "studio-auth/link-pending/";

export interface LinkPendingCode {
  email: string; // البريد المطلوب ربطه
  fingerprint: string; // بصمة الجهاز الطالب (عذرية — للمطابقة عند التأكيد)
  adminCode: string; // كود المشرف — يُرسل لبريد المشرف (الخطوة 1)
  emailCode: string; // كود البريد — يُرسل للبريد المطلوب (الخطوة 2)
  adminVerified: boolean; // هل صادق المشرف بالكود الأول؟
  adminTries: number;
  emailTries: number;
  createdAt: string;
  expiresAt: string;
}

function linkPendingKey(email: string): string {
  return `${LINK_PENDING_PREFIX}${email.toLowerCase()}.json`;
}

export async function createLinkPendingCode(email: string, fingerprint: string): Promise<string | null> {
  const now = Date.now();
  const pending: LinkPendingCode = {
    email: email.toLowerCase(),
    fingerprint,
    adminCode: generateCode(),
    emailCode: generateCode(),
    adminVerified: false,
    adminTries: 0,
    emailTries: 0,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + CODE_TTL_MS).toISOString(),
  };
  try {
    await setKv(linkPendingKey(email), pending);
    return pending.adminCode;
  } catch {
    return null;
  }
}

export async function getLinkPendingCode(email: string): Promise<LinkPendingCode | null> {
  try {
    return await getKv<LinkPendingCode>(linkPendingKey(email));
  } catch {
    return null;
  }
}

export async function incrementLinkAdminTries(email: string): Promise<void> {
  const pending = await getLinkPendingCode(email);
  if (!pending) return;
  pending.adminTries += 1;
  try {
    await setKv(linkPendingKey(email), pending);
  } catch {
    // تجاهل فشل الكتابة
  }
}

export async function incrementLinkEmailTries(email: string): Promise<void> {
  const pending = await getLinkPendingCode(email);
  if (!pending) return;
  pending.emailTries += 1;
  try {
    await setKv(linkPendingKey(email), pending);
  } catch {
    // تجاهل فشل الكتابة
  }
}

// يثبّت أن المشرف صادق الكود الأول (لا يغيّر بقية الحقول).
export async function setLinkPendingVerified(email: string): Promise<void> {
  const pending = await getLinkPendingCode(email);
  if (!pending) return;
  pending.adminVerified = true;
  try {
    await setKv(linkPendingKey(email), pending);
  } catch {
    // تجاهل فشل الكتابة
  }
}

export async function deleteLinkPendingCode(email: string): Promise<void> {
  try {
    await deleteKv(linkPendingKey(email));
  } catch {
    // تجاهل فشل الحذف
  }
}

// ── رموز الربط اليدوي (كود مشرف لمرة واحدة أول جهاز) ──
// مفتاح بصمة الجهاز (مُعدَّلة بـ pepper) كي نعثر عليه عند التأكيد.
const MANUAL_PENDING_PREFIX = "studio-auth/manual-pending/";

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
  const now = Date.now();
  const pending: ManualPendingCode = {
    fingerprint: pepperFingerprint(rawFp),
    code: generateCode(),
    tries: 0,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + CODE_TTL_MS).toISOString(),
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
