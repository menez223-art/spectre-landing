// تخزين المنتجات المنشورة في Supabase Postgres — server-only
// بديل Vercel Blob المجاني والمستقر: لا فواتير ولا تعليق تلقائي.
// كل منتج = صف kv ببادئة published/؛ وبيانات الملكية صف منفصل (published-meta/)
// حتى لا يتسرّب البريد داخل JSON المنتج العام.

import { deleteKv, getKv, listKv, setKv, deleteKvMany } from "./kvStore";
import { type Product } from "./types";

if (typeof window !== "undefined") {
  throw new Error("publishStore.ts is server-only");
}

const BLOB_PREFIX = "published/";
const META_PREFIX = "published-meta/";

export function hasPublishStore(): boolean {
  return true; // KV معطّل دائماً متى توفرت بيئة Supabase
}

export interface PublishMeta {
  owner: string; // بريد المالك أو "device:<hash>" كسقوط
  createdAt: string;
  // علامة حرق/حظر مباشرة على المنشور — تُكتب عند حظر الأدمن للمستخدم
  // كي تتوقف الروابط فوراً 100% بغض النظر عن تطابق هوية الجهاز/البريد.
  banned?: boolean;
}

// قراءة منشور واحد عبر السلاگ
export async function getPublishedProduct(slug: string): Promise<Product | null> {
  try {
    const product = await getKv<Product>(`${BLOB_PREFIX}${slug}.json`);
    return product && typeof product.id === "string" ? product : null;
  } catch {
    return null;
  }
}

// حفظ منشور — صف JSON عام بمعرّف published/<slug>.json
export async function setPublishedProduct(product: Product): Promise<void> {
  await setKv(`${BLOB_PREFIX}${product.id}.json`, product);
}

// إلغاء نشر — حذف المنتج وملف الملكية معًا
export async function deletePublishedProduct(slug: string): Promise<boolean> {
  await deleteKvMany([`${BLOB_PREFIX}${slug}.json`, `${META_PREFIX}${slug}.json`]);
  return true;
}

// ── الملكية (بيانات خاصة — لا تُخزَّن داخل JSON المنتج العام) ──
export async function getPublishedOwner(slug: string): Promise<string | null> {
  try {
    const meta = await getKv<PublishMeta>(`${META_PREFIX}${slug}.json`);
    return typeof meta?.owner === "string" ? meta.owner : null;
  } catch {
    return null;
  }
}

export async function setPublishedMeta(slug: string, meta: PublishMeta): Promise<void> {
  await setKv(`${META_PREFIX}${slug}.json`, meta);
}

export async function getPublishedMeta(slug: string): Promise<PublishMeta | null> {
  try {
    const meta = await getKv<PublishMeta>(`${META_PREFIX}${slug}.json`);
    return meta && typeof meta.owner === "string" ? meta : null;
  } catch {
    return null;
  }
}

// عدّ الصفحات المملوكة لمالك واحد (بلا تحميل المنتجات — للأداء)
export async function countPublishedOwned(owner: string): Promise<number> {
  try {
    const rows = await listKv(META_PREFIX);
    return rows.filter((row) => (row.value as PublishMeta | null)?.owner === owner).length;
  } catch {
    return 0;
  }
}

// حذف كل صفحات المالك نهائياً من القاعدة (منتجات + ملفات ملكية) — لتفريغ التخزين.
// تُستخدم عند «حظر» المشرف لمستخدم، كي لا تبقى صفحاته وروابطه متاحة لأي زائر.
export async function deleteAllPublishedOwned(owner: string): Promise<number> {
  try {
    const entries = await listPublishedOwned(owner);
    if (entries.length === 0) return 0;
    const keys = entries.flatMap(({ slug }) => [
      `${BLOB_PREFIX}${slug}.json`,
      `${META_PREFIX}${slug}.json`,
    ]);
    await deleteKvMany(keys);
    return entries.length;
  } catch {
    return 0;
  }
}

// صفحات المالك الواحد
export async function listPublishedOwned(owner: string): Promise<{ slug: string; product: Product }[]> {
  try {
    const rows = await listKv(META_PREFIX);
    const ownedSlugs: string[] = [];
    for (const row of rows) {
      const meta = row.value as PublishMeta | null;
      if (meta?.owner === owner) {
        ownedSlugs.push(row.key.replace(META_PREFIX, "").replace(/\.json$/, ""));
      }
    }
    const entries = await Promise.all(
      ownedSlugs.map(async (slug) => {
        const product = await getPublishedProduct(slug);
        return product ? { slug, product } : null;
      })
    );
    return entries.filter((e): e is { slug: string; product: Product } => e !== null);
  } catch {
    return [];
  }
}

// يعيد إسناد كل منشورات مالك قديم (مثل هوية الجهاز) إلى مالك جديد (البريد).
export async function reassignOwner(fromOwner: string, toOwner: string): Promise<number> {
  if (fromOwner === toOwner) return 0;
  const entries = await listPublishedOwned(fromOwner);
  let count = 0;
  for (const { slug } of entries) {
    try {
      await setPublishedMeta(slug, { owner: toOwner, createdAt: new Date().toISOString() });
      count += 1;
    } catch {
      // تجاهل فشل ملف واحد
    }
  }
  return count;
}

