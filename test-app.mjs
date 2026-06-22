import { chromium } from 'playwright';

async function testApp() {
  const browser = await chromium.launch();
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  
  // Capture console messages
  const logs = [];
  page.on('console', msg => logs.push({ type: msg.type(), text: msg.text() }));
  page.on('pageerror', err => logs.push({ type: 'error', text: err.toString() }));
  
  try {
    console.log('Navigating to app...');
    await page.goto('http://localhost:8082', { timeout: 10000, waitUntil: 'networkidle' });
    console.log('Page loaded successfully');
    
    // Wait for app to render
    await page.waitForTimeout(2000);
    
    // Check for errors
    const errors = logs.filter(l => l.type === 'error' || l.text.includes('error'));
    if (errors.length > 0) {
      console.log('ERRORS FOUND:');
      errors.forEach(e => console.log(e.text));
    }
    
    // Check if main content is visible
    const hasContent = await page.locator('text=Course').count() > 0;
    console.log('App content visible:', hasContent);
    
    console.log('All console logs:');
    logs.forEach(l => console.log(\[\] \\));
    
  } catch (e) {
    console.error('Test failed:', e.message);
  } finally {
    await browser.close();
  }
}

testApp().catch(console.error);
