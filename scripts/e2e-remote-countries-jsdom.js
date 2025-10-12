#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

async function main() {
  const htmlPath = path.resolve(__dirname, '../public/test-remote-countries.html');
  const appJsPath = path.resolve(__dirname, '../public/app.js');

  let html = fs.readFileSync(htmlPath, 'utf-8');
  // Remove external app.js reference to avoid jsdom network fetch
  html = html.replace(/<script[^>]*src=["']\/?app\.js["'][^>]*><\/script>/i, '');
  const appJs = fs.readFileSync(appJsPath, 'utf-8');

  // Replace the external script tag with a placeholder we can execute
  const dom = new JSDOM(html, {
    url: 'http://localhost:8080/test-remote-countries.html',
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true
  });

  const { window } = dom;
  const { document } = window;

  // Provide minimal APIs used by app.js
  window.alert = (msg) => console.log('[alert]', msg);
  window.localStorage.setItem('DEBUG_MODE', 'true');

  // Inject app.js into the DOM
  const scriptEl = document.createElement('script');
  scriptEl.textContent = appJs;
  document.body.appendChild(scriptEl);

  // Trigger DOMContentLoaded for app.js initialization (since we injected after creation)
  document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));
  // If initializeForm exists, call it explicitly to ensure components are created in jsdom
  if (typeof window.initializeForm === 'function') {
    try {
      window.initializeForm();
    } catch (e) {
      // ignore
    }
  }
  await new Promise((r) => setTimeout(r, 500));

  // Ensure core functions exist
  if (typeof window.initMultiSelect !== 'function' && !window.multiSelectInstances) {
    // app.js initializes automatically on DOMContentLoaded via initializeForm
  }

  // Define small helpers to simulate clicking the test buttons
  function clickButtonByText(text) {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find((b) => b.textContent.includes(text));
    if (!btn) throw new Error(`Button not found: ${text}`);
    btn.click();
  }

  // Run the Frontend Consistency Test
  clickButtonByText('Frontend Consistency');
  await new Promise((r) => setTimeout(r, 600));

  const resultsEl1 = document.getElementById('test-results');
  const log1 = resultsEl1 ? resultsEl1.textContent : '';
  const pass1 = /Frontend round-trip test PASSED|SUCCESS: All data paths are consistent/i.test(log1);

  // Run the Mock Round-Trip Test
  clickButtonByText('Mock Round-Trip');
  await new Promise((r) => setTimeout(r, 600));

  const resultsEl2 = document.getElementById('test-results');
  const log2 = resultsEl2 ? resultsEl2.textContent : '';
  const pass2 = /SUCCESS: Mock round-trip passed/i.test(log2);

  console.log('\n----- JSdom SUMMARY -----');
  console.log('Frontend Consistency:', pass1 ? 'PASS' : 'FAIL');
  console.log('Mock Round-Trip   :', pass2 ? 'PASS' : 'FAIL');

  if (!pass1 || !pass2) {
    console.log('\n--- Test Results Content Start ---\n');
    console.log(resultsEl2 ? resultsEl2.textContent : '(no results)');
    console.log('\n--- Test Results Content End ---\n');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('JSdom test failed:', err);
  process.exit(1);
});
