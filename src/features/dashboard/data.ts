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
  "id,name,slug,logo_url,short_description,price,currency,pricing_model,is_open_source,rating_average,reviews_count,downloads_count,updated_at,platform:platforms(name,slug),plugin_assets(asset_type,public_url)" as const;
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
    coverage: z.literal("unknown"),
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
      platform: z.string().nullable(),
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
});
export type Analytics = z.infer<typeof analyticsSchema>;
export async function loadAnalytics(profile: string, search: DashboardSearch) {
  const { data, error } = await supabase.rpc("developer_dashboard", {
    _developer_id: profile,
    ...(search.plugin ? { _plugin_id: search.plugin } : {}),
    _range: search.range,
    _page: search.plugin ? 1 : search.page,
  });
  if (error) throw error;
  return analyticsSchema.parse(data);
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
