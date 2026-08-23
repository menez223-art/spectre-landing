'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type ThemeColors = {
  primary: string;
  secondary: string;
};

export type UserTheme = {
  primary: string;
  secondary: string;
  isCustom: boolean;
};

interface ThemeContextValue {
  theme: UserTheme;
  setTheme: (theme: UserTheme) => void;
  resetToDefault: () => void;
}

const defaultTheme: UserTheme = {
  primary: '#10b981', // emerald-500
  secondary: '#0d9488', // teal-600
  isCustom: false,
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<UserTheme>(defaultTheme);

  const setTheme = useCallback((newTheme: UserTheme) => {
    setThemeState(newTheme);
  }, []);

  const resetToDefault = useCallback(() => {
    setThemeState(defaultTheme);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resetToDefault }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeStore() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeStore must be used within a ThemeProvider');
  }
  return context;
}