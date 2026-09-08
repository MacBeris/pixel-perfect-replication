import assert from "node:assert/strict";
import test from "node:test";

import {
  botReason,
  isPrefetch,
  isTrackablePagePath,
  normalizedPath,
} from "./site-analytics.shared";

test("recognizes common crawlers without blocking ordinary browsers", () => {
  assert.equal(botReason("Mozilla/5.0 Googlebot/2.1"), "known_bot_user_agent");
  assert.equal(botReason("curl/8.10.1"), "known_bot_user_agent");
  assert.equal(botReason("Mozilla/5.0 Chrome/140 Safari/537.36"), null);
});

test("uses Cloudflare bot signals when available", () => {
  assert.equal(
    botReason("unknown", { botManagement: { verifiedBot: true } }),
    "cloudflare_verified_bot",
  );
  assert.equal(botReason("unknown", { botManagement: { score: 12 } }), "cloudflare_bot_score");
});

test("excludes technical resources and preload traffic", () => {
  assert.equal(isTrackablePagePath("/plugins/example"), true);
  assert.equal(isTrackablePagePath("/assets/app.js"), false);
  assert.equal(isTrackablePagePath("/favicon.ico"), false);
  assert.equal(isTrackablePagePath("/robots.txt"), false);
  assert.equal(isTrackablePagePath("/sitemap.xml"), false);
  assert.equal(isTrackablePagePath("/api/health"), false);
  assert.equal(isPrefetch(new Headers({ Purpose: "prefetch" })), true);
});

test("normalizes URLs to paths without retaining the origin", () => {
  assert.equal(
    normalizedPath("https://extendshare.com/plugins/example?q=1"),
    "/plugins/example?q=1",
  );
});
