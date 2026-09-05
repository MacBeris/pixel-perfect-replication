import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || "playwright");
const account = JSON.parse(await readFile(process.argv[2], "utf8"));
const base = process.argv[3];
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
try {
  await page.goto(base + "/auth");
  await page.getByLabel("Email", { exact: true }).fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/dashboard**");
  await page.goto(base + "/auth/callback?next=%2Fdashboard%3Ftab%3Dsettings");
  await page.getByRole("heading", { name: "You’re signed in", exact: true }).waitFor();
  await page.getByRole("button", { name: "Return to Extendly", exact: true }).click();
  await page.waitForURL("**/dashboard?tab=settings*");
  assert.ok(await page.getByLabel("username", { exact: false }).inputValue());
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  console.log("Callback success, return target, required username and mobile layout passed.");
} finally {
  await browser.close();
}
