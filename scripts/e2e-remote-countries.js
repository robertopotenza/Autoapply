#!/usr/bin/env node

const puppeteer = require('puppeteer');

const TEST_URL = process.env.TEST_URL || 'http://localhost:8080/test-remote-countries.html';

async function run() {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();

  const consoleMessages = [];
  page.on('console', msg => {
    consoleMessages.push({ type: msg.type(), text: msg.text() });
    // Mirror to stdout for visibility
    // eslint-disable-next-line no-console
    console.log(`[browser:${msg.type()}] ${msg.text()}`);
  });

  try {
    console.log(`Navigating to ${TEST_URL} ...`);
    const resp = await page.goto(TEST_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    if (!resp || !resp.ok()) {
      throw new Error(`Failed to load page: status=${resp && resp.status()}`);
    }

    await page.waitForSelector('#test-results', { timeout: 10000 });

    // Run Frontend Consistency Test
    console.log('Clicking "Run Frontend Consistency Test"...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent.includes('Frontend Consistency'));
      if (btn) btn.click(); else throw new Error('Frontend Consistency button not found');
    });

    await page.waitForFunction(
      () => document.querySelector('#test-results').innerText.includes('Frontend round-trip test'),
      { timeout: 10000 }
    );

    const consistencyText = await page.$eval('#test-results', el => el.innerText);
    const consistencyPass = /PASSED/i.test(consistencyText) && /SUCCESS/i.test(consistencyText);

    // Run Mock Round Trip Test
    console.log('Clicking "Run Mock Round-Trip"...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent.includes('Mock Round-Trip'));
      if (btn) btn.click(); else throw new Error('Mock Round-Trip button not found');
    });

    await page.waitForFunction(
      () => document.querySelector('#test-results').innerText.includes('Mock Round-Trip Test'),
      { timeout: 10000 }
    );

    const roundTripText = await page.$eval('#test-results', el => el.innerText);
    const roundTripPass = /SUCCESS: Mock round-trip passed/i.test(roundTripText);

    console.log('\n----- SUMMARY -----');
    console.log('Frontend Consistency:', consistencyPass ? 'PASS' : 'FAIL');
    console.log('Mock Round-Trip   :', roundTripPass ? 'PASS' : 'FAIL');

    if (!consistencyPass || !roundTripPass) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('E2E test failed:', err.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

run();
