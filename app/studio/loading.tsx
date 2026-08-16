// شاشة تحميل فورية لصفحة الاستوديو — تُعرض أثناء تنزيل حزمة المسار الضخمة
// كي يرى المستخدم هيكلاً فورياً بدل شاشة بيضاء/تجمّد (علاج ثقل التنقّل).
export default function StudioLoading() {
  return (
    <main className="min-h-screen bg-ivory-50 text-navy-900 dark:bg-[#0d1117] dark:text-ivory-50">
      <div className="container-landing py-16">
        <div className="mx-auto max-w-3xl">
          {/* هيكل الترويسة */}
          <div className="h-9 w-48 animate-pulse rounded-full bg-navy-900/10 dark:bg-white/10" />
          {/* هيكل لوحة المحرّر + المعاينة */}
          <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
            <div className="space-y-4 rounded-3xl border border-navy-900/10 p-5 dark:border-white/10">
              <div className="h-8 w-1/2 animate-pulse rounded-xl bg-navy-900/10 dark:bg-white/10" />
              <div className="h-24 w-full animate-pulse rounded-2xl bg-navy-900/10 dark:bg-white/10" />
              <div className="h-24 w-full animate-pulse rounded-2xl bg-navy-900/10 dark:bg-white/10" />
              <div className="h-12 w-full animate-pulse rounded-xl bg-navy-900/10 dark:bg-white/10" />
            </div>
            <div className="overflow-hidden rounded-3xl border border-navy-900/10 p-5 dark:border-white/10">
              <div className="mx-auto h-64 w-full max-w-md animate-pulse rounded-2xl bg-navy-900/10 dark:bg-white/10" />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
