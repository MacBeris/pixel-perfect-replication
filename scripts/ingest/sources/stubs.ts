import type { SourceAdapter } from "../types.ts";

function stub(key: "chrome" | "shopify", platformSlug: string): SourceAdapter {
  const unavailable = async () => { throw new Error(`${key} adapter not implemented; see docs/external-ingestion.md`); };
  return {
    key, platformSlug,
    async *fetchList() { await unavailable(); yield undefined as never; },
    fetchDetails: unavailable,
    normalize() { throw new Error(`${key} adapter not implemented`); },
    getExternalId() { throw new Error(`${key} adapter not implemented`); },
    getSourceUrl() { throw new Error(`${key} adapter not implemented`); },
  };
}

export const chromeAdapter = stub("chrome", "chrome");
export const shopifyAdapter = stub("shopify", "shopify");
