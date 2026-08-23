'use client';

import { useEffect, useState } from 'react';

const themes = [
  { id: 'default', name: 'أخضر', primary: '#10b981', secondary: '#0d9488' },
  { id: 'blue', name: 'أزرق', primary: '#3b82f6', secondary: '#2563eb' },
  { id: 'purple', name: 'بنفسجي', primary: '#8b5cf6', secondary: '#7c3aed' },
  { id: 'rose', name: 'وردي', primary: '#f43f5e', secondary: '#e11d48' },
  { id: 'orange', name: 'برتقالي', primary: '#f97316', secondary: '#ea580c' },
  { id: 'cyan', name: 'سماوي', primary: '#06b6d4', secondary: '#0891b2' },
];

export function ThemeSelector() {
  const [currentTheme, setCurrentTheme] = useState('default');
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('spectre-theme');
    if (saved) {
      setCurrentTheme(saved);
      document.documentElement.setAttribute('data-theme', saved);
    }
  }, []);

  const handleThemeChange = (themeId: string) => {
    setCurrentTheme(themeId);
    if (themeId === 'default') {
      document.documentElement.removeAttribute('data-theme');
      localStorage.removeItem('spectre-theme');
    } else {
      document.documentElement.setAttribute('data-theme', themeId);
      localStorage.setItem('spectre-theme', themeId);
    }
    setIsOpen(false);
  };

  const current = themes.find(t => t.id === currentTheme) || themes[0];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-navy-900/10 bg-white/50 transition hover:border-navy-900/20 hover:bg-white dark:border-white/10 dark:bg-white/5"
        aria-label="تغيير الألوان"
        title="تغيير الألوان"
      >
        <div
          className="h-5 w-5 rounded-full"
          style={{
            background: `linear-gradient(135deg, ${current.primary} 50%, ${current.secondary} 50%)`,
          }}
        />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute end-0 top-full z-50 mt-2 w-48 rounded-xl border border-navy-900/10 bg-white p-2 shadow-xl dark:border-white/10 dark:bg-[#161b22]">
            <p className="mb-2 px-2 text-xs font-semibold text-navy-500 dark:text-navy-300">
              اختر لونك المفضل
            </p>
            {themes.map((theme) => (
              <button
                key={theme.id}
                onClick={() => handleThemeChange(theme.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm transition ${
                  currentTheme === theme.id
                    ? 'bg-navy-900/5 dark:bg-white/10'
                    : 'hover:bg-navy-900/5 dark:hover:bg-white/5'
                }`}
              >
                <div
                  className="h-5 w-5 rounded-full"
                  style={{
                    background: `linear-gradient(135deg, ${theme.primary} 50%, ${theme.secondary} 50%)`,
                  }}
                />
                <span className="text-navy-700 dark:text-navy-200">{theme.name}</span>
                {currentTheme === theme.id && (
                  <svg className="me-auto h-4 w-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}