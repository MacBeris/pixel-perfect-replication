import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import {
  botReason,
  isPrefetch,
  isTrackablePagePath,
  normalizedPath,
} from "./site-analytics.shared";

const pageViewInput = z.object({
  path: z.string().min(1).max(1024),
  visitorId: z.string().uuid(),
  sessionId: z.string().uuid(),
  referrer: z.string().max(2048).optional(),
  accessToken: z.string().min(1).optional(),
});

const adminAnalyticsInput = z.object({
  accessToken: z.string().min(1),
  range: z.enum(["5m", "30m", "24h", "7d", "30d"]),
});

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function safeReferrerHost(value?: string) {
  if (!value) return null;
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host === "extendshare.com" || host === "www.extendshare.com" ? null : host.slice(0, 255);
  } catch {
    return null;
  }
}

export const recordSitePageView = createServerFn({ method: "POST" })
  .validator((value: unknown) => pageViewInput.parse(value))
  .handler(async ({ data }) => {
    const request = getRequest();
    const path = normalizedPath(data.path);
    if (!isTrackablePagePath(path) || isPrefetch(request.headers)) return { counted: false };

    const cf = (request as Request & { cf?: Parameters<typeof botReason>[1] }).cf;
    if (botReason(request.headers.get("user-agent") ?? "", cf)) return { counted: false };

    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    let actorId: string | null = null;
    if (data.accessToken) {
      const { data: auth } = await db.auth.getUser(data.accessToken);
      actorId = auth.user?.id ?? null;
    }
    if (actorId) {
      const { data: adminRole } = await db
        .from("user_roles")
        .select("id")
        .eq("user_id", actorId)
        .eq("role", "admin")
        .maybeSingle();
      if (adminRole) return { counted: false };
    }

    let pluginId: string | null = null;
    const pluginSlug = path.match(/^\/plugins\/([^/?#]+)/)?.[1];
    if (pluginSlug) {
      const { data: plugin } = await db
        .from("plugins")
        .select("id")
        .eq("slug", decodeURIComponent(pluginSlug))
        .eq("moderation_status", "approved")
        .is("developer_unpublished_at", null)
        .is("developer_removed_at", null)
        .maybeSingle();
      pluginId = plugin?.id ?? null;
    }

    const pepper = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "extendshare-analytics-v1";
    const [visitorHash, sessionHash] = await Promise.all([
      sha256(`${pepper}:visitor:${data.visitorId}`),
      sha256(`${pepper}:session:${data.sessionId}`),
    ]);
    const { data: counted, error } = await db.rpc("record_site_page_view", {
      _path: path,
      _plugin_id: pluginId as string,
      _visitor_hash: visitorHash,
      _session_hash: sessionHash,
      _referrer_host: safeReferrerHost(data.referrer) as string,
    });
    if (error) throw new Error(error.message);
    return { counted: Boolean(counted) };
  });

export const getAdminSiteAnalytics = createServerFn({ method: "POST" })
  .validator((value: unknown) => adminAnalyticsInput.parse(value))
  .handler(async ({ data }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: auth, error: authError } = await db.auth.getUser(data.accessToken);
    if (authError || !auth.user) throw new Error("Your session is no longer valid.");
    const { data: role } = await db
      .from("user_roles")
      .select("id")
      .eq("user_id", auth.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) throw new Error("Administrator access is required.");
    const { data: result, error } = await db.rpc("admin_site_analytics", {
      _actor_id: auth.user.id,
      _range: data.range,
    });
    if (error) throw new Error(error.message);
    return result;
  });
