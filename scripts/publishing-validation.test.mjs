import { test } from "node:test";
import assert from "node:assert/strict";
import { validSignature } from "../src/features/publishing/file-validation.ts";
test("accept supported signatures", () => {
  assert.equal(validSignature(Uint8Array.from([80, 75, 3, 4]), "application/zip", true), true);
  assert.equal(
    validSignature(Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]), "image/png", false),
    true,
  );
  assert.equal(validSignature(Uint8Array.from([255, 216, 255]), "image/jpeg", false), true);
  assert.equal(validSignature(new TextEncoder().encode("RIFFxxxxWEBP"), "image/webp", false), true);
});
test("reject spoofed MIME, empty ZIP, truncated signatures and executable content", () => {
  for (const content of [[], [80, 75], [80, 75, 5, 6], [77, 90, 0, 0]])
    assert.equal(validSignature(Uint8Array.from(content), "application/zip", true), false);
  assert.equal(
    validSignature(new TextEncoder().encode('<svg onload="alert(1)">'), "image/png", false),
    false,
  );
  assert.equal(validSignature(Uint8Array.from([255, 216, 255]), "image/png", false), false);
});
