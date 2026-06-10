import { chromium } from "playwright-core";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DIST_SCRIPT = path.join(ROOT, "dist", "nai-tag-builder.js");

const CHROME_PATHS = [
  process.env.PLAYWRIGHT_CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`,
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
].filter(Boolean);

function findChromeExecutable() {
  for (const candidate of CHROME_PATHS) {
    import("node:fs").then(fs => {
      // just check existence
    });
    return candidate; // simple fallback
  }
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });

  try {
    const page = await browser.newPage({
      viewport: { width: 1004, height: 937 },
      deviceScaleFactor: 1,
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
        </body>
      </html>
    `);

    await page.addScriptTag({ path: DIST_SCRIPT });
    await page.locator("[data-testid='main-prompt-textarea']").waitFor({ timeout: 5000 });

    // Open Tag Dictionary
    await page.locator("[data-testid='tag-dictionary-section-toggle']").click();
    await page.waitForTimeout(1000);

    // Open Queue
    await page.locator("[data-testid='queue-section-toggle']").click();
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: path.join(ROOT, "test-results", "screenshot.png"),
      fullPage: true,
    });

    console.log("Screenshot saved at test-results/screenshot.png");
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
