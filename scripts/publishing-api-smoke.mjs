// Live security checks against disposable publishing fixtures only.
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const f = JSON.parse(await readFile(process.argv[2], "utf8")),
  base = process.argv[3],
  cleanup = process.argv[4] === "cleanup";
assert.ok(f.slug.startsWith("e2e-"));
const account = cleanup ? f.owner : f.viewer;
const db = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY);
assert.equal(
  (await db.auth.signInWithPassword({ email: account.email, password: account.password })).error,
  null,
);
const p = await db.from("plugins").select("id").eq("slug", f.slug).single();
assert.equal(p.error, null);
const browser = await chromium.launch({ headless: true, channel: "chrome" }),
  page = await browser.newPage();
try {
  await page.goto(`${base}/dashboard?tab=developer`);
  await page.getByLabel("Email", { exact: true }).fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("heading", { name: "Account dashboard", exact: true }).waitFor();
  await page.waitForFunction(() =>
    performance
      .getEntriesByType("resource")
      .some((r) => r.name.includes("/assets/plugin-download-")),
  );
  const result = await page.evaluate(
    async ({ id, cleanup }) => {
      const url = performance
        .getEntriesByType("resource")
        .find((r) => r.name.includes("/assets/plugin-download-")).name;
      const module = await import(url);
      const call = Object.values(module).find(
        (fn) => typeof fn === "function" && fn.toString().includes("Please sign in to continue."),
      );
      if (!call) throw new Error("Publishing client export not found");
      if (cleanup) {
        await call("reserve_upload", {
          id,
          kind: "screenshot",
          name: "cleanup.png",
          mime: "image/png",
          size: 100,
        });
        return { cleaned: true };
      }
      let foreignDenied = false;
      try {
        await call("load", { id });
      } catch {
        foreignDenied = true;
      }
      if (!foreignDenied) throw new Error("Foreign editor access allowed");
      const download = await call("download", { id, file_path: "attacker-selected-path" });
      return { foreignDenied, signedUrl: download.signedUrl };
    },
    { id: p.data.id, cleanup },
  );
  if (!cleanup) {
    const versions = await db
      .from("plugin_versions")
      .select("file_path")
      .eq("plugin_id", p.data.id)
      .eq("is_current", true)
      .single();
    assert.equal(versions.error, null);
    const publicAttempt = await fetch(
      `${process.env.VITE_SUPABASE_URL}/storage/v1/object/public/plugin-files/${versions.data.file_path}`,
    );
    assert.equal(publicAttempt.ok, false);
    const directSign = await db.storage
      .from("plugin-files")
      .createSignedUrl(versions.data.file_path, 60);
    assert.ok(directSign.error);
    const permitted = await fetch(result.signedUrl);
    assert.equal(permitted.ok, true);
    await permitted.arrayBuffer();
    console.log(
      "Foreign editor denied; path injection ignored; private object and direct signing denied. Waiting for URL expiry.",
    );
    await new Promise((r) => setTimeout(r, 75000));
    const expired = await fetch(result.signedUrl);
    assert.equal(expired.ok, false);
    console.log("Signed URL expiry verified.");
  } else console.log("Expired disposable uploads cleaned through the production workflow.");
} finally {
  await db.auth.signOut();
  await browser.close();
}
