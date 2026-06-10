#!/usr/bin/env node

import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { gzip } from "pako";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DIST_SCRIPT = path.join(ROOT, "dist", "nai-tag-builder.js");
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

function findChromeExecutable() {
  for (const candidate of CHROME_PATHS) {
    if (candidate && existsSync(candidate)) return candidate;
  }
  throw new Error("Chrome or Edge executable not found. Set PLAYWRIGHT_CHROME_PATH.");
}

function bytesToBits(bytes) {
  return bytes.flatMap((byte) => (
    Array.from({ length: 8 }, (_, index) => (byte >> (7 - index)) & 1)
  ));
}

async function dropStealthPng(page, payload) {
  const signatureBytes = Array.from("stealth_pngcomp", (char) => char.charCodeAt(0));
  const payloadBytes = Array.from(gzip(new TextEncoder().encode(JSON.stringify(payload))));
  const length = payloadBytes.length;
  const lengthBytes = [
    (length >>> 24) & 255,
    (length >>> 16) & 255,
    (length >>> 8) & 255,
    length & 255,
  ];
  const bits = [
    ...bytesToBits(signatureBytes),
    ...bytesToBits(lengthBytes),
    ...bytesToBits(payloadBytes),
  ];

  await page.evaluate(async (encodedBits) => {
    const width = 80;
    const height = Math.ceil(encodedBits.length / width) + 2;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    const imageData = context.createImageData(width, height);

    for (let index = 0; index < imageData.data.length; index += 4) {
      imageData.data[index] = 220;
      imageData.data[index + 1] = 220;
      imageData.data[index + 2] = 220;
      imageData.data[index + 3] = 254;
    }

    let bitIndex = 0;
    for (let x = 0; x < width; x += 1) {
      for (let y = 0; y < height; y += 1) {
        if (bitIndex >= encodedBits.length) break;
        imageData.data[(y * width + x) * 4 + 3] = 254 | encodedBits[bitIndex];
        bitIndex += 1;
      }
    }

    context.putImageData(imageData, 0, 0);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    const file = new File([blob], "stealth-test.png", { type: "image/png" });
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    const overlay = document.getElementById("nai-tag-builder-root")?.firstElementChild;
    overlay.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer }));
    overlay.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer }));
  }, bits);
}

async function dragResizeHandle(page, testId, targetX, targetY) {
  const handle = page.locator(`[data-testid='${testId}']`);
  const box = await handle.boundingBox();
  assert(box, `${testId} resize handle is missing.`);

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    targetX ?? box.x + box.width / 2,
    targetY ?? box.y + box.height / 2,
    { steps: 8 },
  );
  await page.mouse.up();
}

async function checkOverlayResizeBounds(page) {
  const beforeCornerResize = await page.evaluate(() => {
    const overlay = document.getElementById("nai-tag-builder-root")?.firstElementChild;
    if (!(overlay instanceof HTMLElement)) return null;
    const rect = overlay.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  });
  assert(beforeCornerResize, "Overlay is missing before corner resize.");

  await dragResizeHandle(page, "overlay-resize-bottom-left", -2000, 900);

  const afterCornerResize = await page.evaluate(() => {
    const overlay = document.getElementById("nai-tag-builder-root")?.firstElementChild;
    if (!(overlay instanceof HTMLElement)) return null;
    const rect = overlay.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  });
  assert(afterCornerResize, "Overlay is missing after corner resize.");
  assert(
    afterCornerResize.width > beforeCornerResize.width + 40 &&
      afterCornerResize.height > beforeCornerResize.height + 40,
    `Corner resize did not change both axes: ${JSON.stringify({ beforeCornerResize, afterCornerResize })}`,
  );

  await dragResizeHandle(page, "overlay-resize-left", -2000);
  await dragResizeHandle(page, "overlay-resize-right", 3000);
  await dragResizeHandle(page, "overlay-resize-top", null, -2000);
  await dragResizeHandle(page, "overlay-resize-bottom", null, 3000);
  await dragResizeHandle(page, "overlay-resize-top-left", -2000, -2000);
  await dragResizeHandle(page, "overlay-resize-bottom-right", 3000, 3000);

  const bounds = await page.evaluate(() => {
    const overlay = document.getElementById("nai-tag-builder-root")?.firstElementChild;
    if (!(overlay instanceof HTMLElement)) return { ok: false, reason: "overlay missing" };

    const rect = overlay.getBoundingClientRect();
    return {
      ok:
        rect.width <= window.innerWidth - 16 + 1 &&
        rect.height <= window.innerHeight - 16 + 1 &&
        rect.left >= 8 - 1 &&
        rect.right <= window.innerWidth - 8 + 1 &&
        rect.top >= 8 - 1 &&
        rect.bottom <= window.innerHeight - 8 + 1,
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    };
  });

  assert(bounds.ok, `Overlay resize escaped viewport: ${JSON.stringify(bounds)}`);
}

