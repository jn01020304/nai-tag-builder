import { colorLuminance, readableTextColor } from "./color";
import type { ThemeColors } from "./theme";

const OVERLAY_ROOT_ID = "nai-tag-builder-root";

const INTENSITY_CLASS_CANDIDATES = {
  low: [
    "low-intensity-color-40",
    "intensity-low",
    "tag-low",
    "low-intensity",
    "prompt-low",
  ],
  mid: [
    "mid-intensity-color-40",
    "intensity-mid",
    "tag-mid",
    "mid-intensity",
    "prompt-mid",
  ],
  high: [
    "high-intensity-color-40",
    "intensity-high",
    "tag-high",
    "high-intensity",
    "prompt-high",
  ],
} as const;

function isInsideOverlay(element: Element): boolean {
  return element.closest(`#${OVERLAY_ROOT_ID}`) !== null;
}

function hasHostContent(): boolean {
  return Array.from(document.body.children).some((child) => (
    child.id !== OVERLAY_ROOT_ID &&
    !["LINK", "SCRIPT", "STYLE"].includes(child.tagName) &&
    (
      !(child instanceof HTMLElement) ||
      child.textContent.trim().length > 0 ||
      child.querySelector("main, [role='main'], nav, aside, section, textarea, input, button") !== null ||
      (
        child.getBoundingClientRect().width > 0 &&
        child.getBoundingClientRect().height > 0
      )
    )
  ));
}

function isHostCandidate(element: Element): boolean {
  if (element === document.body) return hasHostContent();
  return !isInsideOverlay(element);
}

function isUsableColor(value: string): boolean {
  if (value === "" || value === "transparent") return false;
  const parts = value.match(/\d+(\.\d+)?/g);
  if (value.startsWith("rgba") && parts && parts.length >= 4) {
    return Number(parts[3]) > 0.01;
  }
  return value !== "rgba(0, 0, 0, 0)";
}

function queryHostElements(selector: string): Element[] {
  try {
    return Array.from(document.querySelectorAll(selector))
      .filter(isHostCandidate);
  } catch {
    return [];
  }
}

function hostElements(selectors: string[]): Element[] {
  const seen = new Set<Element>();
  const elements: Element[] = [];

  for (const selector of selectors) {
    for (const element of queryHostElements(selector)) {
      if (seen.has(element)) continue;
      seen.add(element);
      elements.push(element);
    }
  }

  return elements;
}

function readComputedColor(
  element: Element,
  property: "backgroundColor" | "borderColor" | "color",
): string | null {
  const value = getComputedStyle(element)[property];
  return isUsableColor(value) ? value : null;
}

function readNearestBackground(element: Element): string | null {
  let current: Element | null = element;

  while (current && current !== document.documentElement) {
    if (!isHostCandidate(current)) return null;
    const value = readComputedColor(current, "backgroundColor");
    if (value) return value;
    current = current.parentElement;
  }

  return null;
}

function readHostStyleColor(
  selectors: string[],
  property: "backgroundColor" | "borderColor" | "color",
  fallback: string,
): string {
  for (const element of hostElements(selectors)) {
    const value = readComputedColor(element, property);
    if (value) return value;

    if (property === "backgroundColor") {
      const nearest = readNearestBackground(element);
      if (nearest) return nearest;
    }
  }

  return fallback;
}

function contrastRatio(foreground: string, background: string): number | null {
  const fg = colorLuminance(foreground);
  const bg = colorLuminance(background);
  if (fg == null || bg == null) return null;

  const light = Math.max(fg, bg);
  const dark = Math.min(fg, bg);
  return (light + 0.05) / (dark + 0.05);
}

function isVisibleElement(element: Element): boolean {
  if (!(element instanceof HTMLElement)) return true;
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
}

function isInteractiveTextSource(element: Element): boolean {
  return element.closest("button, input, select, textarea, [role='button'], [contenteditable='true']") !== null;
}

function readReadableHostTextColor(
  selectors: string[],
  background: string,
  fallback: string,
  options: { includeInteractive?: boolean } = {},
): string {
  let bestColor: string | null = null;
  let bestRatio = 0;

  for (const element of hostElements(selectors)) {
    if (!isVisibleElement(element)) continue;
    if (!options.includeInteractive && isInteractiveTextSource(element)) continue;

    const color = readComputedColor(element, "color");
    if (!color) continue;

    const ratio = contrastRatio(color, background);
    if (ratio != null && ratio > bestRatio) {
      bestColor = color;
      bestRatio = ratio;
    }
  }

  if (bestColor && bestRatio >= 3) return bestColor;

  const fallbackRatio = contrastRatio(fallback, background);
  if (fallbackRatio != null && fallbackRatio >= 3) return fallback;

  return readableTextColor(background, "#111222", "#ffffff");
}

function findGenerateButton(): HTMLButtonElement | undefined {
  return Array.from(document.querySelectorAll("button"))
    .find((button) => (
      !isInsideOverlay(button)
      && !!button.textContent
      && (button.textContent.includes("Generate") || button.textContent.includes("생성"))
    ));
}

