import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const interaction = z.object({
  pluginId: z.string().uuid(),
  type: z.enum(["page_view", "outbound_click"]),
  visitorId: z.string().uuid().optional(),
  accessToken: z.string().min(1).optional(),
  analyticsConsent: z.boolean(),
});

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export const recordPluginInteraction = createServerFn({ method: "POST" })
  .validator((value: unknown) => interaction.parse(value))
  .handler(async ({ data }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    if (!data.analyticsConsent) {
      if (data.type === "page_view") return { counted: false };
      const { data: plugin } = await db
        .from("plugins")
        .select("external_purchase_url")
        .eq("id", data.pluginId)
        .eq("listing_type", "external_listing")
        .eq("moderation_status", "approved")
        .is("developer_unpublished_at", null)
        .is("developer_removed_at", null)
        .is("source_hidden_at", null)
        .maybeSingle();
      let url: string | null = null;
      try {
        const parsed = new URL(plugin?.external_purchase_url ?? "");
        if (parsed.protocol === "https:" && !parsed.username && !parsed.password) url = parsed.href;
      } catch {
        // Invalid source URL is returned as unavailable.
      }
      return { counted: false, url };
    }
    if (!data.visitorId) throw new Error("Analytics visitor ID is required after consent");
    let actor: string | null = null;
    if (data.accessToken) {
      const { data: auth } = await db.auth.getUser(data.accessToken);
      actor = auth.user?.id ?? null;
    }
    // The database receives only a one-way pseudonymous key, never an IP address or raw
    // browser identifier. Actor identity is independently verified from the access token.
    const sessionHash = await sha256(`${data.pluginId}:${data.type}:${actor ?? data.visitorId}`);
    const { data: result, error } = await db.rpc("record_plugin_interaction", {
      _plugin_id: data.pluginId,
      _event_type: data.type,
      _actor: actor as string,
      _session_hash: sessionHash,
    });
    if (error) throw new Error(error.message);
    return z
      .object({ counted: z.boolean(), url: z.string().url().nullable().optional() })
      .parse(result);
  });