async function checkCollapsedLauncher(page) {
  await page.locator("button[title='접기']").click();
  await page.locator("[data-testid='overlay-collapsed-launcher']").waitFor({ timeout: 3000 });

  const collapsed = await page.evaluate(() => {
    const overlay = document.getElementById("nai-tag-builder-root")?.firstElementChild;
    const launcher = document.querySelector("[data-testid='overlay-collapsed-launcher']");
    if (!(overlay instanceof HTMLElement) || !(launcher instanceof HTMLElement)) {
      return { ok: false, reason: "collapsed launcher missing" };
    }

    const rect = overlay.getBoundingClientRect();
    const style = getComputedStyle(overlay);
    return {
      ok:
        rect.width === 56 &&
        rect.height === 56 &&
        style.borderRadius === "999px" &&
        !document.querySelector("[data-testid='overlay-header']"),
      width: rect.width,
      height: rect.height,
      borderRadius: style.borderRadius,
      headerCount: document.querySelectorAll("[data-testid='overlay-header']").length,
      launcherText: launcher.textContent,
    };
  });
  assert(collapsed.ok, `Collapsed launcher shape failed: ${JSON.stringify(collapsed)}`);

  await page.locator("[data-testid='overlay-collapsed-launcher']").click();
  await page.locator("[data-testid='overlay-header']").waitFor({ timeout: 3000 });
}

async function checkCollapsedAutomationCount(page, expectedCount) {
  await page.locator("button[title='접기']").click();
  await page.locator("[data-testid='overlay-collapsed-remaining-count']").waitFor({ timeout: 3000 });

  const collapsedCount = await page.locator("[data-testid='overlay-collapsed-remaining-count']").evaluate((element, count) => {
    const launcher = element.closest("[data-testid='overlay-collapsed-launcher']");
    if (!(element instanceof HTMLElement) || !(launcher instanceof HTMLElement)) {
      return { ok: false, reason: "collapsed automation count missing" };
    }

    const style = getComputedStyle(element);
    const launcherStyle = getComputedStyle(launcher);
    return {
      ok:
        element.textContent === String(count) &&
        style.color === launcherStyle.borderColor &&
        launcher.getAttribute("aria-label")?.includes(`${count}장`),
      text: element.textContent,
      color: style.color,
      borderColor: launcherStyle.borderColor,
      ariaLabel: launcher.getAttribute("aria-label"),
    };
  }, expectedCount);

  assert(collapsedCount.ok, `Collapsed automation count failed: ${JSON.stringify(collapsedCount)}`);

  await page.locator("[data-testid='overlay-collapsed-launcher']").click();
  await page.locator("[data-testid='overlay-header']").waitFor({ timeout: 3000 });
}

