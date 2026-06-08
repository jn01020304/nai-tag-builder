#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const URL = process.env.NAI_TAG_BUILDER_E2E_URL || "http://127.0.0.1:5173/";
const TEST_TIMEOUT_MS = 45000;
const CHROME_PATHS = [
  process.env.PLAYWRIGHT_CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`,
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
].filter(Boolean);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
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

async function setTextareaCursor(page, value, cursorIndex) {
  const textarea = page.locator("[data-testid='main-prompt-textarea']");
  await textarea.fill(value);
  await textarea.evaluate((element, index) => {
    element.focus();
    element.setSelectionRange(index, index);
    element.dispatchEvent(new Event("select", { bubbles: true }));
  }, cursorIndex);
}

async function setLocatorCursor(locator, value, cursorIndex) {
  await locator.fill(value);
  await locator.evaluate((element, index) => {
    element.focus();
    element.setSelectionRange(index, index);
    element.dispatchEvent(new Event("select", { bubbles: true }));
  }, cursorIndex);
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

async function checkReadablePromptLabel(page) {
  const result = await page.locator("[data-testid='main-prompt-label']").evaluate((element) => {
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

  assert(result.ok, `Prompt label contrast failed: ${JSON.stringify(result)}`);
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
  const tagToggle = page.locator("[data-testid='tag-dictionary-section-toggle']");
  const promptToggle = page.locator("[data-testid='main-prompt-section-toggle']");

  assert(await tagToggle.getAttribute("aria-expanded") === "true", "Tag Dictionary should default open.");
  assert(await promptToggle.getAttribute("aria-expanded") === "true", "Main Prompt should default open.");

  await tagToggle.click();
  assert(await tagToggle.getAttribute("aria-expanded") === "false", "Tag Dictionary did not collapse.");
  assert(!(await hasLocator(page.locator("[data-testid='tag-dictionary-section-body']"))), "Tag Dictionary body stayed mounted.");
  await tagToggle.click();
  assert(await hasLocator(page.locator("[data-testid='catalog-chip-tag_1girl']")), "Tag Dictionary did not reopen.");

  await promptToggle.click();
  assert(await promptToggle.getAttribute("aria-expanded") === "false", "Main Prompt did not collapse.");
  assert(!(await hasLocator(page.locator("[data-testid='main-prompt-section-body']"))), "Main Prompt body stayed mounted.");
  await promptToggle.click();
  assert(await hasLocator(page.locator("[data-testid='main-prompt-textarea']")), "Main Prompt did not reopen.");
}

async function openQueuePanel(page) {
  const queueToggle = page.locator("[data-testid='queue-section-toggle']");

  assert(await queueToggle.getAttribute("aria-expanded") === "false", "Queue should default collapsed.");
  assert(!(await hasLocator(page.locator("[data-testid='queue-section-body']"))), "Queue body should default unmounted.");

  await queueToggle.click();
  assert(await queueToggle.getAttribute("aria-expanded") === "true", "Queue did not expand.");
  await page.locator("[data-testid='queue-panel']").waitFor({ timeout: 3000 });
}

async function checkTextareaThemeHighlightSeparation(page) {
  const textarea = page.locator("[data-testid='main-prompt-textarea']");
  await textarea.fill("2::1girl, 3d, realistic, official art::, 0.7::flat color::");

  const result = await textarea.evaluate((element) => {
    const wrapper = element.parentElement;
    const backdrop = wrapper?.firstElementChild;
    const label = document.querySelector("[data-testid='main-prompt-label']");
    if (
      !(element instanceof HTMLTextAreaElement) ||
      !(backdrop instanceof HTMLElement) ||
      !(label instanceof HTMLElement)
    ) {
      return { ok: false, reason: "required elements missing" };
    }

    const labelBackground = getComputedStyle(label).backgroundColor;
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
        labelBackground === "rgb(74, 107, 130)" &&
        textareaBackground === "rgba(0, 0, 0, 0)" &&
        backdropBackground !== labelBackground &&
        highlightBackgrounds.length >= 2 &&
        highlightBackgrounds.every((color) => color !== labelBackground) &&
        highlightedText.includes("2::1girl, 3d, realistic, official art::"),
      labelBackground,
      textareaBackground,
      backdropBackground,
      highlightBackgrounds,
      highlightedText,
    };
  });

  assert(result.ok, `Textarea theme/highlight separation failed: ${JSON.stringify(result)}`);
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

    const textarea = page.locator("[data-testid='main-prompt-textarea']");
    await textarea.click();
    await textarea.fill("alpha");
    assert(await getTextareaValue(page) === "alpha", "Main Prompt typing failed.");

    await setTextareaCursor(page, "alpha, omega", 5);
    await page.locator("[data-testid='catalog-chip-tag_1girl']").click();
    assert(
      await getTextareaValue(page) === "alpha, 1girl, omega",
      `Cursor insertion failed: ${await getTextareaValue(page)}`,
    );

    await page.locator("[data-testid='catalog-chip-tag_solo']").click();
    assert(
      await getTextareaValue(page) === "alpha, 1girl, solo, omega",
      `Consecutive cursor insertion failed: ${await getTextareaValue(page)}`,
    );

    await page.locator("[data-testid='catalog-chip-tag_1girl']").click();
    await page.locator("[data-testid='catalog-chip-tag_solo']").click();
    assert(
      await getTextareaValue(page) === "alpha, omega",
      `Chip removal failed: ${await getTextareaValue(page)}`,
    );

    await setTextareaCursor(page, "brown hair, blue eyes", "brown hair".length);
    await page.locator("[data-testid='catalog-chip-tag_1girl']").click();
    assert(
      await getTextareaValue(page) === "brown hair, 1girl, blue eyes",
      `Cursor separator insertion failed: ${await getTextareaValue(page)}`,
    );
    assert(
      await getTextareaSelectionStart(page) === "brown hair, 1girl, ".length,
      `Cursor was not restored after separator: ${await getTextareaSelectionStart(page)}`,
    );
    await page.locator("[data-testid='catalog-chip-tag_solo']").click();
    assert(
      await getTextareaValue(page) === "brown hair, 1girl, solo, blue eyes",
      `Post-separator consecutive insertion failed: ${await getTextareaValue(page)}`,
    );

    const weightedArtistPrompt = "brown hair, 2.7::artist:happoubi jin::, blue eyes";
    const fatFingerCursorIndex = weightedArtistPrompt.indexOf("happoubi") + 3;
    await setTextareaCursor(page, weightedArtistPrompt, fatFingerCursorIndex);
    await page.locator("[data-testid='catalog-chip-tag_1boy']").click();
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
    await page.locator("[data-testid='catalog-chip-tag_1boy']").click();
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
    await page.locator("[data-testid='catalog-chip-tag_1boy']").click();
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
    await page.locator("[data-testid='catalog-chip-tag_2boys']").click();
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
    await page.locator("[data-testid='catalog-chip-tag_2girls']").click();
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

    await checkLayout(page);
    await checkReadablePromptLabel(page);
    await checkFallbackThemeTokens(page);
    await checkTextareaThemeHighlightSeparation(page);

    await openQueuePanel(page);
    assert(
      await page.locator("[data-testid='queue-status']").innerText() === "대기 중",
      `Queue status label failed: ${await page.locator("[data-testid='queue-status']").innerText()}`,
    );
    await page.locator("[data-testid='queue-enable-checkbox']").check();
    await page.locator("[data-testid='queue-mode-select']").selectOption("randomization");
    await page.locator("[data-testid='queue-seed-rule-select']").selectOption("increment");
    await page.locator("[data-testid='queue-interval-input']").fill("7");
    await page.locator("[data-testid='queue-target-count-input']").fill("3");
    assert(
      await page.locator("[data-testid='queue-mode-select']").inputValue() === "randomization",
      "Queue mode control failed.",
    );
    assert(
      await page.locator("[data-testid='queue-seed-rule-select']").inputValue() === "increment",
      "Queue seed rule control failed.",
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
