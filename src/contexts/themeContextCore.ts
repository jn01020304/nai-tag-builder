import { createContext, useContext, useMemo } from 'react';
import {
  defaultInputStyle,
  defaultLabelStyle,
  defaultParameterInputStyle,
  defaultSmallBtnStyle,
  fallbackTheme,
} from '../styles/theme';
import type { ThemeColors } from '../styles/theme';

export const ThemeProviderContext = createContext<ThemeColors>(fallbackTheme);

export function useTheme() {
  return useContext(ThemeProviderContext);
}

export function useThemeStyles() {
  const theme = useTheme();

  return useMemo(() => ({
    theme,
    inputStyle: defaultInputStyle(theme),
    labelStyle: defaultLabelStyle(theme),
    smallBtnStyle: defaultSmallBtnStyle(theme),
    parameterInputStyle: defaultParameterInputStyle(theme),
  }), [theme]);
}
