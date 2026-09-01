import { supabase } from "@/integrations/supabase/client";
import type { Category, Platform, PluginListItem, PluginSort } from "@/types/catalog";

const PLUGIN_LIST_SELECT =
  "id,name,slug,logo_url,short_description,price,currency,pricing_model,is_open_source,rating_average,reviews_count,downloads_count,updated_at,platform:platforms(name,slug)";

export async function fetchPlatforms(): Promise<Platform[]> {
  const { data, error } = await supabase
    .from("platforms")
    .select("*")
    .eq("active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export type PluginQuery = {
  search?: string;
  platformSlug?: string;
  categorySlug?: string;
  pricingModel?: string;
  openSourceOnly?: boolean;
  minRating?: number;
  sort?: PluginSort;
  limit?: number;
};

/**
 * Single entry point for catalog search. The search engine (PostgreSQL FTS in
 * the MVP) is isolated here so it can be swapped later without touching UI.
 */
export async function fetchPlugins(params: PluginQuery = {}): Promise<PluginListItem[]> {
  const {
    search,
    platformSlug,
    categorySlug,
    pricingModel,
    openSourceOnly,
    minRating,
    sort = "popular",
    limit = 24,
  } = params;

  // Inner joins are required so the related-table filters actually restrict rows.
  const selectClause = [
    PLUGIN_LIST_SELECT.replace(
      "platform:platforms(name,slug)",
      platformSlug ? "platform:platforms!inner(name,slug)" : "platform:platforms(name,slug)",
    ),
    categorySlug ? "plugin_categories!inner(category:categories!inner(slug))" : null,
  ]
    .filter(Boolean)
    .join(",");

  let query = supabase
    .from("plugins")
    .select(selectClause)
    .eq("moderation_status", "approved")
    .limit(limit);

  if (search && search.trim()) {
    query = query.textSearch("search_vector", search.trim().split(/\s+/).join(" & "));
  }
  if (platformSlug) query = query.eq("platforms.slug", platformSlug);
  if (categorySlug) query = query.eq("plugin_categories.categories.slug", categorySlug);
  if (pricingModel) query = query.eq("pricing_model", pricingModel as never);
  if (openSourceOnly) query = query.eq("is_open_source", true);
  if (typeof minRating === "number") query = query.gte("rating_average", minRating);

  switch (sort) {
    case "trending":
      query = query.order("views_count", { ascending: false });
      break;
    case "top_rated":
      query = query.order("rating_average", { ascending: false });
      break;
    case "newest":
      query = query.order("published_at", { ascending: false, nullsFirst: false });
      break;
    case "most_downloaded":
      query = query.order("downloads_count", { ascending: false });
      break;
    case "price_asc":
      query = query.order("price", { ascending: true });
      break;
    case "price_desc":
      query = query.order("price", { ascending: false });
      break;
    default:
      query = query.order("purchases_count", { ascending: false });
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as PluginListItem[];
}
