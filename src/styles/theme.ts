import { useEffect, useState } from "react";
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
  border: "none", // Border diet
  borderRadius: "6px",
  boxSizing: "border-box",
  color: theme.text,
  fontSize: "13px",
  padding: "8px 12px", // Increased padding
  outline: "none",
});

export const defaultLabelStyle = (theme: ThemeColors): React.CSSProperties => ({
  alignSelf: "flex-start",
  backgroundColor: "transparent", // Removing background block for lighter feel
  color: theme.subtext0, // Differentiate opacity/color from main text
  display: "inline-block",
  fontSize: "12px",
  fontWeight: 600,
  marginBottom: "6px",
  maxWidth: "100%",
  overflow: "hidden",
  padding: "0 2px",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

export const defaultSmallBtnStyle = (theme: ThemeColors): React.CSSProperties => ({
  background: "none",
  border: "none", // Ghost button style default
  borderRadius: "6px",
  color: theme.subtext1,
  cursor: "pointer",
  fontSize: "12px",
  padding: "6px 10px", // Increased padding
  transition: "all 0.2s ease",
});

export const defaultParameterInputStyle = (theme: ThemeColors): React.CSSProperties => ({
  ...defaultInputStyle(theme),
  backgroundColor: theme.parameterInputBg,
  border: `1px solid ${theme.surface0}`, // Keep a subtle border here if needed, or remove
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
