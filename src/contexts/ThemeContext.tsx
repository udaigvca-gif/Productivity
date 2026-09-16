import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { ThemePalette } from '../types';
import { themes, DEFAULT_THEME } from '../themes';

interface ThemeContextType {
  theme: ThemePalette;
  setTheme: (id: string) => void;
  allThemes: ThemePalette[];
}

const ThemeContext = createContext<ThemeContextType>({
  theme: DEFAULT_THEME,
  setTheme: () => {},
  allThemes: themes,
});

export const useTheme = () => useContext(ThemeContext);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePalette>(DEFAULT_THEME);

  useEffect(() => {
    const saved = localStorage.getItem('taskflow_theme_id');
    if (saved) {
      const found = themes.find((t) => t.id === saved);
      if (found) setThemeState(found);
    }
  }, []);

  const setTheme = (id: string) => {
    const found = themes.find((t) => t.id === id);
    if (found) {
      setThemeState(found);
      localStorage.setItem('taskflow_theme_id', id);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, allThemes: themes }}>
      {children}
    </ThemeContext.Provider>
  );
}
