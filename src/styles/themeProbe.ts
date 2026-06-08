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
  return value !== "" && value !== "rgba(0, 0, 0, 0)" && value !== "transparent";
}

function firstHostElement(selectors: string[]): Element | null {
  for (const selector of selectors) {
    const element = Array.from(document.querySelectorAll(selector))
      .find(isHostCandidate);
    if (element) return element;
  }

  return null;
}

function readHostStyleColor(
  selectors: string[],
  property: "backgroundColor" | "borderColor" | "color",
  fallback: string,
): string {
  const element = firstHostElement(selectors);
  if (!element) return fallback;

  const value = getComputedStyle(element)[property];
  return isUsableColor(value) ? value : fallback;
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

  const mainBg = readHostStyleColor(
    ["main", "[role='main']", "body"],
    "backgroundColor",
    isUsableColor(documentBodyBg) ? documentBodyBg : fallbackTheme.base,
  );
  const panelBg = readHostStyleColor(
    ["aside", "nav", "section", "main"],
    "backgroundColor",
    fallbackTheme.surface0,
  );
  const inputBg = readHostStyleColor(
    ["textarea", "input[type='text']", "input:not([type])"],
    "backgroundColor",
    fallbackTheme.mantle,
  );
  const parameterBg = readHostStyleColor(
    ["input[type='number']", "select", "input"],
    "backgroundColor",
    inputBg || panelBg,
  );
  const parameterBorder = readHostStyleColor(
    ["input[type='number']", "select", "input"],
    "borderColor",
    fallbackTheme.surface1,
  );
  const textFg = readHostStyleColor(
    ["main", "[role='main']", "p", "h1", "h2", "span", "body"],
    "color",
    fallbackTheme.text,
  );
  const headerFg = readHostStyleColor(
    ["label", "legend", "small", "button"],
    "color",
    fallbackTheme.textMuted,
  );

  const lowInt = probeIntensityColor("low", fallbackTheme.intensityLow);
  const midInt = probeIntensityColor("mid", fallbackTheme.intensityMid);
  const highInt = probeIntensityColor("high", fallbackTheme.intensityHigh);
  const scrapedFont = canSampleBody
    ? getComputedStyle(document.body).fontFamily || fallbackTheme.fontFamily
    : fallbackTheme.fontFamily;
  const mainLuminance = colorLuminance(mainBg);
  const isVeryDark = mainLuminance == null || mainLuminance < 0.5;

  return {
    base: mainBg,
    mantle: inputBg,
    crust: isVeryDark ? "#0B0D12" : "rgba(0, 0, 0, 0.25)",
    surface0: panelBg,
    surface1: isVeryDark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.08)",
    surface2: isVeryDark ? "rgba(255, 255, 255, 0.22)" : "rgba(0, 0, 0, 0.14)",
    text: textFg,
    textMuted: headerFg,
    subtext0: headerFg,
    subtext1: isVeryDark ? "rgba(255, 255, 255, 0.82)" : "rgba(0, 0, 0, 0.78)",
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
