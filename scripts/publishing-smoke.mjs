// Disposable fixtures only. Usage: node --env-file=.env scripts/publishing-smoke.mjs <credentials> <base> <create|download>
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const fixture = JSON.parse(await readFile(process.argv[2], "utf8"));
const base = process.argv[3],
  stage = process.argv[4] || "create";
const account = stage === "create" ? fixture.owner : fixture.viewer;
const db = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY);
const login = await db.auth.signInWithPassword({
  email: account.email,
  password: account.password,
});
assert.equal(login.error, null);
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  acceptDownloads: true,
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.setDefaultTimeout(20000);
function zip() {
  const name = Buffer.from("README.txt"),
    body = Buffer.from("Extendly publishing test\n");
  let crc = 0xffffffff;
  for (const b of body) {
    crc ^= b;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  crc = (crc ^ 0xffffffff) >>> 0;
  const h = Buffer.alloc(30);
  h.writeUInt32LE(0x04034b50);
  h.writeUInt16LE(20, 4);
  h.writeUInt32LE(crc, 14);
  h.writeUInt32LE(body.length, 18);
  h.writeUInt32LE(body.length, 22);
  h.writeUInt16LE(name.length, 26);
  const c = Buffer.alloc(46);
  c.writeUInt32LE(0x02014b50);
  c.writeUInt16LE(20, 4);
  c.writeUInt16LE(20, 6);
  c.writeUInt32LE(crc, 16);
  c.writeUInt32LE(body.length, 20);
  c.writeUInt32LE(body.length, 24);
  c.writeUInt16LE(name.length, 28);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(c.length + name.length, 12);
  end.writeUInt32LE(h.length + name.length + body.length, 16);
  return Buffer.concat([h, name, body, c, name, end]);
}
try {
  await page.goto(`${base}/dashboard?tab=developer`);
  await page.getByLabel("Email", { exact: true }).fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("heading", { name: "Account dashboard", exact: true }).waitFor();
  if (stage === "create") {
    await page
      .getByRole("button", { name: /Create your first plugin|^Create plugin$/ })
      .first()
      .click();
    await page.getByLabel("Name", { exact: true }).fill("Publishing Test Plugin");
    await page.getByLabel("Slug", { exact: true }).fill(fixture.slug);
    await page
      .getByLabel("Short description", { exact: true })
      .fill("A temporary plugin to verify secure publishing.");
    await page.getByLabel("Platform", { exact: true }).selectOption({ index: 1 });
    await page
      .locator("fieldset")
      .filter({ has: page.locator("legend").filter({ hasText: "categories" }) })
      .last()
      .locator("input[type=checkbox]")
      .first()
      .check();
    await page.getByLabel("New tags (comma-separated, up to 5)").fill(fixture.tag);
    await page.getByRole("button", { name: "Save and continue", exact: true }).click();
    await page
      .getByLabel(/Full description/)
      .fill(
        "A temporary plugin with installation instructions and requirements for regression testing.",
      );
    await page.getByLabel("Supported versions / compatibility").fill("Blender 4 and 5");
    await page.getByLabel("License", { exact: true }).fill("MIT");
    await page.getByRole("button", { name: "Save and continue", exact: true }).click();
    const png = await page.screenshot({ clip: { x: 0, y: 0, width: 64, height: 64 } });
    await page
      .getByLabel("logo", { exact: true })
      .setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: png });
    await page.getByText("File uploaded and verified.", { exact: true }).waitFor();
    await page
      .getByLabel("screenshot", { exact: true })
      .setInputFiles({ name: "screen.png", mimeType: "image/png", buffer: png });
    await page.locator('img[alt="screenshot"]').waitFor();
    await page.getByRole("button", { name: "Save and continue", exact: true }).click();
    await page.getByRole("button", { name: "Save and continue", exact: true }).click();
    await page.getByLabel("Changelog", { exact: true }).fill("Initial test release");
    await page.getByLabel("Version compatibility", { exact: true }).fill("Blender 4 and 5");
    await page
      .getByLabel(/ZIP package/)
      .setInputFiles({ name: "test.zip", mimeType: "application/zip", buffer: zip() });
    await page.getByText("A verified ZIP is attached.", { exact: false }).waitFor();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Test download ZIP", exact: true }).click();
    assert.equal((await download).suggestedFilename(), `${fixture.slug}-1.0.0.zip`);
    await page.getByRole("button", { name: "Save and continue", exact: true }).click();
    await page.screenshot({ path: ".wrangler/publishing-review.png", fullPage: true });
    await page.getByRole("button", { name: "Submit for review", exact: true }).click();
    await page.getByRole("heading", { name: "Submission received", exact: true }).waitFor();
    const { data: plugin, error } = await db
      .from("plugins")
      .select("id,moderation_status,downloads_count")
      .eq("slug", fixture.slug)
      .single();
    assert.equal(error, null);
    assert.equal(plugin.moderation_status, "pending_review");
    assert.equal(plugin.downloads_count, 0);
    const forbidden = await db
      .from("plugins")
      .update({ moderation_status: "approved" })
      .eq("id", plugin.id);
    assert.ok(forbidden.error);
    const denied = await db.rpc("publishing_action", {
      _actor: account.id,
      _action: "download",
      _input: { id: plugin.id },
    });
    assert.ok(denied.error);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: ".wrangler/publishing-mobile.png", fullPage: true });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    console.log(JSON.stringify({ stage, pluginId: plugin.id, status: plugin.moderation_status }));
  } else {
    await page.goto(`${base}/plugins/${fixture.slug}`);
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download ZIP", exact: true }).click();
    const file = await download;
    assert.equal(file.suggestedFilename(), `${fixture.slug}-1.0.0.zip`);
    assert.equal(await file.failure(), null);
    const second = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download ZIP", exact: true }).click();
    await second;
    const { data: plugin, error } = await db
      .from("plugins")
      .select("id,downloads_count")
      .eq("slug", fixture.slug)
      .single();
    assert.equal(error, null);
    assert.equal(plugin.downloads_count, 1);
    await page.goto(
      `${base}/dashboard?tab=developer&view=edit&plugin=${plugin.id}&profile=${fixture.profileId}`,
    );
    await page
      .getByRole("heading", { name: "Developer profile unavailable", exact: true })
      .waitFor();
    console.log(JSON.stringify({ stage, downloads: plugin.downloads_count }));
  }
  assert.deepEqual(errors, []);
} catch (error) {
  await page.screenshot({ path: ".wrangler/publishing-failure.png", fullPage: true });
  console.error((await page.locator("body").innerText()).slice(-5000));
  throw error;
} finally {
  await db.auth.signOut();
  await browser.close();
}
