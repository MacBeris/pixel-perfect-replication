import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const baseUrl = (process.env.RESPONSIVE_BASE_URL || "http://127.0.0.1:4173").replace(/\/$/, "");
const widths = [320, 360, 390, 430, 768, 1440];
const routes = [
  "/",
  "/plugins",
  "/about",
  "/for-developers",
  "/platform/wordpress",
  "/platform/blender",
  "/category/developer-tools",
  "/developers/extendshare",
  "/auth",
  "/dashboard",
  "/admin",
];

const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
    : {}),
});
const failures = [];

try {
  for (const width of widths) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    for (const route of routes) {
      const response = await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(250);
      const overflow = await page.evaluate(() => {
        const viewportWidth = document.documentElement.clientWidth;
        const offenders = [...document.querySelectorAll("body *")]
          .filter((element) => {
            const style = getComputedStyle(element);
            if (style.position === "fixed" || style.visibility === "hidden") return false;
            const rect = element.getBoundingClientRect();
            return rect.width > 0 && (rect.right > viewportWidth + 1 || rect.left < -1);
          })
          .slice(0, 6)
          .map((element) => ({
            tag: element.tagName.toLowerCase(),
            className: String(element.className).slice(0, 120),
            rect: element.getBoundingClientRect().toJSON(),
          }));
        return {
          document: document.documentElement.scrollWidth - viewportWidth,
          offenders,
        };
      });
      if (!response || response.status() >= 500 || overflow.document > 1) {
        failures.push({ width, route, status: response?.status(), ...overflow });
      }
    }
    await page.close();
  }
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exitCode = 1;
} else {
  console.log(`Responsive smoke passed: ${routes.length} routes × ${widths.length} widths.`);
}
