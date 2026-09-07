import type { Database } from "@/integrations/supabase/types";

export type Platform = Database["public"]["Tables"]["platforms"]["Row"];
export type Category = Database["public"]["Tables"]["categories"]["Row"];
export type PluginRow = Database["public"]["Tables"]["plugins"]["Row"];
export type PricingModel = Database["public"]["Enums"]["pricing_model"];

export type PluginListItem = Pick<
  PluginRow,
  | "id"
  | "name"
  | "slug"
  | "logo_url"
  | "short_description"
  | "price"
  | "currency"
  | "pricing_model"
  | "is_open_source"
  | "rating_average"
  | "reviews_count"
  | "downloads_count"
  | "updated_at"
  | "listing_type"
> & {
  platform: Pick<Platform, "name" | "slug"> | null;
  developer: { name: string; slug: string } | null;
  plugin_assets?: { asset_type: string; public_url: string | null }[];
  source: string | null;
  source_url: string | null;
  source_author_name: string | null;
  source_rating_average: number | null;
  source_ratings_count: number | null;
  source_installs_count: number | null;
  source_downloads_count: number | null;
};

export type PluginSort =
  "popular" | "trending" | "top_rated" | "newest" | "most_downloaded" | "price_asc" | "price_desc";
