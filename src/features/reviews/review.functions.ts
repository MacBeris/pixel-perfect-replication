import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const identity = z.object({ accessToken: z.string().min(1), pluginId: z.string().uuid() });
export const reviewEligibility = createServerFn({ method: "POST" })
  .validator((value: unknown) => identity.parse(value))
  .handler(async ({ data }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: auth, error } = await db.auth.getUser(data.accessToken);
    if (error || !auth.user) throw new Error("Please sign in again.");
    const [allowed, own] = await Promise.all([
      db.rpc("review_download_eligibility", { _user_id: auth.user.id, _plugin_id: data.pluginId }),
      db
        .from("reviews")
        .select("id,rating,title,body,status,updated_at")
        .eq("plugin_id", data.pluginId)
        .eq("user_id", auth.user.id)
        .maybeSingle(),
    ]);
    if (allowed.error || own.error)
      throw new Error("Review permissions are temporarily unavailable.");
    return {
      allowed: Boolean(allowed.data) && (!own.data || own.data.status === "active"),
      own: own.data,
    };
  });

const input = identity.extend({
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(160),
  body: z.string().trim().max(5000),
});
export const saveReview = createServerFn({ method: "POST" })
  .validator((value: unknown) => input.parse(value))
  .handler(async ({ data }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: auth, error: authError } = await db.auth.getUser(data.accessToken);
    if (authError || !auth.user) throw new Error("Your session has expired. Please sign in again.");
    const { data: result, error } = await db.rpc("save_plugin_review", {
      _actor: auth.user.id,
      _plugin_id: data.pluginId,
      _rating: data.rating,
      _title: data.title,
      _body: data.body,
    });
    if (error) throw new Error(error.message);
    return result;
  });
