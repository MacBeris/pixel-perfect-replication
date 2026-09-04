// Run against a disposable account only; its credentials are kept outside git.
// PLAYWRIGHT_MODULE may point to a preinstalled Playwright package.
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const credentials = JSON.parse(await readFile(process.argv[2], "utf8"));
const base = process.argv[3] || "http://127.0.0.1:8080";
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const failures = [];
page.on("pageerror", (e) => failures.push(e.message));
try {
  await page.goto(`${base}/dashboard?tab=developer`);
  await page.getByRole("heading", { name: "Welcome to Extendly" }).waitFor();
  assert.match(page.url(), /next=/);
  await page.getByLabel("Email", { exact: true }).fill(credentials.email);
  await page.getByLabel("Password", { exact: true }).fill(credentials.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("heading", { name: "Account dashboard", exact: true }).waitFor();
  assert.equal(new URL(page.url()).searchParams.get("tab"), "developer");
  const nav = page.getByRole("navigation", { name: "Account dashboard" });
  await page
    .getByRole("button", { name: "Become a Developer", exact: true })
    .or(page.getByRole("heading", { name: "Dashboard Test Studio", exact: true }))
    .waitFor();
  if (await page.getByRole("button", { name: "Become a Developer", exact: true }).count()) {
    await page.getByRole("button", { name: "Become a Developer", exact: true }).click();
    await page.getByLabel("Developer name").fill("Dashboard Test Studio");
    await page.getByLabel("Profile slug").fill(`test-studio-${credentials.id}`);
    await page.getByLabel("Description", { exact: true }).fill("Temporary test developer profile.");
    await page.getByLabel("Optional evidence of your work").fill("https://example.com/authorship");
    const avatar = await page.screenshot({ clip: { x: 0, y: 0, width: 64, height: 64 } });
    await page
      .locator("input[type=file]")
      .setInputFiles({ name: "avatar.png", mimeType: "image/png", buffer: avatar });
    await page.getByRole("button", { name: "Activate developer profile" }).click();
  }
  await page.getByRole("heading", { name: "Dashboard Test Studio", exact: true }).waitFor();
  await page.getByRole("heading", { name: "Your developer profile is ready" }).waitFor();
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  assert.equal(
    await page.getByLabel("Optional evidence of your work").inputValue(),
    "https://example.com/authorship",
  );
  await page
    .getByLabel("Description", { exact: true })
    .fill("Updated temporary developer profile.");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await page.getByRole("heading", { name: "Your developer profile is ready" }).waitFor();
  await page.screenshot({ path: ".wrangler/dashboard-desktop.png", fullPage: true });
  for (const [tab, heading] of [
    ["Overview", "Make this space your own"],
    ["Library", "Your library"],
    ["Favorites", "Your favorites"],
    ["Wishlist", "Your wishlist"],
    ["Reviews", "Your reviews"],
    ["Settings", "Account profile"],
  ]) {
    await nav.getByRole("link", { name: tab.toLowerCase(), exact: true }).click();
    await page.getByRole("heading", { name: heading, exact: true }).waitFor();
  }
  await page.getByLabel("Display name").fill("Dashboard smoke account");
  await page.getByRole("button", { name: "Save settings", exact: true }).click();
  await page
    .getByRole("button", { name: "Save settings", exact: true })
    .waitFor({ state: "visible" });
  await nav.getByRole("link", { name: "collections", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Smoke collection");
  await page.getByLabel("Slug", { exact: true }).fill(`smoke-${credentials.id}`);
  await page.getByRole("button", { name: "Save collection", exact: true }).click();
  await page.getByRole("button", { name: /Smoke collection/ }).click();
  await page.getByRole("heading", { name: "Collection plugins", exact: true }).waitFor();
  await page.getByText("This collection is empty.", { exact: true }).waitFor();
  await page.getByLabel("Find plugins to add").fill("tree");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.waitForFunction(() => !document.body.innerText.includes("Loading your dashboard"));
  await nav.getByRole("link", { name: "developer", exact: true }).click();
  await page.getByRole("heading", { name: "Dashboard Test Studio", exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: ".wrangler/dashboard-mobile.png", fullPage: true });
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    "Mobile page overflows",
  );
  await page.goto(`${base}/dashboard?tab=unknown`);
  await page.getByRole("heading", { name: "Make this space your own" }).waitFor();
  await page.goto(`${base}/developer/dashboard`);
  await page.getByRole("heading", { name: "Dashboard Test Studio", exact: true }).waitFor();
  await page.goto(`${base}/developers/test-studio-${credentials.id}`);
  await page.getByRole("heading", { name: "Dashboard Test Studio", exact: true }).waitFor();
  await page.getByRole("button", { name: "Account", exact: true }).click();
  await page.getByRole("menuitem", { name: "Sign out", exact: true }).click();
  await page.goto(`${base}/dashboard?tab=developer`);
  await page.getByRole("heading", { name: "Welcome to Extendly" }).waitFor();
  assert.deepEqual(failures, []);
  console.log(
    "PASS: authenticated redirects, onboarding, avatar upload, evidence, profile edit, all account tabs, collections, public profile, mobile layout, aliases and logout.",
  );
} catch (error) {
  console.error("Page state:", await page.locator("body").innerText());
  console.error("Browser errors:", failures);
  throw error;
} finally {
  await browser.close();
}
