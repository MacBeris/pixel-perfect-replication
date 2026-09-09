import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const slugInput = z.object({ slug: z.string().min(1).max(200) });

export const getPluginSeo = createServerFn({ method: "GET" })
  .validator((value: unknown) => slugInput.parse(value))
  .handler(async ({ data }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: plugin, error } = await db
      .from("plugins")
      .select(
        "name,slug,short_description,compatibility,logo_url,moderation_status,developer_unpublished_at,developer_removed_at,source_hidden_at,source,source_url,platform:platforms(name,slug),plugin_assets(asset_type,public_url)",
      )
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!plugin) return { exists: false as const, public: false as const };

    const isPublic =
      plugin.moderation_status === "approved" &&
      !plugin.developer_unpublished_at &&
      !plugin.developer_removed_at &&
      !plugin.source_hidden_at;
    if (!isPublic) return { exists: true as const, public: false as const };
    return { exists: true as const, public: true as const, plugin };
  });

export const getPlatformSeo = createServerFn({ method: "GET" })
  .validator((value: unknown) => slugInput.parse(value))
  .handler(async ({ data }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: platform, error } = await db
      .from("platforms")
      .select("name,slug,description")
      .eq("slug", data.slug)
      .eq("active", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return platform;
  });

export const getCategorySeo = createServerFn({ method: "GET" })
  .validator((value: unknown) => slugInput.parse(value))
  .handler(async ({ data }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: category, error } = await db
      .from("categories")
      .select("name,slug,description")
      .eq("slug", data.slug)
      .eq("active", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return category;
  });
