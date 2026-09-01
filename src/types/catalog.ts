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
> & {
  platform: Pick<Platform, "name" | "slug"> | null;
};

export type PluginSort =
  | "popular"
  | "trending"
  | "top_rated"
  | "newest"
  | "most_downloaded"
  | "price_asc"
  | "price_desc";
