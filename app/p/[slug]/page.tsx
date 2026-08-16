import { cache } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PRODUCTS } from "@/app/data/products";
import { formatDZD } from "@/app/data/delivery";
import { getPublishedProduct, getPublishedOwner, getPublishedMeta } from "@/app/lib/publishStore";
import { recomputeStatus } from "@/app/lib/subsStore";
import { resolveOwnerEmail } from "@/app/lib/profileStore";
import { withResolvedWebhook } from "@/app/lib/sheetResolver";
import { bumpBandwidth } from "@/app/lib/statsStore";
import { githubPagesUrl } from "@/app/lib/githubPages";
import { ProductPage } from "@/app/components/landing/ProductPage";

// السلاگز غير المدرجة في generateStaticParams (مثل المنتجات المنشورة) تُعرض عند الطلب
export const dynamicParams = true;

// دائماً أحدث نسخة منشورة — لا تخزّن الصفحة مؤقتاً حتى تنعكس تغييرات الستوديو فوراً
// (أسعار التوصيل المخصّصة وغيرها من إعدادات المنتج)
export const dynamic = "force-dynamic";

// قراءة المنشور مخزَّنة مؤقتاً لكل طلب — تُستدعى في generateMetadata والصفحة
// فلا نقرأ نفس ملف Blob مرتين (كانت قراءة مزدوجة = مضيعة لزمن شبكة).
const getPublishedCached = cache((slug: string) => getPublishedProduct(slug));

