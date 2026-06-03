import type { ReactNode } from 'react';
import { useDynamicTheme } from '../styles/theme';
import { ThemeProviderContext } from './themeContextCore';

export function ThemeProvider({ children }: { children: ReactNode }) {
    const theme = useDynamicTheme();
    return (
        <ThemeProviderContext.Provider value={theme}>
            {children}
        </ThemeProviderContext.Provider>
    );
}

