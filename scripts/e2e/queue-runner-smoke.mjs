#!/usr/bin/env node

import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DIST_SCRIPT = path.join(ROOT, "dist", "nai-tag-builder.js");
const CHROME_PATHS = [
  process.env.PLAYWRIGHT_CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`,
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
].filter(Boolean);

function assert(condition, message) {
  if (!condition) throw new Error(message);
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

  let page;
  try {
    page = await browser.newPage({
      viewport: { width: 1004, height: 937 },
      deviceScaleFactor: 1,
    });

    await page.addInitScript(() => {
      indexedDB.deleteDatabase("NaiTagBuilderDB");
    });

    // Setup mock NovelAI DOM
    await page.setContent(`
      <!doctype html>
      <html>
        <body style="margin: 0; background: #f3f0e6; color: #0b103a; font-family: sans-serif;">
          <main style="padding: 24px; width: 380px; color: #ffffff;" id="nai-main">
            <h1>NovelAI Mock</h1>
            <p style="color: #0b103a;">Readable NovelAI text sample</p>
            <textarea class="ProseMirror" style="width: 320px; height: 200px;">1girl, official art</textarea>
            <input id="mock-width" type="number" value="832" />
            <button id="mock-import">Import Metadata</button>
            <button id="mock-generate" style="background: #5fbf3f; color: #ffffff;" disabled>Generate 1 Image</button>
          </main>
          <div id="nai-tag-builder-root" style="position: fixed; top: 24px; right: 24px;"></div>
          <script>
            window.generateCount = 0;
            document.addEventListener("click", (event) => {
              if (event.target.id === "mock-import") {
                window.setTimeout(() => {
                    const importBtn = document.getElementById("mock-import");
                    if (importBtn) importBtn.remove();
                }, 50);
                window.setTimeout(() => {
                  const genBtn = document.getElementById("mock-generate");
                  if (genBtn) genBtn.disabled = false;
                }, 100);
              }
              if (event.target.id === "mock-generate") {
                event.target.dataset.clicked = "true";
                event.target.disabled = true;

                const loader = document.createElement("div");
                loader.id = "mock-generation-loader";
                loader.setAttribute("role", "progressbar");
                loader.textContent = "Generating...";
                document.body.appendChild(loader);

                window.setTimeout(() => {
                  loader.remove();
                  event.target.disabled = false;
                  window.generateCount++;
                  
                  // Restore Import button for next tick
                  if (!window.disableMockImportRestore) {
                    const main = document.getElementById("nai-main");
                    const newImport = document.createElement("button");
                    newImport.id = "mock-import";
                    newImport.textContent = "Import Metadata";
                    main.insertBefore(newImport, event.target);
                  }
                }, 300);
              }
            });
          </script>
        </body>
      </html>
    `);

    await page.addScriptTag({ path: DIST_SCRIPT });
    await page.locator("[data-testid='overlay-header']").waitFor({ timeout: 5000 });

    // Switch to Queue Mode
    await page.locator("[data-testid='mode-tab-queue']").click();

    // 1. Configure Queue: targetCount=2, interval=1
    await page.locator("[data-testid='queue-target-count-input']").fill("2");
    await page.locator("[data-testid='queue-interval-input']").fill("1"); // 1 sec interval
    await page.locator("[data-testid='queue-seed-rule-select']").selectOption("increment");
    await page.locator("[data-testid='queue-mode-select']").selectOption("on");

    // 2. Click Start Queue
    await page.locator("[data-testid='start-queue-button']").click();

    // Assert Status Banner is showing "applying"
    await page.locator("text=NovelAI 적용 중").waitFor({ timeout: 3000 });

    // Wait for first tick to succeed (Generating -> wait -> cooldown)
    await page.locator("text=완료 후 대기").waitFor({ timeout: 5000 });
    
    // Wait for the queue to complete targetCount = 2
    await page.locator('text="완료"').waitFor({ timeout: 10000 });
    
    let genCount = await page.evaluate(() => window.generateCount);
    assert(genCount === 2, "Generate count should be 2 after completion.");

    // --- TEST: Explicit Stop Control ---
    // Increase targetCount so we can stop it
    await page.locator("[data-testid='queue-target-count-input']").fill("5");
    await page.locator("[data-testid='start-queue-button']").click();

    // Wait for first tick to finish
    await page.locator("text=완료 후 대기").waitFor({ timeout: 5000 });

    // Stop Queue mid-way
    await page.locator("[data-testid='stop-queue-button']").click();
    await page.locator("text=중지됨").waitFor({ timeout: 2000 });

    // Wait a bit to ensure it doesn't run the second tick
    await page.waitForTimeout(4000);
    const stopGenCount = await page.evaluate(() => window.generateCount);
    // Gen count should be 2 from before + 1 = 3
    assert(stopGenCount === 3, `Generate count should be 3 after stopping, got ${stopGenCount}`);

    // --- TEST: Stop on Failure ---
    // Mock failure by NOT restoring the Import button
    await page.evaluate(() => {
      window.disableMockImportRestore = true;
    });

    await page.locator("[data-testid='start-queue-button']").click();
    
    // It should fail because the import button is missing!
    await page.locator('text="실패"').waitFor({ timeout: 15000 });
    
    const failGenCount = await page.evaluate(() => window.generateCount);
    // The first tick succeeds (because the button was there), but its Generate step doesn't restore the button.
    // The second tick fails. So count should be 3 + 1 = 4.
    assert(failGenCount === 4, `Generate count should be 4, got ${failGenCount}`);

    console.log("queue runner smoke passed");
  } catch (err) {
    console.error("Test failed:", err);
    await page.screenshot({ path: path.join(ROOT, "test-results", "queue-runner-error.png"), fullPage: true });
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
