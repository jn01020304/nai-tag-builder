const { chromium } = require('playwright-core');
const fs = require('fs');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('PAGE ERROR:', e));
  page.on('console', msg => console.log('CONSOLE:', msg.text()));
  await page.goto('https://example.com');
  const code = fs.readFileSync('dist/nai-tag-builder.js', 'utf8');
  await page.evaluate(code);
  setTimeout(() => browser.close(), 2000);
})();
