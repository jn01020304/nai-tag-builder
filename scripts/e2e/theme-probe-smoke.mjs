import { chromium } from 'playwright-core';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CHROME_PATHS = [
  process.env.PLAYWRIGHT_CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`,
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
].filter(Boolean);

function getExecutablePath() {
  const executablePath = CHROME_PATHS.find(p => p && existsSync(p));
  if (!executablePath) {
    throw new Error("Chrome or Edge executable not found. Set PLAYWRIGHT_CHROME_PATH.");
  }
  return executablePath;
}

(async () => {
  const browser = await chromium.launch({ 
    executablePath: getExecutablePath(),
    headless: true 
  });
  
  const page = await browser.newPage();
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const scriptContent = readFileSync(path.resolve(__dirname, '../../dist/nai-tag-builder.js'), 'utf8');
  
  // Theme variants we want to simulate
  const themes = [
    {
      name: 'Light Theme',
      html: `
        <body style="background-color: #ffffff; color: #111222; font-family: 'Open Sans', sans-serif;">
          <div id="__next" style="background-color: #f1f2f3;">
            <main style="background-color: #ffffff;">
              <div class="settings-panel" style="background-color: #e5e7eb;">
                <label style="color: #4b5563;">Resolution</label>
                <input type="text" style="background-color: #d1d5db; border-color: #9ca3af;" />
                <textarea style="background-color: #d1d5db;"></textarea>
                <button style="background-color: #3b82f6; color: #ffffff;">Generate</button>
              </div>
            </main>
          </div>
          <span class="intensity-low" style="color: #3b82f6;"></span>
          <span class="intensity-mid" style="color: #10b981;"></span>
          <span class="intensity-high" style="color: #ef4444;"></span>
        </body>
      `
    },
    {
      name: 'Dark Theme',
      html: `
        <body style="background-color: #0b0d12; color: #f1f1f1; font-family: Inter, sans-serif;">
          <div id="__next">
            <main style="background-color: #13151b;">
              <aside class="settings-panel" style="background-color: #252934;">
                <label style="color: #9ca3af;">Width</label>
                <input type="text" style="background-color: #1d2029; border-color: #363b49;" />
                <textarea style="background-color: #1d2029;"></textarea>
                <button style="background-color: #d4a347; color: #111222;">Generate</button>
              </aside>
            </main>
          </div>
          <span class="intensity-low" style="color: #58a6ff;"></span>
          <span class="intensity-mid" style="color: #57ab5a;"></span>
          <span class="intensity-high" style="color: #e5534b;"></span>
        </body>
      `
    }
  ];

  let anyFailed = false;

  for (const theme of themes) {
    console.log(`Testing ${theme.name}...`);
    await page.setContent(theme.html);
    
    // Inject bookmarklet
    await page.evaluate((script) => {
      eval(script);
    }, scriptContent);

    // Wait for the UI to mount
    const rootEl = page.locator('#nai-tag-builder-root > div').nth(0);
    await rootEl.waitFor({ state: 'attached', timeout: 5000 });

    // Validate the background color of the overlay body
    const bodyBg = await rootEl.evaluate((el) => window.getComputedStyle(el).backgroundColor);
    console.log(`  - Detected Base Background: ${bodyBg}`);

    // Ensure it's not transparent or fallback crust when it should be actual base
    if (bodyBg === 'rgba(0, 0, 0, 0)' || bodyBg === 'transparent') {
      console.error(`  - ${theme.name} failed to resolve base background!`);
      anyFailed = true;
    }

    // Clean up
    await page.evaluate(() => {
      document.getElementById('nai-tag-builder-root')?.remove();
    });
  }

  await browser.close();
  if (anyFailed) {
    console.error('theme-probe-smoke failed');
    process.exit(1);
  } else {
    console.log('theme-probe-smoke passed');
  }
})();