async function main() {
  assert(existsSync(DIST_SCRIPT), "dist/nai-tag-builder.js is missing. Run npm run build first.");

  const browser = await chromium.launch({
    executablePath: findChromeExecutable(),
    headless: true,
  });

  try {
    const page = await browser.newPage({
      viewport: { width: 1004, height: 937 },
      deviceScaleFactor: 1,
    });

    await page.addInitScript(() => {
      indexedDB.deleteDatabase("NaiTagBuilderDB");
    });

    await page.setContent(`
      <!doctype html>
      <html>
        <body style="margin: 0; background: #f3f0e6; color: #0b103a; font-family: sans-serif;">
          <main style="padding: 24px; width: 380px; color: #ffffff;">
            <h1>NovelAI Mock</h1>
            <p style="color: #0b103a;">Readable NovelAI text sample</p>
            <textarea class="ProseMirror" style="width: 320px; height: 200px;">1girl, official art</textarea>
            <input id="mock-width" type="number" value="832" style="background: #d8d3c4; border: 1px solid #b9b29f; color: #1b1a16;" />
            <button id="mock-import">Import Metadata</button>
            <button id="mock-generate" style="background: #5fbf3f; color: #ffffff;" disabled>Generate 1 Image</button>
          </main>
          <div id="nai-tag-builder-root" style="position: fixed; top: 24px; right: 24px;">
            <div style="width: 320px; padding: 16px; background: #aaa;">
              Easy-to Studio v1.0
              <button id="stale-overlay-marker">NovelAI에 적용</button>
            </div>
          </div>
          <script>
            document.addEventListener("click", (event) => {
              if (event.target.id === "mock-import") {
                window.setTimeout(() => event.target.remove(), 50);
                window.setTimeout(() => {
                  document.getElementById("mock-generate").disabled = false;
                }, 250);
              }
              if (event.target.id === "mock-generate") {
                event.target.dataset.clicked = "true";
                window.mockGenerateClickAt = Date.now();
                event.target.disabled = true;

                const loader = document.createElement("div");
                loader.id = "mock-generation-loader";
                loader.setAttribute("role", "progressbar");
                loader.textContent = "Generating...";
                loader.style.cssText = "position: fixed; bottom: 24px; left: 24px; padding: 8px;";
                document.body.appendChild(loader);

                window.setTimeout(() => {
                  loader.remove();
                  event.target.disabled = false;
                  window.mockGenerateCompleteAt = Date.now();
                }, 650);
              }
            });
          </script>
        </body>
      </html>
    `);

    await page.addScriptTag({ path: DIST_SCRIPT });
    await page.locator("[data-testid='overlay-header']").waitFor({ timeout: 5000 });
    await page.locator("[data-testid='mode-tab-compose']").click();
    await page.locator("[data-testid='main-prompt-textarea']").waitFor({ timeout: 5000 });

    const staleMarkerCount = await page.locator("#stale-overlay-marker").count();
    assert(
      await page.locator("[data-testid='tag-dictionary-section-toggle']").getAttribute("aria-expanded") === "false",
      "Tag Dictionary should default collapsed.",
    );
    const mainPromptTextareaBox = await page.locator("[data-testid='main-prompt-textarea']").boundingBox();

    assert(staleMarkerCount === 0, "Stale overlay was not replaced by the injected bundle.");
    assert(
      mainPromptTextareaBox && mainPromptTextareaBox.y < 760,
      `Main Prompt was pushed too far down: ${JSON.stringify(mainPromptTextareaBox)}`,
    );
    await page.locator("[data-testid='tag-dictionary-section-toggle']").click();
    await page.locator("[data-testid='catalog-chip-tag_1girl']").waitFor({ timeout: 5000 });
    const chipCount = await page.locator("[data-testid^='catalog-chip-']").count();
    assert(chipCount > 0, "Catalog chips did not render after Tag Dictionary expanded.");
    await checkOverlayResizeBounds(page);
    await checkCollapsedLauncher(page);

    await dropStealthPng(page, {
      Comment: JSON.stringify({
        prompt: "lsb prompt import test",
        uc: "lsb negative test",
        seed: 4242,
        steps: 11,
        width: 640,
        height: 768,
        scale: 5,
        sampler: "k_euler",
        noise_schedule: "native",
      }),
      Source: "NovelAI Diffusion Test",
    });
    await page.locator("text=선택 항목 가져오기").waitFor({ timeout: 10000 });
    await page.locator("button", { hasText: "가져오기" }).click();
    assert(
      await page.locator("[data-testid='main-prompt-textarea']").inputValue() === "lsb prompt import test",
      "Stealth LSB prompt was not imported.",
    );
    await page.locator("[data-testid='parameters-section-toggle']").click();
    assert(
      await page.locator("[data-testid='width-input']").inputValue() === "640",
      "Stealth LSB width was not imported.",
    );

    await page.waitForTimeout(500);
    const syncedTheme = await page.evaluate(() => {
      const overlay = document.getElementById("nai-tag-builder-root")?.firstElementChild;
      const overlayBody = document.querySelector("[data-testid='overlay-body']");
      const tagSectionToggle = document.querySelector("[data-testid='tag-dictionary-section-toggle']");
      const applyButton = document.querySelector("[data-testid='apply-button']");
      const widthInput = document.querySelector("[data-testid='width-input']");
      if (
        !(overlay instanceof HTMLElement) ||
        !(overlayBody instanceof HTMLElement) ||
        !(tagSectionToggle instanceof HTMLElement) ||
        !(applyButton instanceof HTMLElement) ||
        !(widthInput instanceof HTMLElement)
      ) {
        return { ok: false, reason: "theme sync targets missing" };
      }

      const overlayStyle = getComputedStyle(overlay);
      const overlayBodyStyle = getComputedStyle(overlayBody);
      const tagSectionStyle = getComputedStyle(tagSectionToggle);
      const applyStyle = getComputedStyle(applyButton);
      const widthStyle = getComputedStyle(widthInput);
      return {
        ok:
          overlayStyle.backgroundColor === "rgb(243, 240, 230)" &&
          overlayBodyStyle.color === "rgb(11, 16, 58)" &&
          tagSectionStyle.color === "rgb(11, 16, 58)" &&
          applyStyle.backgroundColor === "rgb(95, 191, 63)" &&
          applyStyle.color === "rgb(255, 255, 255)" &&
          widthStyle.backgroundColor === "rgb(216, 211, 196)" &&
          widthStyle.borderColor === "rgb(243, 240, 230)",
        overlayBackground: overlayStyle.backgroundColor,
        overlayBodyColor: overlayBodyStyle.color,
        tagSectionColor: tagSectionStyle.color,
        applyBackground: applyStyle.backgroundColor,
        applyColor: applyStyle.color,
        widthBackground: widthStyle.backgroundColor,
        widthBorder: widthStyle.borderColor,
      };
    });
    assert(syncedTheme.ok, `Theme sync failed: ${JSON.stringify(syncedTheme)}`);

    // Switch to Queue Mode
    await page.locator("[data-testid='mode-tab-queue']").click();
    await page.locator("[data-testid='queue-workspace']").waitFor({ timeout: 5000 });

    await page.locator("[data-testid='queue-mode-select']").selectOption("on");
    await page.locator("[data-testid='queue-target-count-input']").fill("2");
    await page.locator("[data-testid='start-queue-button']").click();
    await page.locator("[data-testid='status-banner']", {
      hasText: "NovelAI 적용 및 이미지 생성 완료를 확인했습니다.",
    }).waitFor({ timeout: 9000 });
    await checkCollapsedAutomationCount(page, 1);

    assert(await page.locator("#mock-import").count() === 0, "Mock Import Metadata button was not clicked.");
    assert(
      await page.locator("#mock-generate").evaluate((element) => element.dataset.clicked === "true"),
      "Mock Generate button was not clicked after it became enabled.",
    );
    const generationTiming = await page.evaluate(() => ({
      clickedAt: window.mockGenerateClickAt,
      completedAt: window.mockGenerateCompleteAt,
      observedAt: Date.now(),
    }));
    assert(
      generationTiming.completedAt && generationTiming.observedAt >= generationTiming.completedAt,
      `Apply completed before mock generation finished: ${JSON.stringify(generationTiming)}`,
    );
    assert(
      generationTiming.completedAt - generationTiming.clickedAt >= 600,
      `Mock generation wait was not exercised: ${JSON.stringify(generationTiming)}`,
    );

    await mkdir(path.join(ROOT, "test-results"), { recursive: true });
    await page.screenshot({
      path: path.join(ROOT, "test-results", "bookmarklet-injection-smoke.png"),
      fullPage: true,
    });

    console.log("bookmarklet injection smoke passed");
  } finally {
    await browser.close();
  }
}

const timeout = setTimeout(() => {
  console.error(`Bookmarklet injection smoke timed out after ${TEST_TIMEOUT_MS}ms.`);
  process.exit(1);
}, TEST_TIMEOUT_MS);

main()
  .then(() => clearTimeout(timeout))
  .catch((error) => {
    clearTimeout(timeout);
    console.error(error.message);
    process.exit(1);
  });
