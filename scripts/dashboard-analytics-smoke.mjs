import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const credentials = JSON.parse(await readFile(process.argv[2], "utf8"));
const base = process.argv[3] || "http://127.0.0.1:8080";
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto(`${base}/dashboard?tab=developer`);
  await page.getByLabel("Email", { exact: true }).fill(credentials.email);
  await page.getByLabel("Password", { exact: true }).fill(credentials.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("heading", { name: "Your plugins", exact: true }).waitFor();
  await page.getByText("Page 1 of 2", { exact: true }).waitFor();
  assert.equal(await page.getByRole("table").getByRole("row").count(), 21);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByText("Page 2 of 2", { exact: true }).waitFor();
  assert.equal(await page.getByRole("table").getByRole("row").count(), 2);
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await page.getByText("Page 1 of 2", { exact: true }).waitFor();
  await page.getByLabel("Range", { exact: true }).selectOption("all");
  await page.getByRole("heading", { name: "Your plugins", exact: true }).waitFor();
  await page.screenshot({ path: ".wrangler/developer-analytics-desktop.png", fullPage: true });
  const target = page
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name: "Dashboard private fixture 1", exact: true }) });
  await target.getByRole("button", { name: "Analytics", exact: true }).click();
  await page.getByRole("heading", { name: "Dashboard private fixture 1", exact: true }).waitFor();
  await page.getByRole("heading", { name: "Versions", exact: true }).waitFor();
  await page.getByRole("cell", { name: "1.0.0 Current", exact: true }).waitFor();
  const pluginId = new URL(page.url()).searchParams.get("plugin");
  await page.goto(`${base}/developer/plugins/${pluginId}/analytics`);
  await page.getByRole("heading", { name: "Dashboard private fixture 1", exact: true }).waitFor();
  await page.goto(`${base}/plugins/dashboard-fixture-${credentials.id}-1`);
  await page.getByRole("heading", { name: "Dashboard private fixture 1", exact: true }).waitFor();
  await page.getByText("Private preview · draft", { exact: true }).waitFor();
  await page.goto(`${base}/dashboard?tab=reviews`);
  await page.getByLabel("Title", { exact: true }).fill("Updated test review");
  await page.getByLabel("Rating", { exact: true }).selectOption("5");
  await page.getByRole("button", { name: "Save review", exact: true }).click();
  await page.getByText("Changes saved", { exact: true }).waitFor();
  for (const tab of ["favorites", "wishlist"]) {
    await page.goto(`${base}/dashboard?tab=${tab}`);
    await page.getByRole("button", { name: "Remove", exact: true }).click();
    await page
      .getByText("No saved plugins yet. Explore the catalog to get started.", { exact: true })
      .waitFor();
  }
  await page.goto(`${base}/dashboard?tab=developer`);
  await page.getByRole("heading", { name: "Your plugins", exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.getByLabel("Dashboard section", { exact: true }).inputValue(),
    "developer",
  );
  await page.screenshot({ path: ".wrangler/developer-analytics-mobile.png", fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await page.getByLabel("Dashboard section", { exact: true }).selectOption("settings");
  await page.getByRole("heading", { name: "Account profile", exact: true }).waitFor();
  await page.getByLabel("Theme", { exact: true }).selectOption("dark");
  assert.ok(await page.locator("html").evaluate((e) => e.classList.contains("dark")));
  await page.getByLabel("Dashboard section", { exact: true }).selectOption("developer");
  await page.getByRole("heading", { name: "Your plugins", exact: true }).waitFor();
  await page.screenshot({ path: ".wrangler/developer-analytics-dark.png", fullPage: true });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: 21-plugin pagination, time ranges, metrics, versions, legacy plugin analytics, private preview, review edits, favorite/wishlist removal, mobile menu and dark mode.",
  );
} catch (error) {
  console.error("Page state:", await page.locator("body").innerText());
  console.error("Browser errors:", errors);
  throw error;
} finally {
  await browser.close();
}
