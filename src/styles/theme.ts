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
  fontFamily: string; // NovelAI font
  intensityLow: string; // low-intensity-color-*, < 1.0 weights
  intensityMid: string; // mid-intensity-color-*, 1.0 weights
  intensityHigh: string; // high-intensity-color-*, > 1.0 weights
  warningError: string; // Error red
  headerText: string; // Dimmer text used for headers/labels
}

export function withAlpha(color: string, alpha: number): string {
  const match = color.match(/\d+(\.\d+)?/g);
  if (match && match.length >= 3) {
    return `rgba(${match[0]}, ${match[1]}, ${match[2]}, ${alpha})`;
  }
  return color;
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
  fontFamily: 'sans-serif',
  intensityLow: 'rgba(4, 102, 206, 0.3)',
  intensityMid: 'rgba(0, 151, 7, 0.5)',
  intensityHigh: 'rgba(184, 55, 0, 0.5)',
  warningError: 'rgb(248, 48, 48)',
  headerText: 'rgba(255, 255, 255, 0.5)',
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
      // Since NovelAI uses styled-components without CSS vars, we sample actual DOM elements.
      const getBg = (selectors: string[], fb: string) => {
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el) {
            const bg = getComputedStyle(el).backgroundColor;
            if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
          }
        }
        return fb;
      };

      const getFg = (selectors: string[], fb: string) => {
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el) {
            const fg = getComputedStyle(el).color;
            if (fg && fg !== 'rgba(0, 0, 0, 0)' && fg !== 'transparent') return fg;
          }
        }
        return fb;
      };

      // Find the Generate button
      const generateBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Generate'));
      const accentBg = generateBtn ? getComputedStyle(generateBtn).backgroundColor : fallbackTheme.yellow;

      const mainBg = getBg(['.image-gen-page', 'main', '#__next > div > div'], getComputedStyle(document.body).backgroundColor || fallbackTheme.base);
      const panelBg = getBg(['.settings-panel', '.image-gen-prompt-main', 'nav', 'aside'], fallbackTheme.surface0);
      const inputBg = getBg(['textarea', 'input[type="text"]'], fallbackTheme.mantle);
      const textFg = getFg(['.image-gen-page', 'p', 'h1', 'h2', 'span', 'body'], fallbackTheme.text);
      const headerFg = getFg(['label', '.sc-9882ac77-42'], fallbackTheme.headerText);

      // Intensity Color Extraction via Probe Element
      // NovelAI defines literal CSS classes: {type}-intensity-color-{0..40}
      // Level 40 = 100% alpha = pure base RGB color
      // Creating a temporary span with the class name lets the browser resolve the color
      const probeIntensityColor = (type: string, fallback: string): string => {
        try {
          const probe = document.createElement('span');
          probe.className = `${type}-intensity-color-40`;
          probe.style.display = 'none';
          document.body.appendChild(probe);
          const bg = getComputedStyle(probe).backgroundColor;
          document.body.removeChild(probe);
          if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
        } catch { /* ignore */ }
        return fallback;
      };

      const lowInt = probeIntensityColor('low', fallbackTheme.intensityLow);
      const midInt = probeIntensityColor('mid', fallbackTheme.intensityMid);
      const highInt = probeIntensityColor('high', fallbackTheme.intensityHigh);

      const scrapedFont = getComputedStyle(document.body).fontFamily || fallbackTheme.fontFamily;

      const isVeryDark = (() => {
        const m = mainBg.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
        if (!m) return true;
        return (0.299 * +m[1] + 0.587 * +m[2] + 0.114 * +m[3]) / 255 < 0.5;
      })();

      const newTheme: ThemeColors = {
        base: mainBg, // Background
        mantle: inputBg, // Input Background
        crust: isVeryDark ? '#0b0c1a' : 'rgba(0, 0, 0, 0.25)', // Dark Background
        surface0: panelBg, // Sidebar / Prompt Main
        surface1: isVeryDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
        surface2: isVeryDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)',
        text: textFg, // Foreground
        subtext0: headerFg, // Header / Labels
        subtext1: isVeryDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)',
        blue: lowInt,
        red: fallbackTheme.warningError, // Warning/Error
        green: midInt,
        yellow: accentBg,
        overlay0: isVeryDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        tagPositiveBg: fallbackTheme.tagPositiveBg,
        tagNegativeBg: fallbackTheme.tagNegativeBg,
        fontFamily: scrapedFont,
        intensityLow: lowInt,
        intensityMid: midInt,
        intensityHigh: highInt,
        warningError: fallbackTheme.warningError,
        headerText: headerFg,
      };

      // Update globals for legacy components
      theme = newTheme;
      inputStyle = defaultInputStyle(theme);
      labelStyle = defaultLabelStyle(theme);
      smallBtnStyle = defaultSmallBtnStyle(theme);

      setCurrentTheme(newTheme);
    };

    // Initial update
    setTimeout(updateTheme, 100);

    // Listen for changes
    let debounceTimer: ReturnType<typeof setTimeout>;
    const observer = new MutationObserver(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        updateTheme();
      }, 300); // 300ms debounce allows DOM to settle
    });

    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class', 'style'] });
    observer.observe(document.head, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      clearTimeout(debounceTimer);
    };
  }, []);

  return currentTheme;
}
