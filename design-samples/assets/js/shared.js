/* =========================================================
   shared.js — الثيم + اللغة + عين كلمة المرور
   يُحمَّل في <head> بلا defer (تطبيق فوري قبل الرسم = لا وميض).
   الآلية مطابقة لكود الهوية: data-en/data-ar + data-*-ph
   مع قلب الاتجاه، وحفظ الاختيار في localStorage (كما المشروع).
   ========================================================= */
(function () {
  var THEME_KEY = "spectre-sample-theme";
  var LANG_KEY = "landing-studio-lang"; /* نفس مفتاح المشروع الحقيقي */
  var root = document.documentElement;

  /* 1) قبل الرسم: طبّق المحفوظ فوراً */
  var theme = null, lang = null;
  try {
    theme = localStorage.getItem(THEME_KEY);
    lang = localStorage.getItem(LANG_KEY);
  } catch (e) {}
  if (theme === "dark") root.setAttribute("data-theme", "dark");
  if (lang !== "ar" && lang !== "en") lang = "en"; /* افتراضي المشروع للزائر الجديد */
  root.lang = lang;
  root.dir = lang === "ar" ? "rtl" : "ltr";

  /* 2) اللغة — نصوص/placeholder/title/aria (عناصر ورقية فقط!) */
  function applyLang(l) {
    root.lang = l;
    root.dir = l === "ar" ? "rtl" : "ltr";
    document.querySelectorAll("[data-en]").forEach(function (el) {
      var v = el.getAttribute("data-" + l);
      if (v != null) el.textContent = v;
    });
    document.querySelectorAll("[data-en-ph]").forEach(function (el) {
      var v = el.getAttribute("data-" + l + "-ph");
      if (v != null) el.placeholder = v;
    });
    document.querySelectorAll("[data-en-title]").forEach(function (el) {
      var v = el.getAttribute("data-" + l + "-title");
      if (v != null) el.title = v;
    });
    document.querySelectorAll("[data-en-aria]").forEach(function (el) {
      var v = el.getAttribute("data-" + l + "-aria");
      if (v != null) el.setAttribute("aria-label", v);
    });
    var lb = document.getElementById("langBtn");
    if (lb) lb.textContent = l === "en" ? "AR" : "EN";
    try { localStorage.setItem(LANG_KEY, l); } catch (e) {}
    document.dispatchEvent(new CustomEvent("sample:lang", { detail: { lang: l } }));
  }

  /* 3) الثيم — data-theme + قمر/شمس (كما كود الهوية) */
  function applyTheme(dark) {
    if (dark) root.setAttribute("data-theme", "dark");
    else root.removeAttribute("data-theme");
    var icon = document.querySelector("#themeBtn i");
    if (icon) {
      icon.classList.toggle("fa-moon", !dark);
      icon.classList.toggle("fa-sun", dark);
    }
    try { localStorage.setItem(THEME_KEY, dark ? "dark" : "light"); } catch (e) {}
    document.dispatchEvent(new CustomEvent("sample:theme", { detail: { dark: dark } }));
  }

  document.addEventListener("DOMContentLoaded", function () {
    applyTheme(root.getAttribute("data-theme") === "dark");
    applyLang(root.lang === "ar" ? "ar" : "en");

    var tb = document.getElementById("themeBtn");
    if (tb) tb.addEventListener("click", function () {
      applyTheme(root.getAttribute("data-theme") !== "dark");
    });
    var lb = document.getElementById("langBtn");
    if (lb) lb.addEventListener("click", function () {
      applyLang(root.lang === "en" ? "ar" : "en");
    });

    /* 4) عين كلمة المرور — تفويض عام يعمل على أي حقل */
    document.addEventListener("click", function (e) {
      var t = e.target && e.target.closest ? e.target.closest(".toggle-password") : null;
      if (!t) return;
      var group = t.closest(".input-group");
      if (!group) return;
      var inp = group.querySelector("input");
      if (!inp) return;
      var show = inp.type === "password";
      inp.type = show ? "text" : "password";
      t.classList.toggle("fa-eye", !show);
      t.classList.toggle("fa-eye-slash", show);
    });

    /* 5) شريط المراجعة: زر تصغير/توسيع (أداة مراجعة فقط — ليس من التصميم) */
    document.querySelectorAll(".review-bar").forEach(function (bar) {
      if (bar.querySelector(".rb-toggle")) return;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "rb-toggle";
      btn.title = "Minimize review tool";
      btn.innerHTML = '<i class="fa-solid fa-minus"></i>';
      btn.addEventListener("click", function () {
        var collapsed = bar.classList.toggle("is-collapsed");
        btn.innerHTML = collapsed ? '<i class="fa-solid fa-plus"></i>' : '<i class="fa-solid fa-minus"></i>';
        btn.title = collapsed ? "Expand review tool" : "Minimize review tool";
      });
      bar.appendChild(btn);
    });
  });

  /* واجهة برمجية صغيرة للعينات التي تغيّر نصوصاً ديناميكياً */
  window.SampleUI = {
    applyLang: applyLang,
    applyTheme: applyTheme,
    lang: function () { return root.lang === "ar" ? "ar" : "en"; },
    /* حدّث نص عنصر ثنائي اللغة من JS (يكتب السمتين + النص الحالي) */
    setText: function (el, en, ar) {
      if (!el) return;
      el.setAttribute("data-en", en);
      el.setAttribute("data-ar", ar);
      el.textContent = root.lang === "ar" ? ar : en;
    }
  };
})();
