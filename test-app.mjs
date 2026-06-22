import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  await page.goto("http://localhost:8080/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  
  // Take a screenshot
  await page.screenshot({ path: "./app-screenshot.png" });
  console.log("Screenshot saved");
} catch (e) {
  console.log("Error:", e.message);
}

await browser.close();
process.exit(0);
