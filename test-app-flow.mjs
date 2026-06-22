import { chromium } from 'playwright';

async function testApp() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Capture all console messages
  const logs = [];
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    logs.push({ type, text, time: new Date().toISOString() });
    console.log(`[${type.toUpperCase()}] ${text}`);
  });

  // Capture errors
  page.on('pageerror', err => {
    console.log(`[ERROR] ${err.message}`);
    logs.push({ type: 'error', text: err.message, time: new Date().toISOString() });
  });

  try {
    console.log('\n=== Testing ContentForge App ===\n');

    // Step 1: Load the app
    console.log('Step 1: Loading app at http://localhost:8082...');
    const response = await page.goto('http://localhost:8082', {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });
    console.log(`Response status: ${response.status()}`);

    // Wait for app to fully render
    await page.waitForTimeout(2000);

    // Step 2: Check if main content loaded
    console.log('\nStep 2: Checking if app content is visible...');
    try {
      await page.waitForSelector('button:has-text("Generate")', { timeout: 5000 });
      console.log('✓ Found Generate button');
    } catch (e) {
      console.log('✗ Could not find Generate button:', e.message);
    }

    // Check if title input exists
    try {
      await page.waitForSelector('input[placeholder*="title"]', { timeout: 5000 });
      console.log('✓ Found course title input');
    } catch (e) {
      console.log('✗ Could not find course title input:', e.message);
    }

    // Step 3: Check for React/Component errors
    console.log('\nStep 3: Checking for React/Component errors in console...');
    const errorLogs = logs.filter(l => l.type === 'error' || l.text.toLowerCase().includes('error'));
    if (errorLogs.length > 0) {
      console.log(`Found ${errorLogs.length} errors:`);
      errorLogs.forEach(e => console.log(`  - ${e.text}`));
    } else {
      console.log('✓ No errors in console');
    }

    // Step 4: Test credit estimation (if modal exists)
    console.log('\nStep 4: Testing credit estimation functions...');
    const creditsTest = await page.evaluate(() => {
      try {
        // Try to access the window object to see what's available
        if (typeof window !== 'undefined') {
          return {
            hasWindow: true,
            keys: Object.keys(window).filter(k => k.includes('credit') || k.includes('Credit')).slice(0, 10)
          };
        }
      } catch (e) {
        return { error: e.message };
      }
    });
    console.log('Window check:', creditsTest);

    // Step 5: Check localStorage for any error state
    console.log('\nStep 5: Checking for any stored state/errors...');
    const localStorageData = await page.evaluate(() => {
      return JSON.stringify(localStorage, null, 2);
    });
    if (localStorageData && localStorageData.length > 100) {
      console.log('LocalStorage:', localStorageData.substring(0, 300) + '...');
    }

    // Step 6: Take a screenshot of the page
    console.log('\nStep 6: Taking screenshot for manual inspection...');
    await page.screenshot({ path: '/tmp/contentforge-app.png' });
    console.log('✓ Screenshot saved to /tmp/contentforge-app.png');

    console.log('\n=== Test Complete ===');
    console.log(`Total console messages: ${logs.length}`);
    console.log(`Errors found: ${errorLogs.length}`);

  } catch (e) {
    console.error('\n✗ Test failed with error:', e.message);
    console.error(e.stack);
  } finally {
    await browser.close();
  }
}

testApp();
