#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const URL = process.env.NAI_TAG_BUILDER_E2E_URL || "http://127.0.0.1:5173/";
const TEST_TIMEOUT_MS = 70000;
const CHROME_PATHS = [
  process.env.PLAYWRIGHT_CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`,
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
].filter(Boolean);

const BASE_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64",
);

const crcTable = new Uint32Array(256);
for (let i = 0; i < crcTable.length; i += 1) {
  let value = i;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) ? (0xEDB88320 ^ (value >>> 1)) : (value >>> 1);
  }
  crcTable[i] = value;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function crc32(buffer) {
  let value = 0xFFFFFFFF;
  for (const byte of buffer) {
    value = crcTable[(value ^ byte) & 0xFF] ^ (value >>> 8);
  }
  return (value ^ 0xFFFFFFFF) >>> 0;
}

function createTextChunk(key, textValue) {
  const type = Buffer.from("tEXt", "ascii");
  const data = Buffer.concat([
    Buffer.from(`${key}\0`, "utf8"),
    Buffer.from(textValue, "utf8"),
  ]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([type, data])), 0);
  return Buffer.concat([length, type, data, crc]);
}

function createNovelAiPngFixture(comment, source = "NovelAI Diffusion Test") {
  const insertOffset = 33;
  const chunks = [
    createTextChunk("Source", source),
    createTextChunk("Comment", JSON.stringify(comment)),
  ];

  return Buffer.concat([
    BASE_PNG.subarray(0, insertOffset),
    ...chunks,
    BASE_PNG.subarray(insertOffset),
  ]);
}

async function canReach(url) {
  try {
    const response = await fetch(url, { method: "GET" });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForServer(url, timeoutMs = 12000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await canReach(url)) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Dev server did not respond: ${url}`);
}

function findChromeExecutable() {
  for (const candidate of CHROME_PATHS) {
    if (candidate && existsSync(candidate)) return candidate;
  }
  throw new Error("Chrome or Edge executable not found. Set PLAYWRIGHT_CHROME_PATH.");
}

async function startServerIfNeeded() {
  if (await canReach(URL)) return null;

  const viteBin = path.join(ROOT, "node_modules", "vite", "bin", "vite.js");
  const child = spawn(process.execPath, [viteBin, "--host", "127.0.0.1", "--port", "5173"], {
    cwd: ROOT,
    stdio: "pipe",
    windowsHide: true,
  });

  child.stdout.on("data", (chunk) => process.stdout.write(chunk));
  child.stderr.on("data", (chunk) => process.stderr.write(chunk));

  await waitForServer(URL);
  return child;
}

async function getTextareaValue(page) {
  return page.locator("[data-testid='main-prompt-textarea']").inputValue();
}

async function getTextareaSelectionStart(page) {
  return page.locator("[data-testid='main-prompt-textarea']").evaluate((element) => element.selectionStart);
}

async function getBackgroundColor(locator) {
  return locator.evaluate((element) => getComputedStyle(element).backgroundColor);
}

async function hasLocator(locator) {
  return await locator.count() > 0;
}

async function clickCatalogChip(page, chipId) {
  await page.locator(`[data-testid='catalog-chip-${chipId}']`).evaluate((element) => {
    element.scrollIntoView({ block: "center", inline: "center" });
    element.click();
  });
}

async function setTextareaCursor(page, value, cursorIndex) {
  const textarea = page.locator("[data-testid='main-prompt-textarea']");
  await textarea.fill(value);
  await textarea.evaluate((element, index) => {
    element.focus();
    element.setSelectionRange(index, index);
    element.dispatchEvent(new Event("select", { bubbles: true }));
    element.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "ArrowLeft" }));
  }, cursorIndex);
  await page.waitForTimeout(50);
}

async function setLocatorCursor(locator, value, cursorIndex) {
  await locator.fill(value);
  await locator.evaluate((element, index) => {
    element.focus();
    element.setSelectionRange(index, index);
    element.dispatchEvent(new Event("select", { bubbles: true }));
    element.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "ArrowLeft" }));
  }, cursorIndex);
  await locator.page().waitForTimeout(50);
}

