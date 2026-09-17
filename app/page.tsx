import { unstable_cache } from "next/cache";
import { LocaleProvider } from "@/app/components/LocaleProvider";
import { HomeClient } from "@/app/components/HomeClient";
import { getSiteCopy } from "@/app/lib/siteCopy";

// الرئيسية — غلاف **خادم** يقرأ تجاوزات النصوص من القاعدة ويمرّرها لمزوّد اللغة.
//
// لماذا غلاف؟ كي تُقرأ التجاوزات قبل أول رسم ⇒ **لا وميض** نص افتراضي.
//
// ⚠️ `revalidate` وحده **لا يكفي**: قراءة KV تمرّ بـ`fetch` غير مُخزَّن، فيُصنَّف
//    المسار ديناميكياً (استدعاء دالة لكل زيارة). لذلك نغلّف القراءة بـ
//    `unstable_cache` ⇒ البيانات تُخزَّن ٦٠ ثانية، والصفحة **تُبنى مسبقاً**.
//    النتيجة: صفر كلفة على Vercel، وتعديل المالك يظهر خلال دقيقة.
//
// بقية المسارات (/pricing · /store · /studio) ثابتة كما كانت — لا تتأثر.
export const revalidate = 60;

const getCachedSiteCopy = unstable_cache(getSiteCopy, ["site-copy"], { revalidate: 60 });

export default async function HomePage() {
  const overrides = await getCachedSiteCopy();
  return (
    <LocaleProvider overrides={overrides}>
      <HomeClient />
    </LocaleProvider>
  );
}
