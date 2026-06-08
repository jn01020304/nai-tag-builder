#!/usr/bin/env node

import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DIST_SCRIPT = path.join(ROOT, "dist", "nai-tag-builder.js");
const TEST_TIMEOUT_MS = 30000;
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
          <main style="padding: 24px; width: 380px;">
            <h1>NovelAI Mock</h1>
            <textarea class="ProseMirror" style="width: 320px; height: 200px;">1girl, official art</textarea>
            <input id="mock-width" type="number" value="832" style="background: #d8d3c4; border: 1px solid #b9b29f; color: #1b1a16;" />
            <button id="mock-import">Import Metadata</button>
            <button id="mock-generate" style="background: #5fbf3f; color: #ffffff;" disabled>Generate 1 Image</button>
          </main>
          <div id="nai-tag-builder-root" style="position: fixed; top: 24px; right: 24px;">
            <div style="width: 320px; padding: 16px; background: #aaa;">
              NAI Tag Builder v2.0
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
    await page.locator("[data-testid='catalog-chip-tag_1girl']").waitFor({ timeout: 5000 });
    await page.locator("[data-testid='main-prompt-label']").waitFor({ timeout: 5000 });

    const staleMarkerCount = await page.locator("#stale-overlay-marker").count();
    const chipCount = await page.locator("[data-testid^='catalog-chip-']").count();
    const mainPromptLabelBox = await page.locator("[data-testid='main-prompt-label']").boundingBox();

    assert(staleMarkerCount === 0, "Stale overlay was not replaced by the injected bundle.");
    assert(chipCount > 0, "Catalog chips did not render after bundle injection.");
    assert(
      mainPromptLabelBox && mainPromptLabelBox.y < 760,
      `Main Prompt was pushed too far down: ${JSON.stringify(mainPromptLabelBox)}`,
    );

    await page.waitForTimeout(500);
    const syncedTheme = await page.evaluate(() => {
      const applyButton = document.querySelector("[data-testid='apply-button']");
      const widthInput = document.querySelector("[data-testid='width-input']");
      if (!(applyButton instanceof HTMLElement) || !(widthInput instanceof HTMLElement)) {
        return { ok: false, reason: "theme sync targets missing" };
      }

      const applyStyle = getComputedStyle(applyButton);
      const widthStyle = getComputedStyle(widthInput);
      return {
        ok:
          applyStyle.backgroundColor === "rgb(95, 191, 63)" &&
          applyStyle.color === "rgb(255, 255, 255)" &&
          widthStyle.backgroundColor === "rgb(216, 211, 196)" &&
          widthStyle.borderColor === "rgb(185, 178, 159)",
        applyBackground: applyStyle.backgroundColor,
        applyColor: applyStyle.color,
        widthBackground: widthStyle.backgroundColor,
        widthBorder: widthStyle.borderColor,
      };
    });
    assert(syncedTheme.ok, `Theme sync failed: ${JSON.stringify(syncedTheme)}`);

    await page.locator("[data-testid='queue-section-toggle']").click();
    await page.locator("[data-testid='queue-enable-checkbox']").check();
    await page.locator("[data-testid='queue-target-count-input']").fill("1");
    await page.locator("[data-testid='apply-button']").click();
    await page.locator("[data-testid='status-banner']", {
      hasText: "NovelAI 적용 및 이미지 생성 완료를 확인했습니다.",
    }).waitFor({ timeout: 9000 });

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
