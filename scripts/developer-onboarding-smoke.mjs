import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const f = JSON.parse(await readFile(process.argv[2], "utf8"));
assert.ok(f.slug.startsWith("e2e-"));
const base = process.argv[3],
  account = f.viewer;
const db = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY);
assert.equal((await db.auth.signInWithPassword(account)).error, null);
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto(base + "/dashboard?tab=developer");
  await page.getByLabel("Email", { exact: true }).fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "Become a Developer", exact: true }).click();
  await page.getByLabel("Developer name", { exact: true }).fill("Draft retention test");
  await page.getByLabel("Profile slug", { exact: false }).fill(f.slug + "-viewer");
  await page.locator('select[name="account_type"]').selectOption("organization");
  await page
    .getByLabel("Description", { exact: true })
    .fill("Testing persistence across sections.");
  await page.getByLabel("Show my developer profile publicly").uncheck();
  const png = await page.screenshot({ clip: { x: 0, y: 0, width: 64, height: 64 } });
  await page
    .getByLabel("Avatar", { exact: false })
    .setInputFiles({ name: "retained-avatar.png", mimeType: "image/png", buffer: png });
  const nav = page.getByRole("navigation", { name: "Account dashboard", exact: true });
  await nav.getByRole("link", { name: "overview", exact: true }).click();
  await nav.getByRole("link", { name: "developer", exact: true }).click();
  assert.equal(
    await page.getByLabel("Developer name", { exact: true }).inputValue(),
    "Draft retention test",
  );
  assert.equal(await page.locator('select[name="account_type"]').inputValue(), "organization");
  assert.equal(await page.getByLabel("Show my developer profile publicly").isChecked(), false);
  await page.getByText("retained-avatar.png selected.", { exact: false }).waitFor();
  await page.screenshot({ path: ".wrangler/onboarding-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel("Dashboard section").selectOption("overview");
  await page.getByLabel("Dashboard section").selectOption("developer");
  assert.equal(
    await page.getByLabel("Developer name", { exact: true }).inputValue(),
    "Draft retention test",
  );
  await page.screenshot({ path: ".wrangler/onboarding-mobile.png", fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Become a Developer", exact: true }).click();
  assert.equal(await page.getByLabel("Developer name", { exact: true }).inputValue(), "");
  await page.getByLabel("Developer name", { exact: true }).fill("Completed onboarding test");
  await page.getByLabel("Profile slug", { exact: false }).fill(f.slug + "-viewer");
  await page.getByRole("button", { name: "Activate developer profile", exact: true }).click();
  await page
    .getByRole("heading", { name: "Your developer profile is ready", exact: true })
    .waitFor();
  assert.equal(
    await page.evaluate(
      (id) => localStorage.getItem("extendly:developer-profile:" + id),
      account.id,
    ),
    null,
  );
  const profiles = await db.from("developer_profiles").select("id").eq("owner_id", account.id);
  assert.equal(profiles.data?.length, 1);
  console.log("Onboarding persistence, avatar retention, mobile, cancel and activation passed.");
  assert.deepEqual(errors, []);
} catch (e) {
  await page.screenshot({ path: ".wrangler/onboarding-failure.png", fullPage: true });
  console.error((await page.locator("body").innerText()).slice(-3000));
  throw e;
} finally {
  await db.auth.signOut();
  await browser.close();
}
