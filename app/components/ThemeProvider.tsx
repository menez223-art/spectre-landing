"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

// مفتاح التخزين المحلي لتفضيل الوضع الليلي
const STORAGE_KEY = "spectre-theme";

export type ThemePref = "light" | "dark" | "system";

interface ThemeContextValue {
  // التفضيل المختار صراحةً (light/dark/system)
  pref: ThemePref;
  // هل الوضع الليلي مفعّل فعلياً الآن؟
  isDark: boolean;
  setPref: (p: ThemePref) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  pref: "system",
  isDark: false,
  setPref: () => {},
  toggle: () => {},
});

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

// يقرأ التفضيل من localStorage (آمن في المتصفح فقط)
function readPref(): ThemePref {
  if (typeof window === "undefined") return "system";
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    // تجاهل
  }
  return "system";
}

// هل النظام يفضّل الوضع الداكن؟
function systemPrefersDark(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

// يطبّق الصنف dark على <html> بحسب التفضيل
function applyPref(pref: ThemePref) {
  if (typeof document === "undefined") return;
  const dark = pref === "dark" || (pref === "system" && systemPrefersDark());
  document.documentElement.classList.toggle("dark", dark);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>("system");
  const [isDark, setIsDark] = useState(false);

  // تهيئة عند التركيب (تُكمّل ما بدأه سكريبت منع الوميض)
  useEffect(() => {
    const p = readPref();
    setPrefState(p);
    applyPref(p);
    setIsDark(
      p === "dark" || (p === "system" && systemPrefersDark())
    );

    // متابعة تغيّر تفضيل النظام إن كان التفضيل "system"
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (readPref() === "system") {
        applyPref("system");
        setIsDark(systemPrefersDark());
      }
    };
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  const setPref = useCallback((p: ThemePref) => {
    setPrefState(p);
    try {
      window.localStorage.setItem(STORAGE_KEY, p);
    } catch {
      // تجاهل
    }
    applyPref(p);
    setIsDark(p === "dark" || (p === "system" && systemPrefersDark()));
  }, []);

  const toggle = useCallback(() => {
    // بدّل بين الفاتح والداكن مباشرة (يتجاوز "system")
    setPref(isDark ? "light" : "dark");
  }, [isDark, setPref]);

  return (
    <ThemeContext.Provider value={{ pref, isDark, setPref, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}
