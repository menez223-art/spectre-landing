// هيكل تحميل صفحة التسعير — يظهر لحظة التنقل كي يبدو الانتقال فورياً
export default function Loading() {
  return (
    <main className="min-h-screen bg-ivory-50 text-navy-900 dark:bg-[#0d1117] dark:text-ivory-50">
      <div className="container-landing py-16">
        <div className="mx-auto max-w-xl space-y-4 text-center">
          <div className="mx-auto h-8 w-48 animate-pulse rounded-full bg-navy-900/10 dark:bg-white/10" />
          <div className="mx-auto h-12 w-full max-w-md animate-pulse rounded-2xl bg-navy-900/10 dark:bg-white/10" />
        </div>
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-80 animate-pulse rounded-[2rem] border border-navy-900/10 bg-white/60 shadow-sm dark:border-white/10 dark:bg-[#11161d]" />
          ))}
        </div>
      </div>
    </main>
  );
}