// يجمع كل هويات الملكية المرتبطة ببريد: البريد نفسه + كل صيغ device:<hash>
// المستنتجة من ملفات التعريف المربوطة بهذا البريد. نعتمد على مسح شامل لكل
// ملفات التعريف (لا على deviceOwnersForEmail وحدها) كي لا تفوتنا أي هوية
// جهاز مهما اختلفت طريقة تخزين الـ hash — هذا يضمن تغطية 100% عند الحرق/الحذف.
export async function allOwnersForEmail(email: string): Promise<string[]> {
  const lower = email.toLowerCase();
  const owners = new Set<string>([lower]);
  try {
    const rows = await listKv("studio-auth/profiles/");
    for (const row of rows) {
      const profile = row.value as import("./profileStore").DeviceProfile | null;
      if (!profile?.email) continue;
      if (profile.email.toLowerCase() !== lower) continue;
      const fp = profile.fingerprint; // مُعدَّل بالـ pepper
      owners.add(`device:${fp.slice(0, 24)}`);
      owners.add(`device:${fp}`); // صيغة الهوية الكاملة تحسباً لأي تباين
    }
  } catch {
    // نبقي البريد كحدّ أدنى إن تعذّر المسح
  }
  return Array.from(owners);
}

// يحرق كل روابط ومنشورات مالك واحد: يكتب علامة banned:true على كل ملف ملكية
// كي تتوقف الصفحات فوراً لأي زائر (بغض النظر عن تطابق هوية الجهاز/البريد).
// هذا هو الحل القطعي لمشكلة «الروابط تستمر بعد الحظر» — لا يعتمد على إعادة
// الإسناد أو تطابق المفاتيح. الحذف الفعلي للبيانات يبقى في deleteAllPublishedOwned
// (يُستخدم عند الحذف النهائي). الحرق هنا قابل للاسترجاع عند إلغاء الحظر.
export async function burnPublishedOwned(owner: string): Promise<number> {
  try {
    const entries = await listPublishedOwned(owner);
    if (entries.length === 0) return 0;
    let count = 0;
    for (const { slug } of entries) {
      try {
        const meta = await getKv<PublishMeta>(`${META_PREFIX}${slug}.json`);
        await setPublishedMeta(slug, {
          owner,
          createdAt: meta?.createdAt ?? new Date().toISOString(),
          banned: true,
        });
        count += 1;
      } catch {
        // تجاهل فشل ملف واحد
      }
    }
    return count;
  } catch {
    return 0;
  }
}

// يرفع الحرق (عند إلغاء الحظر) — يزيل علامة banned من كل منشورات المالك.
export async function unburnPublishedOwned(owner: string): Promise<number> {
  try {
    const entries = await listPublishedOwned(owner);
    if (entries.length === 0) return 0;
    let count = 0;
    for (const { slug } of entries) {
      try {
        const meta = await getKv<PublishMeta>(`${META_PREFIX}${slug}.json`);
        await setPublishedMeta(slug, {
          owner,
          createdAt: meta?.createdAt ?? new Date().toISOString(),
          banned: false,
        });
        count += 1;
      } catch {
        // تجاهل فشل ملف واحد
      }
    }
    return count;
  } catch {
    return 0;
  }
}

// يحرق كل صفحات وروابط البريد عبر كل هوياته (البريد + كل صيغ device:hash).
// هذا هو المسار الجذري لمشكلة «الروابط تستمر بعد الحظر»: يغطّي كل المنشورات
// بغض النظر عن الهوية التي خُزّنت بها (بريد أو جهاز) — لا تفوت هوية واحدة.
// قابل للاسترجاع (يرفعه unburnAllForEmail عند إلغاء الحظر).
export async function burnAllForEmail(email: string): Promise<number> {
  const owners = await allOwnersForEmail(email);
  let total = 0;
  for (const owner of owners) {
    total += await burnPublishedOwned(owner);
  }
  return total;
}

// يرفع الحرق عن كل صفحات البريد عبر كل هوياته (عند إلغاء الحظر).
export async function unburnAllForEmail(email: string): Promise<number> {
  const owners = await allOwnersForEmail(email);
  let total = 0;
  for (const owner of owners) {
    total += await unburnPublishedOwned(owner);
  }
  return total;
}

// يحذف كل صفحات وروابط البريد عبر كل هوياته (البريد + كل صيغ device:hash)
// نهائياً من القاعدة — لا يمكن الاسترجاع. يُستخدم عند الحذف النهائي للمستخدم.
export async function deleteAllForEmail(email: string): Promise<number> {
  const owners = await allOwnersForEmail(email);
  let total = 0;
  for (const owner of owners) {
    total += await deleteAllPublishedOwned(owner);
  }
  return total;
}

// كل المنشورات
export async function listPublishedProducts(): Promise<{ slug: string; product: Product }[]> {
  try {
    const rows = await listKv(BLOB_PREFIX);
    const entries = rows
      .map((row) => {
        const product = row.value as Product | null;
        if (!product || typeof product.id !== "string") return null;
        const slug = row.key.replace(BLOB_PREFIX, "").replace(/\.json$/, "");
        return { slug, product };
      })
      .filter((e): e is { slug: string; product: Product } => e !== null);
    return entries;
  } catch {
    return [];
  }
}
