import { createContext, useContext } from 'react';
import { theme as fallbackTheme } from '../styles/theme';
import type { ThemeColors } from '../styles/theme';

export const ThemeProviderContext = createContext<ThemeColors>(fallbackTheme);

export function useTheme() {
  return useContext(ThemeProviderContext);
}
