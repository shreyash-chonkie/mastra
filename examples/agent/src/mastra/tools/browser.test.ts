import { readFile, readFileSync } from 'node:fs';
import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function test() {
  const browser = await chromium.launch({
    headless: false,
  });
  const page = await browser.newPage();
  await page.addInitScript({
    content: readFileSync(path.join(__dirname, 'dom.utils.js'), 'utf-8'),
  });
  await page.goto('https://docs.stagehand.dev/reference/introduction');
}

test();
