import { useEffect, useState } from "react";
import { colorLuminance } from "./color";
import { sampleHostTheme } from "./themeProbe";

export interface ThemeColors {
  base: string;
  mantle: string;
  crust: string;
  surface0: string;
  surface1: string;
  surface2: string;
  text: string;
  textMuted: string;
  subtext0: string;
  subtext1: string;
  blue: string;
  red: string;
  green: string;
  yellow: string;
  overlay0: string;
  tagPositiveBg: string;
  tagNegativeBg: string;
  fontFamily: string;
  intensityLow: string;
  intensityMid: string;
  intensityHigh: string;
  warningError: string;
  headerText: string;
  parameterInputBg: string;
  parameterInputBorder: string;
  actionAccent: string;
  actionAccentText: string;
}

export const fallbackTheme: ThemeColors = {
  base: "#13151B",
  mantle: "#1D2029",
  crust: "#0B0D12",
  surface0: "#252934",
  surface1: "#363B49",
  surface2: "#464D5F",
  text: "#F1F1F1",
  textMuted: "#9CA3AF",
  subtext0: "#9CA3AF",
  subtext1: "#C7CCD5",
  blue: "#58A6FF",
  red: "#EF4444",
  green: "#57AB5A",
  yellow: "#D4A347",
  overlay0: "#4B5565",
  tagPositiveBg: "rgba(102, 59, 39, 0.8)",
  tagNegativeBg: "rgba(29, 66, 115, 0.8)",
  fontFamily: "sans-serif",
  intensityLow: "#58A6FF",
  intensityMid: "#57AB5A",
  intensityHigh: "#E5534B",
  warningError: "rgb(248, 48, 48)",
  headerText: "#9CA3AF",
  parameterInputBg: "#1D2029",
  parameterInputBorder: "#363B49",
  actionAccent: "#D4A347",
  actionAccentText: "#13151B",
};

export const defaultInputStyle = (theme: ThemeColors): React.CSSProperties => ({
  backgroundColor: theme.mantle,
  border: `1px solid ${theme.surface1}`,
  borderRadius: "4px",
  boxSizing: "border-box",
  color: theme.text,
  fontSize: "13px",
  padding: "6px 8px",
});

export const defaultLabelStyle = (theme: ThemeColors): React.CSSProperties => ({
  backgroundColor: colorLuminance(theme.base) != null && colorLuminance(theme.base)! > 0.58
    ? "#303244"
    : "rgba(255, 255, 255, 0.16)",
  borderRadius: "4px",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "12px",
  fontWeight: 600,
  marginBottom: "4px",
  padding: "1px 5px",
});

export const defaultSmallBtnStyle = (theme: ThemeColors): React.CSSProperties => ({
  background: "none",
  border: `1px solid ${theme.surface1}`,
  borderRadius: "4px",
  color: theme.text,
  cursor: "pointer",
  fontSize: "12px",
  padding: "4px 8px",
});

export const defaultParameterInputStyle = (theme: ThemeColors): React.CSSProperties => ({
  ...defaultInputStyle(theme),
  backgroundColor: theme.parameterInputBg,
  border: `1px solid ${theme.parameterInputBorder}`,
});

function areThemeColorsEqual(a: ThemeColors, b: ThemeColors): boolean {
  return Object.keys(a).every((key) => (
    a[key as keyof ThemeColors] === b[key as keyof ThemeColors]
  ));
}

export function useDynamicTheme() {
  const [currentTheme, setCurrentTheme] = useState<ThemeColors>(fallbackTheme);

  useEffect(() => {
    const updateTheme = () => {
      const nextTheme = sampleHostTheme(fallbackTheme);
      setCurrentTheme((previousTheme) => (
        areThemeColorsEqual(previousTheme, nextTheme) ? previousTheme : nextTheme
      ));
    };

    const initialTimers = [100, 500, 1500, 3000].map((delay) => (
      setTimeout(updateTheme, delay)
    ));

    let debounceTimer: ReturnType<typeof setTimeout>;
    const scheduleThemeUpdate = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(updateTheme, 300);
    };
    const observer = new MutationObserver(scheduleThemeUpdate);
    const bodyTreeObserver = new MutationObserver(scheduleThemeUpdate);

    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style", "data-theme"] });
    observer.observe(document.body, { attributes: true, attributeFilter: ["class", "style"] });
    bodyTreeObserver.observe(document.body, { childList: true, subtree: true });
    observer.observe(document.head, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      bodyTreeObserver.disconnect();
      initialTimers.forEach(clearTimeout);
      clearTimeout(debounceTimer);
    };
  }, []);

  return currentTheme;
}
