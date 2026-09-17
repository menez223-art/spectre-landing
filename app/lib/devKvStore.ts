// تخزين KV محلي للتطوير — server only
// ملف JSON واحد يحاكي جدول kv في Supabase حصرياً على localhost حين تكون
// مفاتيح Supabase غائبة. يُستخدم للتجربة الكاملة لدخول الاستوديو وربط
// الإيميل دون لمس قاعدة الإنتاج. لا يُقرأ في Vercel (المفاتيح موجودة هناك).

import fs from "fs";
import path from "path";

if (typeof window !== "undefined") {
  throw new Error("devKvStore.ts is server-only");
}

const DEV_KV_DIR = path.join(process.cwd(), ".dev-kv");
const DEV_KV_FILE = path.join(DEV_KV_DIR, "kv.json");

interface DevKvData {
  [key: string]: unknown;
}

let cache: DevKvData | null = null;
let loaded = false;

function load(): DevKvData {
  if (loaded && cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(DEV_KV_FILE, "utf8")) as DevKvData;
  } catch {
    cache = {};
  }
  loaded = true;
  return cache!;
}

function persist(): void {
  try {
    if (!fs.existsSync(DEV_KV_DIR)) fs.mkdirSync(DEV_KV_DIR, { recursive: true });
    fs.writeFileSync(DEV_KV_FILE, JSON.stringify(cache ?? {}, null, 0), "utf8");
  } catch (err) {
    console.error("[devKvStore] فشل الحفظ:", err);
    throw err;
  }
}

// تهيئة الملف مرة واحدة — تُستدعى من kvStore عند الإقلاع.
export function initDevKv(): void {
  try {
    load();
  } catch {
    // لا تُفشل الإقلاع — أول كتابة تنشئ الملف
  }
}

export async function getDevKv<T = unknown>(key: string): Promise<T | null> {
  const data = load();
  const v = data[key];
  return (v === undefined ? null : (v as T)) ?? null;
}

export async function setDevKv(key: string, value: unknown): Promise<void> {
  const data = load();
  data[key] = value;
  persist();
}

export async function deleteDevKv(key: string): Promise<void> {
  const data = load();
  delete data[key];
  persist();
}

export async function listDevKv(prefix: string): Promise<{ key: string; value: unknown }[]> {
  const data = load();
  return Object.keys(data)
    .filter((k) => k.startsWith(prefix))
    .sort()
    .map((k) => ({ key: k, value: data[k] }));
}

export async function listDevKvKeys(prefix: string): Promise<string[]> {
  const data = load();
  return Object.keys(data).filter((k) => k.startsWith(prefix)).sort();
}

export async function deleteDevKvMany(keys: string[]): Promise<void> {
  const data = load();
  for (const k of keys) delete data[k];
  persist();
}

// بلا await بين الفحص والحفظ: عملية محلية واحدة، مع استعادة الذاكرة عند الفشل.
export async function insertDevKvMany(rows: { key: string; value: unknown }[]): Promise<boolean> {
  const data = load();
  const keys = rows.map((row) => row.key);
  if (new Set(keys).size !== keys.length || keys.some((key) => key in data)) return false;
  const previous = cache;
  cache = { ...data, ...Object.fromEntries(rows.map((row) => [row.key, row.value])) };
  try {
    persist();
  } catch (error) {
    cache = previous;
    throw error;
  }
  return true;
}

