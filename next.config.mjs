/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { unoptimized: true },
  // منع كاش fetch على مستوى البناء بالكامل: Next.js Data Cache يكاشف
  // استدعاءات fetch افتراضياً (force-cache)، بما فيها قراءات Supabase
  // (SELECT)، مما يجمّد حالة الحظر/الاشتراك ويبقي المستخدم المحظور
  // داخل الاستوديو رغم حظره. فرض no-store يضمن قراءة الطلب الحي دائماً.
  experimental: {
    fetchCache: "force-no-store",
  },
};

export default nextConfig;