function probeIntensityColor(kind: keyof typeof INTENSITY_CLASS_CANDIDATES, fallback: string): string {
  for (const className of INTENSITY_CLASS_CANDIDATES[kind]) {
    const probe = document.createElement("span");
    probe.className = className;
    probe.textContent = "probe";
    probe.style.position = "fixed";
    probe.style.left = "-9999px";
    probe.style.top = "-9999px";
    document.body.appendChild(probe);

    const style = getComputedStyle(probe);
    const color = isUsableColor(style.backgroundColor)
      ? style.backgroundColor
      : style.color;
    probe.remove();

    if (isUsableColor(color)) return color;
  }

  return fallback;
}

export function sampleHostTheme(fallbackTheme: ThemeColors): ThemeColors {
  const canSampleBody = hasHostContent();
  if (!canSampleBody) return fallbackTheme;

  const generateButton = findGenerateButton();
  const accentBg = generateButton
    ? getComputedStyle(generateButton).backgroundColor
    : fallbackTheme.yellow;
  const documentBodyBg = canSampleBody ? getComputedStyle(document.body).backgroundColor : "";

  const pageBg = readHostStyleColor(
    [".image-gen-page", "[class*='image-gen']", "main", "[role='main']", "#__next > div > div", "#__next", "body"],
    "backgroundColor",
    isUsableColor(documentBodyBg) ? documentBodyBg : fallbackTheme.base,
  );
  const panelBg = readHostStyleColor(
    [
      ".settings-panel",
      ".image-gen-prompt-main",
      "aside",
      "nav",
      "section:has(textarea)",
      "section:has(input)",
      "[class*='settings']",
      "[class*='panel']",
      "[class*='sidebar']",
      "main",
    ],
    "backgroundColor",
    fallbackTheme.surface0,
  );
  const inputBg = readHostStyleColor(
    [
      ".ProseMirror",
      "textarea",
      "input[type='text']",
      "input:not([type])",
      "[contenteditable='true']",
    ],
    "backgroundColor",
    fallbackTheme.mantle,
  );
  const parameterBg = readHostStyleColor(
    ["input[type='number']", ".settings-panel input", "aside input", "select", "input"],
    "backgroundColor",
    inputBg || panelBg,
  );
  const parameterBorder = readHostStyleColor(
    ["input[type='number']", ".settings-panel input", "aside input", "select", "input"],
    "borderColor",
    fallbackTheme.surface1,
  );

  const lowInt = probeIntensityColor("low", fallbackTheme.intensityLow);
  const midInt = probeIntensityColor("mid", fallbackTheme.intensityMid);
  const highInt = probeIntensityColor("high", fallbackTheme.intensityHigh);
  const scrapedFont = canSampleBody
    ? getComputedStyle(document.body).fontFamily || fallbackTheme.fontFamily
    : fallbackTheme.fontFamily;
  const baseBg = [panelBg, inputBg, pageBg].find((color) => (
    isUsableColor(color) && color !== fallbackTheme.surface0 && color !== fallbackTheme.mantle
  )) ?? pageBg;
  const mainLuminance = colorLuminance(baseBg);
  const isVeryDark = mainLuminance == null || mainLuminance < 0.5;
  const textFg = readReadableHostTextColor(
    ["main", "[role='main']", "p", "h1", "h2", "label", "legend", "body"],
    baseBg,
    fallbackTheme.text,
  );
  const headerFg = readReadableHostTextColor(
    ["label", "legend", "small", "p", "span"],
    panelBg,
    isVeryDark ? fallbackTheme.textMuted : textFg,
  );
  const secondaryText = isVeryDark ? "rgba(255, 255, 255, 0.82)" : textFg;

  return {
    base: baseBg,
    mantle: inputBg,
    crust: isVeryDark ? "#0B0D12" : "rgba(0, 0, 0, 0.25)",
    surface0: panelBg,
    surface1: isVeryDark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.08)",
    surface2: isVeryDark ? "rgba(255, 255, 255, 0.22)" : "rgba(0, 0, 0, 0.14)",
    text: textFg,
    textMuted: headerFg,
    subtext0: headerFg,
    subtext1: secondaryText,
    blue: lowInt,
    red: fallbackTheme.warningError,
    green: midInt,
    yellow: accentBg,
    overlay0: isVeryDark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.12)",
    tagPositiveBg: fallbackTheme.tagPositiveBg,
    tagNegativeBg: fallbackTheme.tagNegativeBg,
    fontFamily: scrapedFont,
    intensityLow: lowInt,
    intensityMid: midInt,
    intensityHigh: highInt,
    warningError: fallbackTheme.warningError,
    headerText: headerFg,
    parameterInputBg: parameterBg,
    parameterInputBorder: parameterBorder,
    actionAccent: accentBg,
    actionAccentText: readableTextColor(accentBg, "#111222", "#ffffff"),
  };
}
