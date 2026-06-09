const { chromium } = require('playwright-core');
const fs = require('fs');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('PAGE ERROR:', e));
  page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));
  await page.goto('https://example.com');
  const code = fs.readFileSync('dist/nai-tag-builder.js', 'utf8');
  await page.evaluate(code);
  // Wait a bit to let React render
  await page.waitForTimeout(2000);
  const rootHtml = await page.evaluate(() => document.getElementById('nai-tag-builder-root')?.innerHTML);
  console.log('ROOT HTML:', rootHtml ? rootHtml.substring(0, 100) : 'NULL');
  await browser.close();
})();