async function checkLayout(page) {
  const result = await page.evaluate(() => {
    const root = document.getElementById("nai-tag-builder-root");
    const overlay = root?.firstElementChild;
    const header = document.querySelector("[data-testid='overlay-header']");
    const body = document.querySelector("[data-testid='overlay-body']");
    const footer = document.querySelector("[data-testid='overlay-footer']");
    const footerStatus = document.querySelector("[data-testid='overlay-footer-status']");
    const raw = document.querySelector("[data-testid='main-prompt-textarea']");
    const params = document.querySelector("[data-testid='generation-params']");
    if (
      !(overlay instanceof HTMLElement) ||
      !(header instanceof HTMLElement) ||
      !(body instanceof HTMLElement) ||
      !(footer instanceof HTMLElement) ||
      !(footerStatus instanceof HTMLElement) ||
      !(raw instanceof HTMLElement) ||
      !(params instanceof HTMLElement)
    ) {
      return { ok: false, reason: "required elements missing" };
    }

    const overlayRect = overlay.getBoundingClientRect();
    const headerRect = header.getBoundingClientRect();
    const bodyRect = body.getBoundingClientRect();
    const footerRect = footer.getBoundingClientRect();
    const footerStatusRect = footerStatus.getBoundingClientRect();
    const rawRect = raw.getBoundingClientRect();
    const paramsRect = params.getBoundingClientRect();
    const bodyStyle = getComputedStyle(body);
    const controls = Array.from(overlay.querySelectorAll("button, input, select, textarea"))
      .filter((element) => element instanceof HTMLElement)
      .filter((element) => !element.closest("[aria-label='Prompt categories']"))
      .map((element) => element.getBoundingClientRect());

    const overflowingControl = controls.find((rect) =>
      rect.left < overlayRect.left - 1 ||
      rect.right > overlayRect.right + 1 ||
      rect.width <= 0 ||
      rect.height <= 0
    );

    return {
      ok:
        overlay.scrollWidth <= overlay.clientWidth + 1 &&
        headerRect.top >= overlayRect.top - 1 &&
        bodyRect.top >= headerRect.bottom - 1 &&
        footerRect.top >= bodyRect.bottom - 1 &&
        footerRect.bottom <= overlayRect.bottom + 1 &&
        footerStatusRect.width > 0 &&
        footerStatusRect.height > 0 &&
        bodyStyle.overflowY === "auto" &&
        rawRect.bottom + 4 <= paramsRect.top &&
        !overflowingControl,
      overlayScrollWidth: overlay.scrollWidth,
      overlayClientWidth: overlay.clientWidth,
      bodyOverflowY: bodyStyle.overflowY,
      headerTop: headerRect.top,
      bodyTop: bodyRect.top,
      footerTop: footerRect.top,
      footerBottom: footerRect.bottom,
      overlayBottom: overlayRect.bottom,
      rawBottom: rawRect.bottom,
      paramsTop: paramsRect.top,
      overflowingControl: overflowingControl
        ? {
            left: overflowingControl.left,
            right: overflowingControl.right,
            width: overflowingControl.width,
            overlayLeft: overlayRect.left,
            overlayRight: overlayRect.right,
          }
        : null,
    };
  });

  assert(result.ok, `Layout check failed: ${JSON.stringify(result)}`);
}

