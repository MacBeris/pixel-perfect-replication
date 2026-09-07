import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export const tabs = [
  "overview",
  "library",
  "favorites",
  "wishlist",
  "collections",
  "reviews",
  "developer",
  "settings",
] as const;
export type Tab = (typeof tabs)[number];
export const searchSchema = z.object({
  tab: z.enum(tabs).catch("overview").default("overview"),
  profile: z.string().uuid().optional().catch(undefined),
  plugin: z.string().uuid().optional().catch(undefined),
  view: z.enum(["analytics", "versions", "profile", "create", "edit"]).optional().catch(undefined),
  range: z.enum(["7", "30", "90", "365", "all"]).catch("30").default("30"),
  page: z.coerce.number().int().min(1).max(100000).catch(1).default(1),
});
export type DashboardSearch = z.infer<typeof searchSchema>;
export type Developer = Tables<"developer_profiles">;
export const pluginSelect =
  "id,name,slug,logo_url,short_description,price,currency,pricing_model,is_open_source,rating_average,reviews_count,downloads_count,updated_at,listing_type,source,source_url,source_author_name,source_rating_average,source_ratings_count,source_installs_count,source_downloads_count,platform:platforms(name,slug),developer:developer_profiles(name,slug),plugin_assets(asset_type,public_url)" as const;
export const developerFields =
  "id,owner_id,name,slug,account_type,description,avatar_url,website_url,github_url,twitter_url,is_public,created_at,updated_at" as const;
export type DeveloperProfile = Pick<
  Developer,
  | "id"
  | "owner_id"
  | "name"
  | "slug"
  | "account_type"
  | "description"
  | "avatar_url"
  | "website_url"
  | "github_url"
  | "twitter_url"
  | "is_public"
  | "created_at"
  | "updated_at"
>;
const pluginDetailSchema = z.object({
  cover_url: z.string().nullable(),
  versions: z.array(
    z.object({
      id: z.string(),
      version_number: z.string(),
      status: z.string(),
      is_current: z.boolean(),
      compatibility: z.string().nullable(),
      released_at: z.string().nullable(),
      created_at: z.string(),
      changelog: z.string().nullable(),
    }),
  ),
  reviews: z.array(
    z.object({
      id: z.string(),
      rating: z.number(),
      title: z.string().nullable(),
      body: z.string().nullable(),
      username: z.string(),
      created_at: z.string(),
    }),
  ),
  activity: z.array(z.object({ action: z.string(), created_at: z.string() })),
});
export const analyticsSchema = z.object({
  totals: z.object({
    plugins: z.number(),
    published: z.number(),
    drafts: z.number(),
    pending: z.number(),
    rejected: z.number(),
    downloads: z.number(),
    views: z.number(),
    reviews: z.number(),
    favorites: z.number(),
    wishlist: z.number(),
    rating: z.number().nullable(),
  }),
  history: z.object({
    available: z.boolean(),
    coverage: z.literal("tracked"),
    started_at: z.string().nullable(),
    metric_started_at: z.object({
      views: z.string().nullable(),
      downloads: z.string().nullable(),
      outbound_clicks: z.string().nullable(),
    }),
    bucket: z.enum(["day", "month"]),
    downloads_last_30_days: z.number(),
    outbound_clicks: z.number(),
    series: z.array(
      z.object({
        date: z.string(),
        views: z.number(),
        downloads: z.number(),
        outbound_clicks: z.number(),
      }),
    ),
  }),
  plugins: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      slug: z.string(),
      logo_url: z.string().nullable(),
      moderation_status: z.string(),
      listing_type: z.string(),
      current_version: z.string().nullable(),
      downloads_count: z.number(),
      views_count: z.number(),
      rating_average: z.number(),
      reviews_count: z.number(),
      updated_at: z.string(),
      rejection_reason: z.string().nullable(),
      developer_unpublished_at: z.string().nullable(),
      developer_removed_at: z.string().nullable(),
      developer_removed_by: z.string().nullable(),
      platform: z.string().nullable(),
      source: z.string().nullable(),
      source_installs_count: z.number().nullable(),
      source_downloads_count: z.number().nullable(),
      source_rating_average: z.number().nullable(),
      source_ratings_count: z.number().nullable(),
    }),
  ),
  recent_reviews: z.array(
    z.object({
      id: z.string(),
      plugin_id: z.string(),
      plugin_name: z.string(),
      title: z.string().nullable(),
      body: z.string().nullable(),
      rating: z.number(),
      created_at: z.string(),
    }),
  ),
  versions: z.array(
    z.object({
      id: z.string(),
      version_number: z.string(),
      status: z.string(),
      is_current: z.boolean(),
      released_at: z.string().nullable(),
      created_at: z.string(),
      changelog: z.string().nullable(),
    }),
  ),
  detail: pluginDetailSchema.nullable(),
});
export type Analytics = z.infer<typeof analyticsSchema>;
export async function loadAnalytics(profile: string, search: DashboardSearch) {
  const [dashboard, detail] = await Promise.all([
    supabase.rpc("developer_dashboard", {
      _developer_id: profile,
      ...(search.plugin ? { _plugin_id: search.plugin } : {}),
      _range: search.range,
      _page: search.plugin ? 1 : search.page,
    }),
    search.plugin
      ? supabase.rpc("developer_plugin_detail", {
          _developer_id: profile,
          _plugin_id: search.plugin,
        })
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (dashboard.error) throw dashboard.error;
  if (detail.error) throw detail.error;
  return analyticsSchema.parse({ ...(dashboard.data as object), detail: detail.data });
}
export function message(error: unknown) {
  return error && typeof error === "object" && "message" in error
    ? String(error.message)
    : "Something went wrong. Please try again.";
}
export function safeDashboardReturn(value: unknown) {
  return typeof value === "string" && /^\/dashboard(?:\?|$)/.test(value) && !/[\r\n\\]/.test(value)
    ? value
    : "/dashboard";
}
