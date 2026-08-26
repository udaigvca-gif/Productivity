import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { storage } from '@/src/utils/storage';

export interface ThemePalette {
  id: string;
  name: string;
  emoji: string;
  // Main gradient for headers
  gradient: [string, string];
  // Primary color (buttons, accents)
  primary: string;
  // Secondary color
  secondary: string;
  // Tasks tab gradient
  tasksGradient: [string, string];
  // Habits tab gradient  
  habitsGradient: [string, string];
  // Time entry tab gradient
  timeGradient: [string, string];
  // Profile tab gradient
  profileGradient: [string, string];
  // Login screen gradient
  loginGradient: [string, string, string];
}

export const themes: ThemePalette[] = [
  {
    id: 'sunset',
    name: 'Sunset Vibes',
    emoji: '🌅',
    gradient: ['#FF6B9D', '#FFA07A'],
    primary: '#FF6B9D',
    secondary: '#C766EF',
    tasksGradient: ['#FF6B9D', '#FFA07A'],
    habitsGradient: ['#C766EF', '#9B4DFF'],
    timeGradient: ['#4E78FF', '#6B5EFF'],
    profileGradient: ['#FFA07A', '#FF6B9D'],
    loginGradient: ['#FF6B9D', '#C766EF', '#4E78FF'],
  },
  {
    id: 'ocean',
    name: 'Ocean Breeze',
    emoji: '🌊',
    gradient: ['#00C6FB', '#005BEA'],
    primary: '#00C6FB',
    secondary: '#4E78FF',
    tasksGradient: ['#00C6FB', '#005BEA'],
    habitsGradient: ['#4FACFE', '#00F2FE'],
    timeGradient: ['#0093E9', '#80D0C7'],
    profileGradient: ['#43E97B', '#38F9D7'],
    loginGradient: ['#00C6FB', '#005BEA', '#38F9D7'],
  },
  {
    id: 'candy',
    name: 'Candy Pop',
    emoji: '🍭',
    gradient: ['#FF9A9E', '#FAD0C4'],
    primary: '#FF6B9D',
    secondary: '#FFB6D9',
    tasksGradient: ['#FF9A9E', '#FAD0C4'],
    habitsGradient: ['#FBC2EB', '#A6C1EE'],
    timeGradient: ['#FDCBF1', '#E6DEE9'],
    profileGradient: ['#FFDDE1', '#EE9CA7'],
    loginGradient: ['#FF9A9E', '#FBC2EB', '#A6C1EE'],
  },
  {
    id: 'forest',
    name: 'Forest Fresh',
    emoji: '🌿',
    gradient: ['#11998E', '#38EF7D'],
    primary: '#11998E',
    secondary: '#38EF7D',
    tasksGradient: ['#11998E', '#38EF7D'],
    habitsGradient: ['#134E5E', '#71B280'],
    timeGradient: ['#43C6AC', '#F8FFAE'],
    profileGradient: ['#56AB2F', '#A8E063'],
    loginGradient: ['#11998E', '#38EF7D', '#43C6AC'],
  },
  {
    id: 'neon',
    name: 'Neon Nights',
    emoji: '✨',
    gradient: ['#FC466B', '#3F5EFB'],
    primary: '#FC466B',
    secondary: '#3F5EFB',
    tasksGradient: ['#FC466B', '#3F5EFB'],
    habitsGradient: ['#8E2DE2', '#4A00E0'],
    timeGradient: ['#00F260', '#0575E6'],
    profileGradient: ['#F953C6', '#B91D73'],
    loginGradient: ['#FC466B', '#8E2DE2', '#3F5EFB'],
  },
  {
    id: 'peach',
    name: 'Peachy Keen',
    emoji: '🍑',
    gradient: ['#FFB88C', '#FF7E5F'],
    primary: '#FF7E5F',
    secondary: '#FFB88C',
    tasksGradient: ['#FFB88C', '#FF7E5F'],
    habitsGradient: ['#FF9966', '#FF5E62'],
    timeGradient: ['#F6D365', '#FDA085'],
    profileGradient: ['#FBD786', '#f7797d'],
    loginGradient: ['#FFB88C', '#FF7E5F', '#FF5E62'],
  },
  {
    id: 'purple',
    name: 'Purple Dream',
    emoji: '💜',
    gradient: ['#C471F5', '#FA71CD'],
    primary: '#C471F5',
    secondary: '#FA71CD',
    tasksGradient: ['#C471F5', '#FA71CD'],
    habitsGradient: ['#7F00FF', '#E100FF'],
    timeGradient: ['#8A2387', '#E94057'],
    profileGradient: ['#DA22FF', '#9733EE'],
    loginGradient: ['#C471F5', '#FA71CD', '#7F00FF'],
  },
  {
    id: 'mint',
    name: 'Mint Fresh',
    emoji: '🌱',
    gradient: ['#00B4DB', '#0083B0'],
    primary: '#00B4DB',
    secondary: '#00D2FF',
    tasksGradient: ['#00B4DB', '#0083B0'],
    habitsGradient: ['#00CDAC', '#02AABD'],
    timeGradient: ['#396AFC', '#2948FF'],
    profileGradient: ['#5EE7DF', '#B490CA'],
    loginGradient: ['#00B4DB', '#00CDAC', '#5EE7DF'],
  },
];

interface ThemeContextType {
  theme: ThemePalette;
  setTheme: (themeId: string) => void;
  allThemes: ThemePalette[];
  customThemes: ThemePalette[];
  setCustomThemes: (themes: ThemePalette[]) => void;
  addCustomTheme: (theme: ThemePalette) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: themes[0],
  setTheme: () => {},
  allThemes: themes,
  customThemes: [],
  setCustomThemes: () => {},
  addCustomTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemePalette>(themes[0]);
  const [customThemes, setCustomThemes] = useState<ThemePalette[]>([]);

  const allThemes = [...themes, ...customThemes];

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const savedThemeId = Platform.OS === 'web'
        ? localStorage.getItem('app_theme_id')
        : await storage.getItem('app_theme_id', null);

      if (savedThemeId) {
        const found = allThemes.find((t) => t.id === savedThemeId);
        if (found) setThemeState(found);
      }
    } catch (error) {
      console.error('Error loading theme:', error);
    }
  };

  const setTheme = async (themeId: string) => {
    const found = allThemes.find((t) => t.id === themeId);
    if (found) {
      setThemeState(found);
      try {
        if (Platform.OS === 'web') {
          localStorage.setItem('app_theme_id', themeId);
        } else {
          await storage.setItem('app_theme_id', themeId);
        }
      } catch (error) {
        console.error('Error saving theme:', error);
      }
    }
  };

  const addCustomTheme = (newTheme: ThemePalette) => {
    setCustomThemes((prev) => [...prev, newTheme]);
  };

  return (
    <ThemeContext.Provider
      value={{ theme, setTheme, allThemes, customThemes, setCustomThemes, addCustomTheme }}
    >
      {children}
    </ThemeContext.Provider>
  );
};
