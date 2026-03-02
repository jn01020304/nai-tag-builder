import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useDynamicTheme, theme as fallbackTheme } from '../styles/theme';
import type { ThemeColors } from '../styles/theme';

const ThemeProviderContext = createContext<ThemeColors>(fallbackTheme);

export function ThemeProvider({ children }: { children: ReactNode }) {
    const theme = useDynamicTheme();
    return (
        <ThemeProviderContext.Provider value={theme}>
            {children}
        </ThemeProviderContext.Provider>
    );
}

export function useTheme() {
    return useContext(ThemeProviderContext);
}
