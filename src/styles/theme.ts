import { useState, useEffect } from 'react';

export interface ThemeColors {
  base: string;       // Background
  mantle: string;     // Slightly lighter background
  crust: string;      // Very dark background
  surface0: string;   // Secondary panels
  surface1: string;   // Hover states, borders
  surface2: string;   // Active states
  text: string;       // Primary text
  subtext0: string;   // Grayed out text
  subtext1: string;   // Lighter gray text
  blue: string;
  red: string;
  green: string;
  yellow: string;     // Accent
  overlay0: string;   // Dividers
  tagPositiveBg: string;
  tagNegativeBg: string;
}

// Fallback to NovelAI Deep Navy (Ink theme will override these)
const fallbackTheme: ThemeColors = {
  base: '#13152c',
  mantle: '#1c1f3c',
  crust: '#0b0c1a',
  surface0: '#22253f',
  surface1: '#2f345a',
  surface2: '#3c4273',
  text: '#ffffff',
  subtext0: '#a0a0b0',
  subtext1: '#d0d0e0',
  blue: '#3b82f6',
  red: '#ef4444',
  green: '#10b981',
  yellow: '#f5f3c2',
  overlay0: '#4a5078',
  tagPositiveBg: 'rgba(102, 59, 39, 0.8)',
  tagNegativeBg: 'rgba(29, 66, 115, 0.8)',
};

export const defaultInputStyle = (theme: ThemeColors): React.CSSProperties => ({
  backgroundColor: theme.mantle,
  color: theme.text,
  border: `1px solid ${theme.surface1}`,
  borderRadius: '4px',
  padding: '6px 8px',
  fontSize: '13px',
  boxSizing: 'border-box',
});

export const defaultLabelStyle = (theme: ThemeColors): React.CSSProperties => ({
  fontSize: '12px',
  color: theme.subtext0,
  marginBottom: '4px',
  display: 'block',
});

export const defaultSmallBtnStyle = (theme: ThemeColors): React.CSSProperties => ({
  background: 'none',
  border: `1px solid ${theme.surface1}`,
  color: theme.text,
  borderRadius: '4px',
  padding: '4px 8px',
  fontSize: '12px',
  cursor: 'pointer',
});

// A global singleton so we don't have to drill props everywhere immediately
export let theme = fallbackTheme;
export let inputStyle = defaultInputStyle(theme);
export let labelStyle = defaultLabelStyle(theme);
export let smallBtnStyle = defaultSmallBtnStyle(theme);

// Call this hook at the top level App to sync colors
export function useDynamicTheme() {
  const [currentTheme, setCurrentTheme] = useState<ThemeColors>(fallbackTheme);

  useEffect(() => {
    const updateTheme = () => {
      const root = document.documentElement;
      const style = getComputedStyle(root);

      const getVar = (name: string, fb: string) => {
        const val = style.getPropertyValue(name).trim();
        return val ? val : fb;
      };

      // Heuristics to find NovelAI theme colors
      // Default NovelAI uses vars like --color-background, --color-text, --color-surface
      // We approximate matching our theme tokens to NovelAI's CSS vars.
      const newTheme: ThemeColors = {
        base: getVar('--background', getVar('--color-background', fallbackTheme.base)),
        mantle: getVar('--background-light', getVar('--color-surface', fallbackTheme.mantle)),
        crust: getVar('--background-dark', fallbackTheme.crust),
        surface0: getVar('--color-surface-dim', fallbackTheme.surface0),
        surface1: getVar('--color-surface-bright', fallbackTheme.surface1),
        surface2: getVar('--color-surface-brighter', fallbackTheme.surface2),
        text: getVar('--color-text', getVar('--text', fallbackTheme.text)),
        subtext0: getVar('--color-text-dim', fallbackTheme.subtext0),
        subtext1: getVar('--color-text-dimmer', fallbackTheme.subtext1),
        blue: getVar('--color-blue', fallbackTheme.blue),
        red: getVar('--color-red', fallbackTheme.red),
        green: getVar('--color-green', fallbackTheme.green),
        yellow: getVar('--color-primary', getVar('--primary', fallbackTheme.yellow)), // NovelAI pale yellow
        overlay0: getVar('--color-border', fallbackTheme.overlay0),
        // Tags
        tagPositiveBg: fallbackTheme.tagPositiveBg,
        tagNegativeBg: fallbackTheme.tagNegativeBg,
      };

      // Update globals for legacy components
      theme = newTheme;
      inputStyle = defaultInputStyle(theme);
      labelStyle = defaultLabelStyle(theme);
      smallBtnStyle = defaultSmallBtnStyle(theme);

      setCurrentTheme(newTheme);
    };

    // Initial update
    updateTheme();

    // Listen for changes (MutationObserver on root className or attribute helps if NovelAI swaps themes)
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && (mutation.attributeName === 'class' || mutation.attributeName === 'style')) {
          updateTheme();
        }
      }
    });

    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class', 'style'] });

    return () => observer.disconnect();
  }, []);

  return currentTheme;
}
