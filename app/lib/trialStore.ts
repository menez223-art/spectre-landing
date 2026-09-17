// سجل تجارب الڤيست — «رابط واحد للأبد» لكل **إيميل** ولكل **جهاز** ولكل **واتساب**.
//
// قواعد صارمة (حسب docs/SPEC-guest-trial.md):
//   1) الرابط **مرة واحدة فقط**: لا تجربة جديدة بعد الانتهاء أو الحذف اليدوي.
//   2) عند الحرق يُحذف **بيانات المنتج** (published + published-meta) نهائياً.
//   3) يبقى **السجل الأدنى** (إيميل + بصمة + واتساب + تواريخ + حالة) بلا أي بيانات
//      منتج، لأنه الوسيلة الوحيدة لفرض القاعدة (١).
//   4) هذه القاعدة تخصّ **روابط الڤيست فقط** — لا تُلمس روابط المشتركين أبداً.
//   5) الهويات الثلاث (إيميل · جهاز · واتساب) كلها **مرة واحدة** لمنع التلاعب.
//
// لا يلمس نظام الحظر/السماح القائم (authStore) — التجربة حالة منفصلة تماماً.

import { getKv, setKv, deleteKvMany, listKv, insertKvMany } from "./kvStore";
import type { Product } from "./types";
import type { PublishMeta } from "./publishStore";
import { deletePublishedProduct } from "./publishStore";
import { KV_PREFIXES } from "./utils/constants";

/** مدة التجربة القانونية — ثابتة، لا تمديد. */
export const TRIAL_HOURS = 24;

/** مفتاح تعطيل توليد الروابط التجريبية على الجميع (زر الأدمن). */
const TRIALS_DISABLED_KEY = "trials_disabled";

/** هل أوقف المالك توليد روابط التجربة؟ (يُقرأ من KV — محلياً من .dev-kv) */
export async function isTrialsDisabled(): Promise<boolean> {
  try {
    return Boolean(await getKv<boolean>(TRIALS_DISABLED_KEY));
  } catch {
    return false;
  }
}

export async function setTrialsDisabled(value: boolean): Promise<void> {
  await setKv(TRIALS_DISABLED_KEY, value);
}

export type TrialStatus =
  | "active"
  | "converted"
  | "expired"
  | "burned"
  | "deleted";

export interface TrialRecord {
  email: string;
  /** رقم واتساب الڤيست — إجباري، داخلي فقط (لا يظهر للزائر). */
  whatsapp: string;
  deviceFp: string;
  slug: string;
  createdAt: string;
  expiresAt: string;
  status: TrialStatus;
  burnedAt: string | null;
  deletedAt: string | null;
  convertedAt: string | null;
}

const P = KV_PREFIXES.TRIALS;
const D = KV_PREFIXES.TRIAL_DEVICES;
const W = KV_PREFIXES.TRIAL_WHATSAPP;

const norm = (email: string) => email.trim().toLowerCase();
const keyFor = (email: string) => `${P}${norm(email)}.json`;
const devKeyFor = (deviceFp: string) => `${D}${deviceFp}.json`;

/**
 * تطبيع رقم الواتساب إلى أرقام فقط، مع إزالة البادئة الدولية المزدوجة:
 * `+213 555 11 11 11` و `00213555111111` و `213555111111` ⇒ `213555111111`
 * التوحيد ضروري وإلا تهرّب المستخدم من قيد «مرة واحدة» بتغيير التنسيق.
 */
export function normalizeWhatsapp(raw: string): string {
  const digits = String(raw ?? "").replace(/[^\d]/g, "");
  return digits.replace(/^00/, "");
}

const waKeyFor = (whatsapp: string) => `${W}${normalizeWhatsapp(whatsapp)}.json`;

export async function getTrial(email: string): Promise<TrialRecord | null> {
  const rec = await getKv<TrialRecord>(keyFor(email));
  return rec && typeof rec.email === "string" ? rec : null;
}

export async function getTrialByDevice(deviceFp: string): Promise<TrialRecord | null> {
  if (!deviceFp) return null;
  const idx = await getKv<{ email?: string }>(devKeyFor(deviceFp));
  if (!idx || typeof idx.email !== "string") return null;
  const rec = await getTrial(idx.email);
  if (!rec) throw new Error("trial_index_inconsistent");
  return rec;
}

export async function getTrialByWhatsapp(whatsapp: string): Promise<TrialRecord | null> {
  const d = normalizeWhatsapp(whatsapp);
  if (!d) return null;
  const idx = await getKv<{ email?: string }>(waKeyFor(d));
  if (!idx || typeof idx.email !== "string") return null;
  const rec = await getTrial(idx.email);
  if (!rec) throw new Error("trial_index_inconsistent");
  return rec;
}

