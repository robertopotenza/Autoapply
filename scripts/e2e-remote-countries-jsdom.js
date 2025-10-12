#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

async function main() {
  const htmlPath = path.resolve(__dirname, '../public/test-remote-countries.html');

  let html = fs.readFileSync(htmlPath, 'utf-8');
  // Remove external app.js reference to avoid jsdom network fetch (test HTML is self-contained)
  html = html.replace(/<script[^>]*src=["']\/?app\.js["'][^>]*><\/script>/i, '');

  // Load the HTML with jsdom - the test HTML has all functionality embedded
  const dom = new JSDOM(html, {
    url: 'http://localhost:8080/test-remote-countries.html',
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true
  });

  const { window } = dom;
  const { document } = window;

  // Provide minimal APIs
  window.alert = (msg) => console.log('[alert]', msg);
  window.localStorage.setItem('DEBUG_MODE', 'true');

  // Wait for the embedded scripts in the HTML to initialize
  await new Promise((r) => setTimeout(r, 500));

  // Programmatically select test countries
  const testCountries = ['United States', 'United Kingdom', 'Canada'];
  if (window.multiSelectInstances && window.multiSelectInstances['remote-countries']) {
    const instance = window.multiSelectInstances['remote-countries'];
    testCountries.forEach(country => {
      instance.addItem(country);
    });
  }
  await new Promise((r) => setTimeout(r, 200));

  // Define small helpers to simulate clicking the test buttons
  function clickButtonByText(text) {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find((b) => b.textContent.includes(text));
    if (!btn) throw new Error(`Button not found: ${text}`);
    btn.click();
  }

  // Run the Frontend Consistency Test
  clickButtonByText('Frontend Consistency Test');
  await new Promise((r) => setTimeout(r, 600));

  const resultsEl1 = document.getElementById('results');
  const log1 = resultsEl1 ? resultsEl1.textContent : '';
  const pass1 = /ALL TESTS PASSED|SUCCESS: All data paths are consistent/i.test(log1);

  // Run the Mock Round-Trip Test
  clickButtonByText('Mock Round-Trip');
  await new Promise((r) => setTimeout(r, 600));

  const resultsEl2 = document.getElementById('results');
  const log2 = resultsEl2 ? resultsEl2.textContent : '';
  const pass2 = /ALL ROUND-TRIP TESTS PASSED|SUCCESS: Mock round-trip passed/i.test(log2);

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