async function checkReadablePromptTab(page) {
  const result = await page.locator("[data-testid='base-prompt-primary-tab']").evaluate((element) => {
    const parseRgb = (value) => {
      const parts = value.match(/\d+(\.\d+)?/g);
      if (!parts || parts.length < 3) return null;
      return parts.slice(0, 3).map(Number);
    };

    const relativeLuminance = ([red, green, blue]) => {
      const normalize = (channel) => {
        const value = channel / 255;
        return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * normalize(red) + 0.7152 * normalize(green) + 0.0722 * normalize(blue);
    };

    const style = getComputedStyle(element);
    const color = parseRgb(style.color);
    const background = parseRgb(style.backgroundColor);
    if (!color || !background) return { ok: false, reason: "color parse failed" };

    const light = Math.max(relativeLuminance(color), relativeLuminance(background));
    const dark = Math.min(relativeLuminance(color), relativeLuminance(background));
    const ratio = (light + 0.05) / (dark + 0.05);

    return {
      ok: ratio >= 4.5 && element.getBoundingClientRect().width > 0 && element.getBoundingClientRect().height > 0,
      ratio,
      color: style.color,
      backgroundColor: style.backgroundColor,
    };
  });

  assert(result.ok, `Prompt tab contrast failed: ${JSON.stringify(result)}`);
}

async function checkFallbackThemeTokens(page) {
  await page.waitForTimeout(500);

  const result = await page.evaluate(() => {
    const root = document.getElementById("nai-tag-builder-root");
    const overlay = root?.firstElementChild;
    const widthInput = document.querySelector("[data-testid='width-input']");
    const applyButton = document.querySelector("[data-testid='apply-button']");

    if (
      !(overlay instanceof HTMLElement) ||
      !(widthInput instanceof HTMLElement) ||
      !(applyButton instanceof HTMLElement)
    ) {
      return { ok: false, reason: "theme guard targets missing" };
    }

    const overlayStyle = getComputedStyle(overlay);
    const widthStyle = getComputedStyle(widthInput);
    const applyStyle = getComputedStyle(applyButton);

    return {
      ok:
        overlayStyle.backgroundColor === "rgb(19, 21, 27)" &&
        widthStyle.backgroundColor === "rgb(29, 32, 41)" &&
        widthStyle.borderColor === "rgb(54, 59, 73)" &&
        applyStyle.backgroundColor === "rgb(212, 163, 71)" &&
        applyStyle.color === "rgb(19, 21, 27)",
      overlayBackground: overlayStyle.backgroundColor,
      widthBackground: widthStyle.backgroundColor,
      widthBorder: widthStyle.borderColor,
      applyBackground: applyStyle.backgroundColor,
      applyColor: applyStyle.color,
    };
  });

  assert(result.ok, `Fallback theme token check failed: ${JSON.stringify(result)}`);
}

async function checkPromptSectionToggles(page) {
  const promptToggle = page.locator("[data-testid='main-prompt-section-toggle']");
  const parametersToggle = page.locator("[data-testid='parameters-section-toggle']");
  const queueToggle = page.locator("[data-testid='queue-section-toggle']");

  assert(await promptToggle.getAttribute("aria-expanded") === "true", "Main Prompt should default open.");
  assert(await queueToggle.getAttribute("aria-expanded") === "true", "Queue should default open.");
  assert(await parametersToggle.getAttribute("aria-expanded") === "false", "Parameters should default collapsed.");
  assert(await hasLocator(page.locator("[data-testid='main-prompt-section-body']")), "Main Prompt body should default mounted.");
  assert(await hasLocator(page.locator("[data-testid='queue-section-body']")), "Queue body should default mounted.");
  assert(!(await hasLocator(page.locator("[data-testid='parameters-section-body']"))), "Parameters body should default unmounted.");



  await promptToggle.click();
  assert(await promptToggle.getAttribute("aria-expanded") === "false", "Main Prompt did not collapse.");
  assert(!(await hasLocator(page.locator("[data-testid='main-prompt-section-body']"))), "Main Prompt body stayed mounted.");
  await promptToggle.click();
  assert(await hasLocator(page.locator("[data-testid='main-prompt-textarea']")), "Main Prompt did not reopen.");

  await page.locator("button[title='접기']").click();
  await page.locator("[data-testid='overlay-collapsed-launcher']").waitFor({ timeout: 3000 });
  const bodyDisplay = await page.locator("[data-testid='overlay-body']").evaluate((element) => getComputedStyle(element).display);
  assert(bodyDisplay === "none", `Overlay body should be hidden while collapsed: ${bodyDisplay}`);

  await page.locator("[data-testid='overlay-collapsed-launcher']").click();
  await page.locator("[data-testid='overlay-header']").waitFor({ timeout: 3000 });
  assert(await promptToggle.getAttribute("aria-expanded") === "true", "Main Prompt state was not preserved.");
  assert(await parametersToggle.getAttribute("aria-expanded") === "false", "Parameters state was not preserved.");
  assert(await queueToggle.getAttribute("aria-expanded") === "true", "Queue state was not preserved.");
}

async function checkOverlayStaysInViewportAfterExpand(page) {
  await page.locator("button[title='접기']").click();
  await page.locator("[data-testid='overlay-collapsed-launcher']").waitFor({ timeout: 3000 });

  await page.evaluate(() => {
    const root = document.getElementById("nai-tag-builder-root");
    if (!(root instanceof HTMLElement)) return;
    root.style.right = "";
    root.style.bottom = "";
    root.style.left = `${window.innerWidth - 64}px`;
    root.style.top = `${window.innerHeight - 64}px`;
  });

  await page.locator("[data-testid='overlay-collapsed-launcher']").click();
  await page.locator("[data-testid='overlay-header']").waitFor({ timeout: 3000 });
  await page.waitForFunction(() => {
    const overlay = document.getElementById("nai-tag-builder-root")?.firstElementChild;
    if (!(overlay instanceof HTMLElement)) return false;
    const rect = overlay.getBoundingClientRect();
    return (
      rect.left >= 7 &&
      rect.top >= 7 &&
      rect.right <= window.innerWidth - 7 &&
      rect.bottom <= window.innerHeight - 7
    );
  });

  const bounds = await page.evaluate(() => {
    const overlay = document.getElementById("nai-tag-builder-root")?.firstElementChild;
    if (!(overlay instanceof HTMLElement)) return { ok: false, reason: "overlay missing" };
    const rect = overlay.getBoundingClientRect();
    return {
      ok:
        rect.left >= 7 &&
        rect.top >= 7 &&
        rect.right <= window.innerWidth - 7 &&
        rect.bottom <= window.innerHeight - 7,
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    };
  });

  assert(bounds.ok, `Overlay expanded outside viewport: ${JSON.stringify(bounds)}`);
}

async function openQueuePanel(page) {
  const queueToggle = page.locator("[data-testid='queue-section-toggle']");

  if (await queueToggle.getAttribute("aria-expanded") === "false") {
    await queueToggle.click();
  }
  assert(await queueToggle.getAttribute("aria-expanded") === "true", "Queue did not expand.");
  await page.locator("[data-testid='queue-panel']").waitFor({ timeout: 3000 });
}

async function checkQueueImagesImport(page) {
  const fixturesDir = path.join(ROOT, "test-results", "fixtures");
  await mkdir(fixturesDir, { recursive: true });

  const firstPath = path.join(fixturesDir, "queue-alpha.png");
  const secondPath = path.join(fixturesDir, "queue-beta.png");
  await writeFile(firstPath, createNovelAiPngFixture({
    prompt: "queue alpha prompt",
    uc: "queue alpha negative",
    seed: 100,
    steps: 11,
    width: 640,
    height: 768,
    scale: 5,
    sampler: "k_euler",
    noise_schedule: "native",
  }));
  await writeFile(secondPath, createNovelAiPngFixture({
    prompt: "queue beta prompt",
    uc: "queue beta negative",
    seed: 500,
    steps: 12,
    width: 704,
    height: 832,
    scale: 6,
    sampler: "k_euler_ancestral",
    noise_schedule: "karras",
  }));

  const presetsToggle = page.locator("[data-testid='presets-section-toggle']");
  if (await presetsToggle.getAttribute("aria-expanded") === "false") {
    await presetsToggle.click();
  }

  await page.locator("[data-testid='queue-images-input']").setInputFiles([firstPath, secondPath]);
  await page.locator("[data-testid='status-banner']", {
    hasText: "2개 이미지에서 프리셋을 만들고 Queue에 추가했습니다.",
  }).waitFor({ timeout: 5000 });

  await page.locator("[data-testid='queued-preset-0']", { hasText: "queue-alpha" }).waitFor({ timeout: 5000 });
  await page.locator("[data-testid='queued-preset-1']", { hasText: "queue-beta" }).waitFor({ timeout: 5000 });

  assert(
    await page.locator("[data-testid='queue-runs-per-preset-input']").isEnabled(),
    "Runs per preset should be enabled after queued image presets are added.",
  );
}

async function checkTextareaThemeHighlightSeparation(page) {
  const textarea = page.locator("[data-testid='main-prompt-textarea']");
  await textarea.fill("2::1girl, 3d, realistic, official art::, 0.7::flat color::");

  const result = await textarea.evaluate((element) => {
    const wrapper = element.parentElement;
    const backdrop = wrapper?.firstElementChild;
    const primaryTab = document.querySelector("[data-testid='base-prompt-primary-tab']");
    const promptLabels = document.querySelectorAll("[data-testid='main-prompt-label'], [data-testid='negative-prompt-label']");
    if (
      !(element instanceof HTMLTextAreaElement) ||
      !(backdrop instanceof HTMLElement) ||
      !(primaryTab instanceof HTMLElement)
    ) {
      return { ok: false, reason: "required elements missing" };
    }

    const tabBackground = getComputedStyle(primaryTab).backgroundColor;
    const textareaBackground = getComputedStyle(element).backgroundColor;
    const backdropBackground = getComputedStyle(backdrop).backgroundColor;
    const highlightBackgrounds = Array.from(backdrop.querySelectorAll("span"))
      .map((span) => getComputedStyle(span).backgroundColor)
      .filter((color) => color !== "rgba(0, 0, 0, 0)" && color !== "transparent");
    const highlightedText = Array.from(backdrop.querySelectorAll("span"))
      .filter((span) => {
        const color = getComputedStyle(span).backgroundColor;
        return color !== "rgba(0, 0, 0, 0)" && color !== "transparent";
      })
      .map((span) => span.textContent ?? "")
      .join("");

    return {
      ok:
        promptLabels.length === 0 &&
        tabBackground === "rgb(74, 107, 130)" &&
        textareaBackground === "rgba(0, 0, 0, 0)" &&
        backdropBackground !== tabBackground &&
        highlightBackgrounds.length >= 2 &&
        highlightBackgrounds.every((color) => color !== tabBackground) &&
        highlightedText.includes("2::1girl, 3d, realistic, official art::"),
      promptLabelCount: promptLabels.length,
      tabBackground,
      textareaBackground,
      backdropBackground,
      highlightBackgrounds,
      highlightedText,
    };
  });

  assert(result.ok, `Textarea theme/highlight separation failed: ${JSON.stringify(result)}`);
}

async function checkCharacterSurfaceSeparation(page) {
  const charactersToggle = page.locator("[data-testid='characters-section-toggle']");
  if (await charactersToggle.getAttribute("aria-expanded") === "false") {
    await charactersToggle.click();
  }
  await page.locator("[data-testid='character-0-primary-tab']").click();

  const result = await page.locator("[data-testid='character-prompt-textarea-0']").evaluate((element) => {
    const wrapper = element.parentElement;
    const card = document.querySelector("[data-testid='character-card-0']");
    const backdrop = wrapper?.firstElementChild;
    if (
      !(element instanceof HTMLTextAreaElement) ||
      !(backdrop instanceof HTMLElement) ||
      !(card instanceof HTMLElement)
    ) {
      return { ok: false, reason: "required elements missing" };
    }

    const cardBackground = getComputedStyle(card).backgroundColor;
    const backdropBackground = getComputedStyle(backdrop).backgroundColor;
    const textareaBackground = getComputedStyle(element).backgroundColor;

    return {
      ok:
        cardBackground !== backdropBackground &&
        textareaBackground === "rgba(0, 0, 0, 0)",
      cardBackground,
      backdropBackground,
      textareaBackground,
    };
  });

  assert(result.ok, `Character surface separation failed: ${JSON.stringify(result)}`);
}

async function checkAdvancedReadableRows(page) {
  await page.locator("[data-testid='advanced-section-toggle']").click();
  await page.locator("[data-testid='advanced-section-body']").waitFor({ timeout: 3000 });

  const result = await page.locator("[data-testid='advanced-section-body']").evaluate((body) => {
    const checkboxLabel = Array.from(body.querySelectorAll("label"))
      .find((element) => element.textContent?.includes("Dynamic Thresholding"));
    const numberLabel = Array.from(body.querySelectorAll("label"))
      .find((element) => element.textContent?.trim() === "CFG Rescale");
    if (
      !(body instanceof HTMLElement) ||
      !(checkboxLabel instanceof HTMLElement) ||
      !(numberLabel instanceof HTMLElement)
    ) {
      return { ok: false, reason: "advanced label missing" };
    }

    const style = getComputedStyle(checkboxLabel);
    const input = checkboxLabel.querySelector("input");
    const labelRect = checkboxLabel.getBoundingClientRect();
    const inputRect = input?.getBoundingClientRect();
    const numberStyle = getComputedStyle(numberLabel);
    const numberLabelRect = numberLabel.getBoundingClientRect();
    const numberFieldRect = numberLabel.parentElement?.getBoundingClientRect();

    return {
      ok:
        style.textAlign === "left" &&
        style.color !== "rgb(255, 255, 255)" &&
        !!inputRect &&
        inputRect.left < labelRect.left + 24 &&
        numberStyle.alignSelf === "flex-start" &&
        numberStyle.whiteSpace === "nowrap" &&
        !!numberFieldRect &&
        numberLabelRect.width < numberFieldRect.width * 0.85 &&
        numberLabelRect.height < 28,
      textAlign: style.textAlign,
      color: style.color,
      labelLeft: labelRect.left,
      inputLeft: inputRect?.left,
      numberAlignSelf: numberStyle.alignSelf,
      numberWhiteSpace: numberStyle.whiteSpace,
      numberLabelHeight: numberLabelRect.height,
      numberLabelWidth: numberLabelRect.width,
      numberFieldWidth: numberFieldRect?.width,
    };
  });

  assert(result.ok, `Advanced readable rows failed: ${JSON.stringify(result)}`);
}

async function dragTag(page, fromTestId, toTestId) {
  const source = page.locator(`[data-testid='${fromTestId}']`);
  const target = page.locator(`[data-testid='${toTestId}']`);
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  assert(sourceBox && targetBox, "Drag target boxes are missing.");

  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 8 });
  await page.mouse.up();
}

