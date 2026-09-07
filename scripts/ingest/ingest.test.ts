import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseArgs } from "./cli.ts";
import { blenderAdapter } from "./sources/blender.ts";
import { wordpressAdapter } from "./sources/wordpress.ts";
import { hashJson } from "./utils.ts";

const fixture = async (name: string) => JSON.parse(await readFile(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8"));

test("WordPress normalization preserves factual source metrics", async () => {
  const plugin = wordpressAdapter.normalize(await fixture("wordpress"));
  assert.equal(plugin.external_id, "sample-seo");
  assert.equal(plugin.rating, 4.5);
  assert.equal(plugin.installs_count, 10000);
  assert.equal(plugin.author_name, "Example Author");
  assert.ok(plugin.category_slugs.includes("seo"));
  assert.equal(plugin.assets[0]?.type, "cover");
  assert.equal(plugin.assets.filter((asset) => asset.type === "screenshot").length, 2);
  assert.equal(plugin.assets[1]?.alt, "Main dashboard");
});

test("WordPress uses the first screenshot as cover when no banner exists", async () => {
  const raw = await fixture("wordpress");
  delete raw.banners;
  const plugin = wordpressAdapter.normalize(raw);
  assert.equal(plugin.assets[0]?.type, "cover");
  assert.equal(plugin.assets[0]?.url, plugin.assets[1]?.url);
});

test("Blender normalization leaves unavailable facts null", async () => {
  const plugin = blenderAdapter.normalize(await fixture("blender"));
  assert.equal(plugin.external_id, "tree_tools");
  assert.equal(plugin.rating, null);
  assert.equal(plugin.downloads_count, null);
  assert.equal(plugin.compatibility, "Blender 4.2.0+");
  assert.ok(plugin.category_slugs.includes("3d-modeling"));
});

test("Blender list emits each external ID once", async () => {
  const duplicate = await fixture("blender");
  const alternate = { ...duplicate, id: "another_tool", name: "Another Tool" };
  const http = { json: async () => ({ version: "v1", data: [duplicate, duplicate, alternate] }) };
  const ids: string[] = [];
  for await (const item of blenderAdapter.fetchList(http, { limit: 50, verbose: false })) ids.push(item.id);
  assert.deepEqual(ids, ["tree_tools", "another_tool"]);
});

test("canonical hash is independent of object key order", () => {
  assert.equal(hashJson({ a: 1, b: 2 }), hashJson({ b: 2, a: 1 }));
});

test("CLI parses import and verification options", () => {
  assert.deepEqual(parseArgs(["--source", "wordpress", "--limit", "100", "--force"]), { source: "wordpress", limit: 100, pages: undefined, dryRun: false, force: true, verbose: false, verify: false });
  assert.equal(parseArgs(["--source", "blender", "--verify"]).verify, true);
  assert.throws(() => parseArgs(["--source", "unknown"]), /--source/);
});
