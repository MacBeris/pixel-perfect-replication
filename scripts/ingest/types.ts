export type SourceKey = "wordpress" | "blender" | "chrome" | "shopify";

export type ExternalAsset = {
  type: "cover" | "screenshot";
  url: string;
  alt: string;
  sort_order: number;
};

export type NormalizedSourcePlugin = {
  source: SourceKey;
  external_id: string;
  slug: string;
  name: string;
  short_description: string;
  description: string | null;
  author_name: string | null;
  author_url: string | null;
  source_url: string;
  homepage_url: string | null;
  version: string | null;
  pricing_type: "free";
  price: 0;
  currency: string;
  license: string | null;
  is_open_source: boolean;
  rating: number | null;
  ratings_count: number | null;
  installs_count: number | null;
  downloads_count: number | null;
  category_slugs: string[];
  tags: Array<{ name: string; slug: string }>;
  icon_url: string | null;
  assets: ExternalAsset[];
  compatibility: string | null;
  published_at: string | null;
  source_updated_at: string | null;
};

export type FetchOptions = {
  limit?: number;
  pages?: number;
  verbose: boolean;
};

export interface HttpClient {
  json<T>(url: string, init?: RequestInit): Promise<T>;
}

export interface SourceAdapter<TRaw = unknown> {
  readonly key: SourceKey;
  readonly platformSlug: string;
  fetchList(http: HttpClient, options: FetchOptions): AsyncGenerator<TRaw>;
  fetchDetails(http: HttpClient, externalId: string): Promise<TRaw | null>;
  normalize(raw: TRaw): NormalizedSourcePlugin;
  getExternalId(raw: TRaw): string;
  getSourceUrl(raw: TRaw): string;
  checkPresence?(http: HttpClient, externalIds: string[]): Promise<Map<string, boolean>>;
}

export interface EnrichmentStage {
  enrich(plugin: NormalizedSourcePlugin): Promise<NormalizedSourcePlugin>;
}

export const noOpEnrichment: EnrichmentStage = {
  async enrich(plugin) {
    return plugin;
  },
};