async function main() {
  const server = await startServerIfNeeded();
  const browser = await chromium.launch({
    executablePath: findChromeExecutable(),
    headless: true,
  });

  try {
    const page = await browser.newPage({
      viewport: { width: 320, height: 760 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    });

    await page.addInitScript(() => {
      indexedDB.deleteDatabase("NaiTagBuilderDB");
    });

    await page.goto(URL, { waitUntil: "networkidle" });
    await page.locator("text=NAI Tag Builder v2.0").waitFor({ timeout: 5000 });
    await checkPromptSectionToggles(page);
    await checkOverlayStaysInViewportAfterExpand(page);

    const textarea = page.locator("[data-testid='main-prompt-textarea']");
    await textarea.click();
    await textarea.fill("alpha");
    assert(await getTextareaValue(page) === "alpha", "Main Prompt typing failed.");

    await setTextareaCursor(page, "alpha, omega", 5);
    await clickCatalogChip(page, "tag_1girl");
    assert(
      await getTextareaValue(page) === "alpha, 1girl, omega",
      `Cursor insertion failed: ${await getTextareaValue(page)}`,
    );

    await clickCatalogChip(page, "tag_solo");
    assert(
      await getTextareaValue(page) === "alpha, 1girl, solo, omega",
      `Consecutive cursor insertion failed: ${await getTextareaValue(page)}`,
    );

    await clickCatalogChip(page, "tag_1girl");
    await clickCatalogChip(page, "tag_solo");
    assert(
      await getTextareaValue(page) === "alpha, omega",
      `Chip removal failed: ${await getTextareaValue(page)}`,
    );

    await setTextareaCursor(page, "brown hair, blue eyes", "brown hair".length);
    await clickCatalogChip(page, "tag_1girl");
    assert(
      await getTextareaValue(page) === "brown hair, 1girl, blue eyes",
      `Cursor separator insertion failed: ${await getTextareaValue(page)}`,
    );
    assert(
      await getTextareaSelectionStart(page) === "brown hair, 1girl, ".length,
      `Cursor was not restored after separator: ${await getTextareaSelectionStart(page)}`,
    );
    await clickCatalogChip(page, "tag_solo");
    assert(
      await getTextareaValue(page) === "brown hair, 1girl, solo, blue eyes",
      `Post-separator consecutive insertion failed: ${await getTextareaValue(page)}`,
    );

    const weightedArtistPrompt = "brown hair, 2.7::artist:happoubi jin::, blue eyes";
    const fatFingerCursorIndex = weightedArtistPrompt.indexOf("happoubi") + 3;
    await setTextareaCursor(page, weightedArtistPrompt, fatFingerCursorIndex);
    await clickCatalogChip(page, "tag_1boy");
    assert(
      await getTextareaValue(page) === "brown hair, 2.7::artist:happoubi jin::, 1boy, blue eyes",
      `Fat-finger token insertion failed: ${await getTextareaValue(page)}`,
    );
    assert(
      await getTextareaSelectionStart(page) === "brown hair, 2.7::artist:happoubi jin::, 1boy, ".length,
      `Fat-finger cursor was not restored after separator: ${await getTextareaSelectionStart(page)}`,
    );

    await page.locator("button", { hasText: "Characters" }).click();
    const characterTextarea = page.locator("[data-testid='character-prompt-textarea-0']");
    await setLocatorCursor(characterTextarea, "brown hair, blue eyes", "brown hair".length);
    await clickCatalogChip(page, "tag_1boy");
    assert(
      await characterTextarea.inputValue() === "brown hair, 1boy, blue eyes",
      `Character target insertion failed: ${await characterTextarea.inputValue()}`,
    );
    assert(
      await getBackgroundColor(page.locator("[data-testid='catalog-chip-tag_1boy']")) === "rgb(107, 91, 130)",
      `Character active chip color failed: ${await getBackgroundColor(page.locator("[data-testid='catalog-chip-tag_1boy']"))}`,
    );
    assert(
      await hasLocator(page.locator("[data-testid='catalog-chip-tag_1boy-badge-c1']")),
      "Character assignment badge c1 is missing.",
    );

    await page.locator("[data-testid='base-prompt-secondary-tab']").click();
    const negativeTextarea = page.locator("[data-testid='negative-prompt-textarea']");
    await setLocatorCursor(negativeTextarea, "bad anatomy, blurry", "bad anatomy".length);
    await clickCatalogChip(page, "tag_1boy");
    assert(
      await negativeTextarea.inputValue() === "bad anatomy, 1boy, blurry",
      `Negative target insertion failed: ${await negativeTextarea.inputValue()}`,
    );
    assert(
      await getBackgroundColor(page.locator("[data-testid='catalog-chip-tag_1boy']")) === "rgb(143, 89, 85)",
      `Negative active chip color failed: ${await getBackgroundColor(page.locator("[data-testid='catalog-chip-tag_1boy']"))}`,
    );
    assert(
      await hasLocator(page.locator("[data-testid='catalog-chip-tag_1boy-badge-n']")),
      "Negative assignment badge n is missing.",
    );

    await page.locator("[data-testid='character-0-secondary-tab']").click();
    const negativeCharacterTextarea = page.locator("[data-testid='negative-character-prompt-textarea-0']");
    await setLocatorCursor(negativeCharacterTextarea, "bad hands, blurry", "bad hands".length);
    await clickCatalogChip(page, "tag_2boys");
    assert(
      await negativeCharacterTextarea.inputValue() === "bad hands, 2boys, blurry",
      `Negative character target insertion failed: ${await negativeCharacterTextarea.inputValue()}`,
    );
    assert(
      await hasLocator(page.locator("[data-testid='catalog-chip-tag_2boys-badge-nc1']")),
      "Negative character assignment badge nc1 is missing.",
    );

    await page.locator("button", { hasText: "+ Add Character" }).click();
    const secondCharacterTextarea = page.locator("[data-testid='character-prompt-textarea-1']");
    await setLocatorCursor(secondCharacterTextarea, "green eyes, school uniform", "green eyes".length);
    await clickCatalogChip(page, "tag_2girls");
    assert(
      await secondCharacterTextarea.inputValue() === "green eyes, 2girls, school uniform",
      `Second character target insertion failed: ${await secondCharacterTextarea.inputValue()}`,
    );
    assert(
      await hasLocator(page.locator("[data-testid='catalog-chip-tag_2girls-badge-c2']")),
      "Second character assignment badge c2 is missing.",
    );

    await page.locator("[data-testid='base-prompt-primary-tab']").click();
    await textarea.click();
    assert(
      await hasLocator(page.locator("[data-testid='catalog-chip-tag_1boy-badge-c1']")),
      "Character badge disappeared after returning to base target.",
    );
    assert(
      await hasLocator(page.locator("[data-testid='catalog-chip-tag_1boy-badge-n']")),
      "Negative badge disappeared after returning to base target.",
    );

    await textarea.fill("1girl, solo, outdoors");
    await dragTag(page, "selected-tag-2", "selected-tag-0");
    assert(
      await getTextareaValue(page) === "outdoors, 1girl, solo",
      `Drag reorder failed: ${await getTextareaValue(page)}`,
    );

    await page.locator("[data-testid='parameters-section-toggle']").click();
    await checkLayout(page);
    await checkReadablePromptTab(page);
    await checkFallbackThemeTokens(page);
    await checkTextareaThemeHighlightSeparation(page);
    await checkCharacterSurfaceSeparation(page);
    await checkAdvancedReadableRows(page);

    await openQueuePanel(page);
    assert(
      await page.locator("[data-testid='queue-status']").innerText() === "대기 중",
      `Queue status label failed: ${await page.locator("[data-testid='queue-status']").innerText()}`,
    );
    const queuePanelText = await page.locator("[data-testid='queue-panel']").innerText();
    assert(
      !queuePanelText.includes("소스 현재 프롬프트") &&
        !queuePanelText.includes("규칙 현재 seed 유지") &&
        !queuePanelText.includes("목표 100회") &&
        !queuePanelText.includes("간격 10초"),
      `Queue summary copy should be hidden: ${queuePanelText}`,
    );
    assert(
      await page.locator("[data-testid='queue-mode-select']").inputValue() === "on",
      "Queue automation should default to on.",
    );
    assert(
      await page.locator("[data-testid='queue-seed-rule-select']").inputValue() === "random",
      "Queue seed rule should default to random.",
    );
    assert(
      await page.locator("[data-testid='queue-run-mode-select']").inputValue() === "batched",
      "Queue run mode should default to batched.",
    );
    assert(
      await page.locator("[data-testid='queue-runs-per-preset-input']").inputValue() === "1",
      "Queue runs per preset should default to 1.",
    );
    assert(
      !(await hasLocator(page.locator("[data-testid='queue-enable-checkbox']"))),
      "Queue enable checkbox should be removed.",
    );
    assert(
      await page.locator("[data-testid='queue-interval-input']").inputValue() === "10",
      `Queue default interval should be 10 seconds: ${await page.locator("[data-testid='queue-interval-input']").inputValue()}`,
    );
    await checkQueueImagesImport(page);
    await page.locator("[data-testid='queue-mode-select']").selectOption("on");
    await page.locator("[data-testid='queue-seed-rule-select']").selectOption("decrement");
    await page.locator("[data-testid='queue-run-mode-select']").selectOption("randomized");
    await page.locator("[data-testid='queue-interval-input']").fill("7");
    await page.locator("[data-testid='queue-target-count-input']").fill("3");
    assert(
      await page.locator("[data-testid='queue-mode-select']").inputValue() === "on",
      "Queue automation control failed.",
    );
    assert(
      await page.locator("[data-testid='queue-seed-rule-select']").inputValue() === "decrement",
      "Queue seed rule control failed.",
    );
    assert(
      await page.locator("[data-testid='queue-run-mode-select']").inputValue() === "randomized",
      "Queue run mode control failed.",
    );

    await mkdir(path.join(ROOT, "test-results"), { recursive: true });
    await page.screenshot({
      path: path.join(ROOT, "test-results", "compose-smoke-mobile.png"),
      fullPage: true,
    });

    const applyButton = page.locator("[data-testid='apply-button']");
    await applyButton.click();
    assert(await applyButton.isDisabled(), "Apply button was not locked while automation was pending.");
    await page.locator("[data-testid='apply-button']", { hasText: "Import 버튼 대기 중..." }).waitFor({
      timeout: 3000,
    });
    await page.locator("[data-testid='overlay-footer-status']", { hasText: "Import 버튼 대기 중" }).waitFor({
      timeout: 3000,
    });
    await page.locator("[data-testid='status-banner']", { hasText: "IMPORT_BUTTON_TIMEOUT" }).waitFor({
      timeout: 8000,
    });
    await page.locator("[data-testid='status-banner']", { hasText: "Base Prompt 영역이 보이는 상태" }).waitFor({
      timeout: 8000,
    });
    assert(!(await applyButton.isDisabled()), "Apply button stayed locked after automation failure.");

    console.log("compose smoke passed");
  } finally {
    await browser.close();
    if (server) {
      server.kill();
    }
  }
}

const timeout = setTimeout(() => {
  console.error(`Compose smoke timed out after ${TEST_TIMEOUT_MS}ms.`);
  process.exit(1);
}, TEST_TIMEOUT_MS);

main()
  .then(() => clearTimeout(timeout))
  .catch((error) => {
    clearTimeout(timeout);
    console.error(error.message);
    process.exit(1);
  });
