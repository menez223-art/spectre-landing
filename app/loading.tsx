// هيكل تحميل الرئيسية — يظهر لحظة التنقل كي يبدو الانتقال فورياً
export default function Loading() {
  return (
    <main className="min-h-screen bg-ivory-50 text-navy-900 dark:bg-[#0d1117] dark:text-ivory-50">
      <div className="container-landing py-16">
        <div className="mx-auto max-w-2xl space-y-4">
          <div className="h-8 w-40 animate-pulse rounded-full bg-navy-900/10 dark:bg-white/10" />
          <div className="h-14 w-full animate-pulse rounded-2xl bg-navy-900/10 dark:bg-white/10" />
          <div className="h-14 w-3/4 animate-pulse rounded-2xl bg-navy-900/10 dark:bg-white/10" />
          <div className="h-6 w-2/3 animate-pulse rounded-xl bg-navy-900/5 dark:bg-white/5" />
        </div>
        <div className="mt-12 grid max-w-xl grid-cols-3 gap-3 sm:gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-navy-900/10 dark:bg-white/10" />
          ))}
        </div>
      </div>
    </main>
  );
}