export async function listTrials(): Promise<TrialRecord[]> {
  const rows = await listKv(P);
  return rows.map((r) => r.value as TrialRecord).filter((v) => v && typeof v.email === "string");
}

/** كل التجارب النشطة التي انتهت مدتها (للمهمة المجدولة). */
export async function expiredTrials(): Promise<TrialRecord[]> {
  const now = Date.now();
  const all = await listTrials();
  return all.filter((t) => {
    if (t.status !== "active") return false;
    try {
      return now > new Date(t.expiresAt).getTime();
    } catch {
      return true;
    }
  });
}

export interface CreateTrialInput {
  email: string;
  whatsapp: string;
  deviceFp: string;
  slug: string;
}

export async function createTrial(input: CreateTrialInput, publication?: { product: Product; meta: PublishMeta }): Promise<TrialRecord> {
  const now = new Date();
  const rec: TrialRecord = {
    email: norm(input.email),
    whatsapp: normalizeWhatsapp(input.whatsapp),
    deviceFp: input.deviceFp,
    slug: input.slug,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + TRIAL_HOURS * 3600_000).toISOString(),
    status: "active",
    burnedAt: null,
    deletedAt: null,
    convertedAt: null,
  };
  const rows: { key: string; value: unknown }[] = [
    { key: keyFor(rec.email), value: rec },
    { key: devKeyFor(rec.deviceFp), value: { email: rec.email, slug: rec.slug } },
    { key: waKeyFor(rec.whatsapp), value: { email: rec.email, slug: rec.slug } },
  ];
  if (publication) {
    rows.push(
      { key: `published/${rec.slug}.json`, value: publication.product },
      { key: `published-meta/${rec.slug}.json`, value: { ...publication.meta, trialUntil: rec.expiresAt } },
    );
  }
  if (!(await insertKvMany(rows))) throw new Error("trial_conflict");
  return rec;
}

async function patch(email: string, patch: Partial<TrialRecord>): Promise<TrialRecord | null> {
  const cur = await getTrial(email);
  if (!cur) return null;
  const next: TrialRecord = { ...cur, ...patch };
  await setKv(keyFor(email), next);
  return next;
}

/**
 * كنس التجارب المنتهية — للمهمة المجدولة.
 * يحرق الروابط المنتهية التي **لم يزرها أحد** (وإلا بقيت في القاعدة بلا فائدة).
 * الحرق الكسول في `/p/<slug>` يتولّى الزيارات الفعلية فوراً.
 */
export async function sweepExpiredTrials(): Promise<string[]> {
  const list = await expiredTrials();
  const burned: string[] = [];
  for (const t of list) {
    try {
      const r = await burnTrial(t.email);
      if (r) burned.push(t.email);
    } catch {
      // نتجاهل فشل عنصر واحد ونكمل البقية
    }
  }
  return burned;
}

/** حرق: حذف بيانات المنتج نهائياً + تعليم السجل. السجل نفسه يبقى. */
export async function burnTrial(email: string): Promise<TrialRecord | null> {
  const cur = await getTrial(email);
  if (!cur) return null;
  if (cur.status === "converted") throw new Error("converted");
  // لا نغيّر الحالة إلا بعد نجاح الحذف؛ عند فشله يبقى السجل قابلاً لإعادة المحاولة.
  await deletePublishedProduct(cur.slug);
  return patch(email, {
    status: "burned",
    burnedAt: new Date().toISOString(),
  });
}

/** حذف يدوي من الڤيست قبل انتهاء المدة — لا رابط جديد بعده. */
export async function deleteTrialByUser(email: string): Promise<TrialRecord | null> {
  const cur = await getTrial(email);
  if (!cur) return null;
  if (cur.status === "converted") throw new Error("converted");
  await deletePublishedProduct(cur.slug);
  return patch(email, {
    status: "deleted",
    deletedAt: new Date().toISOString(),
  });
}

/** التحويل لدائم: الأدمن عيّن اشتراكاً ⇒ الرابط يصبح دائماً. */
export async function convertTrial(email: string): Promise<TrialRecord | null> {
  return patch(email, { status: "converted", convertedAt: new Date().toISOString() });
}

/**
 * استثناء إداري نادر: تحرير إيميل/جهاز محجوز بالخطأ.
 * ⚠️ يحذف السجل بالكامل ⇒ يسمح بتجربة جديدة. للأدمن فقط.
 */
export async function releaseTrial(email: string): Promise<boolean> {
  const cur = await getTrial(email);
  if (!cur) return false;
  // لا نحرّر هويات صفحة نشطة أو محوّلة ونترك منتجاً يتيماً.
  if (cur.status !== "burned" && cur.status !== "deleted") throw new Error("trial_not_releasable");
  await deleteKvMany([keyFor(email), devKeyFor(cur.deviceFp), waKeyFor(cur.whatsapp)]);
  return true;
}
