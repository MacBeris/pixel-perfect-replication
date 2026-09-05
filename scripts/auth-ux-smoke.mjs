import { createRequire } from "node:module";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
let requests = 0,
  code = "invalid_credentials",
  offline = false;
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route("**/auth/v1/token?**", async (route) => {
  requests++;
  if (offline) return route.abort("failed");
  await route.fulfill({
    status: code === "over_request_rate_limit" ? 429 : 400,
    contentType: "application/json",
    body: JSON.stringify({ code, error_code: code, msg: "Internal backend message" }),
  });
});
try {
  await page.goto(process.argv[2] + "/auth");
  const email = page.getByLabel("Email", { exact: true }),
    password = page.getByLabel("Password", { exact: true });
  const submit = page.getByRole("button", { name: "Sign in", exact: true });
  await email.fill("not-an-email");
  await password.fill("some-password");
  await submit.click();
  await page
    .getByText("Enter a valid email address, such as you@gmail.com.", { exact: true })
    .waitFor();
  assert.equal(requests, 0);
  await email.fill("someone@gmail.com");
  for (let i = 1; i <= 4; i++) {
    await submit.click();
    await page.getByRole("alert").waitFor();
    await page.waitForFunction(() => !document.querySelector('button[type="submit"]').disabled);
    assert.equal(requests, i);
  }
  assert.equal(await password.inputValue(), "some-password");
  await page.getByRole("button", { name: "Show password", exact: true }).click();
  assert.equal(await password.getAttribute("type"), "text");
  code = "over_request_rate_limit";
  await submit.click();
  await page.getByText(/Too many requests in a short time/).waitFor();
  await page.waitForFunction(() => !document.querySelector('button[type="submit"]').disabled);
  code = "invalid_credentials";
  await submit.click();
  await page
    .getByText("The email or password is incorrect. Check both and try again.", { exact: true })
    .waitFor();
  assert.equal(requests, 6);
  await page.screenshot({ path: ".wrangler/auth-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: ".wrangler/auth-mobile.png", fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.getByRole("tab", { name: "Create account", exact: true }).click();
  await password.fill("short");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await page.getByText("Use at least 8 characters for your password.", { exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "Auth UX passed: invalid email sends no request; four failed attempts remain retryable; rate-limit recovery; retained fields; password toggle; mobile; signup validation.",
  );
} finally {
  await browser.close();
}
