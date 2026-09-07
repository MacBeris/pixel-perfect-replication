import type { SourceAdapter, SourceKey } from "./types.ts";
import { wordpressAdapter } from "./sources/wordpress.ts";
import { blenderAdapter } from "./sources/blender.ts";
import { chromeAdapter, shopifyAdapter } from "./sources/stubs.ts";

const adapters = new Map<SourceKey, SourceAdapter>(
  [wordpressAdapter, blenderAdapter, chromeAdapter, shopifyAdapter].map((adapter) => [adapter.key, adapter as SourceAdapter]),
);

export function getAdapter(source: SourceKey): SourceAdapter {
  const adapter = adapters.get(source);
  if (!adapter) throw new Error(`Unknown source: ${source}`);
  return adapter;
}
