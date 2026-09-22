// سكريبت يُحقن في <head> لمنع وميض التحميل (FOUC) للوضع الليلي.
// يقرأ التفضيل المحفوظ ويطبّق صنف .dark على <html> قبل رسم الصفحة.
// يوضع عبر <script dangerouslySetInnerHTML> في التخطيط الجذر.

export const themeNoFlashScript = `
(function() {
  try {
    var k = "spectre-theme";
    var v = localStorage.getItem(k);
    var pref = (v === "light" || v === "dark" || v === "system") ? v : "system";
    var dark = pref === "dark" ||
      (pref === "system" &&
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (dark) document.documentElement.classList.add("dark");
  } catch (e) {}
})();
`;
