import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const interaction = z.object({
  pluginId: z.string().uuid(),
  type: z.enum(["page_view", "outbound_click"]),
  visitorId: z.string().uuid(),
  accessToken: z.string().min(1).optional(),
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
      _actor: actor,
      _session_hash: sessionHash,
    });
    if (error) throw new Error(error.message);
    return z
      .object({ counted: z.boolean(), url: z.string().url().nullable().optional() })
      .parse(result);
  });