// صفحات ثابتة للمنتجات الدائمة (PRODUCTS) عند البناء
export function generateStaticParams() {
  return PRODUCTS.map((product) => ({ slug: product.id }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const staticProduct = PRODUCTS.find((p) => p.id === params.slug);
  if (staticProduct) {
    return {
      title: `${staticProduct.name} | ${formatDZD(staticProduct.price)} — التوصيل لـ 58 ولاية`,
      description: staticProduct.description,
    };
  }

  // منتج منشور — نقرأه خادمياً حتى يقرأ زاحف فيسبوك العنوان والوصف من HTML
  const published = await getPublishedCached(params.slug);
  if (!published) {
    return { title: "منتج | استوديو صفحات الهبوط" };
  }

  const ogImage = /^https?:\/\//.test(published.image) ? [published.image] : [];
  return {
    title: `${published.name} | ${formatDZD(published.price)} — التوصيل لـ 58 ولاية`,
    description: published.description,
    ...(ogImage.length ? { openGraph: { images: ogImage } } : {}),
  };
}

// لا نستدعي notFound() هنا للسلاگز المجهولة — قد يكون المنتج مولّداً في المتصفح
// أو منشوراً في Blob؛ سلك الـ 404 يبقى داخل ProductPage حتى لا يكسر تجاوز localStorage.

// صفحة حجب موحّدة: تُعرض لأي زائر عند حظر/توقيف المالك أو تعذّر التحقق.
function renderBlocked(slug: string, status: "banned" | "suspended") {
  const banned = status === "banned";
  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-center text-white">
      <div>
        <p className="font-display text-6xl font-extrabold text-white/15">{banned ? "محظور" : "متوقفة"}</p>
        <h1 className="mt-4 font-display text-3xl font-extrabold">
          {banned ? "هذا الحساب محظور" : "هذه الصفحة متوقفة مؤقتاً"}
        </h1>
        <p className="mt-3 text-sm text-white/50">
          {banned
            ? "لا يمكنك الشراء حالياً — تم تجميد هذا الحساب من قِبَل الإدارة. للاستفسار تواصل مع الدعم."
            : "تم إيقاف عرض هذه الصفحة من قِبَل الإدارة. ستعود للعمل قريباً."}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a
            href="/"
            className="rounded-full bg-white px-6 py-3 text-sm font-bold text-slate-950 transition hover:bg-white/80"
          >
            العودة إلى الفهرس
          </a>
        </div>
      </div>
    </main>
  );
}

export default async function ProductSlugPage({ params }: { params: { slug: string } }) {
  const staticProduct = PRODUCTS.find((p) => p.id === params.slug) ?? null;
  // فرع مبكر للمنتجات الثابتة — لا اتصال بالتخزين أثناء بنائها (تبقى SSG)
  if (staticProduct) return <ProductPage slug={params.slug} staticProduct={staticProduct} />;

  // حماية قطعية أولاً: علامة «banned» المكتوبة مباشرة على ملف المنشور
  // (عند حظر الأدمن) — يجب أن تُعالَج قبل أي توجيه/عرض، بغض النظر عن مكان الاستضافة.
  let meta: Awaited<ReturnType<typeof getPublishedMeta>> = null;
  try {
    meta = await getPublishedMeta(params.slug);
  } catch {
    // تعذّر القراءة — نعتبر الصفحة محجوبة احتياطياً (fail-closed)
    return renderBlocked(params.slug, "banned");
  }
  if (meta?.banned) {
    return renderBlocked(params.slug, "banned");
  }

  // توجيه الاحتياط: إن كان المنشور مُستضافاً على GitHub Pages (وضع الاحتياط
  // مفعّل وقت نشره) نعيد توجيه الزائر إلى رابطه هناك — كي لا نستهلك سعة/استدعاءات
  // Vercel. الرابط الجديد يُسلَّم للمستخدم عند إعادة النشر؛ لا نصوص توضيحية.
  if (meta?.host === "github") {
    const ghUrl = githubPagesUrl(params.slug);
    if (ghUrl) redirect(ghUrl);
    // github غير مضبوط رغم host=github → نسقط لهذا الفرع ونعرض العادي أدناه
  }

  const published = await getPublishedCached(params.slug);
  // المنشور محجوب/موقوف؟ نمنع عرضه لأي زائر. نتحقق من حالة اشتراك المالك خادمياً.
  // ملاحظة: حماية «banned» المباشرة على المنشور عولجت أعلاه (قبل التوجيه) — نعيد
  // هنا فحص حالة اشتراك المالك فقط، دون جلب الميتا مجدداً.
  if (published) {
    let owner: string | null = null;
    try {
      owner = await getPublishedOwner(params.slug);
    } catch {
      // تعذّر قراءة الملكية — نحترق احتياطياً: نعتبر الصفحة محجوبة
      // (fail-closed) كي لا تُعرض صفحة مستخدم قد يكون محظوراً. هذا يمنع
      // التفاف الحظر عبر تعطيل التخزين مؤقتاً.
      return renderBlocked(params.slug, "banned");
    }

    if (owner) {
      // فحص احتياطي عبر حالة اشتراك المالك/الإيميل المستنتَج (متوافق مع ما كان سابقاً)
      const idsToCheck = new Set<string>([owner]);
      const resolved = await resolveOwnerEmail(owner);
      if (resolved) idsToCheck.add(resolved);
      let blocked: { status: "banned" | "suspended" } | null = null;
      for (const id of Array.from(idsToCheck)) {
        try {
          const sub = await recomputeStatus(id);
          if (sub && (sub.status === "banned" || sub.status === "suspended")) {
            blocked = { status: sub.status };
            break;
          }
        } catch {
          // فشل قراءة اشتراك هوية واحدة — نعتبرها محجوبة احتياطياً (fail-closed)
          blocked = { status: "banned" };
          break;
        }
      }
      if (blocked) {
        return renderBlocked(params.slug, blocked.status);
      }
    }
  }
  // حلّ رابط الجدول الحيّ ديناميكياً (يتعافى تلقائياً بعد أي إعادة نشر في Apps Script)
  const resolved = published ? await withResolvedWebhook(published) : null;

  // تتبّع السعة: نعدّ بايتات الصفحة المخدومة فعلياً (المنتج بصوره المضمّنة data URL
  // هو التقدير الأقرب لحجم HTML المولّد). نُطلقه دون انتظار كي لا نبطئ الاستجابة.
  if (published) {
    const bytes = Buffer.byteLength(JSON.stringify(published), "utf-8");
    void bumpBandwidth(bytes);
  }

  return <ProductPage slug={params.slug} staticProduct={resolved} />;
}
