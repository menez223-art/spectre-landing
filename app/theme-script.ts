// سكريبت يُحقن في <head> لمنع وميض التحميل (FOUC) للوضع الليلي ولون النغمة.
// يقرأ التفضيل المحفوظ ويطبّق صنف .dark وسمة data-theme على <html> قبل رسم الصفحة.
// يوضع عبر <script dangerouslySetInnerHTML> في التخطيط الجذر.

export const themeNoFlashScript = `
(function() {
  try {
    // 1. وضع الإضاءة (فاتح / داكن)
    var k = "spectre-theme";
    var v = localStorage.getItem(k);
    var pref = (v === "light" || v === "dark" || v === "system") ? v : "system";
    var dark = pref === "dark" ||
      (pref === "system" &&
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (dark) document.documentElement.classList.add("dark");

    // 2. لون النغمة المخصصة (emerald, blue, purple, rose, orange, cyan)
    var ak = "spectre-accent-theme";
    var av = localStorage.getItem(ak);
    if (av && av !== "default") {
      document.documentElement.setAttribute("data-theme", av);
    }
  } catch (e) {}
})();
`;