/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase aggregate results are normalized at the server boundary. */
import { createServerFn } from "@tanstack/react-start";

type AdminInput = { accessToken: string };
type ModerationStatus = "draft" | "pending_review" | "approved" | "rejected" | "suspended";
type ClaimStatus = "pending" | "approved" | "rejected";
type ReportStatus = "open" | "reviewing" | "resolved" | "dismissed";
type CatalogKind = "platforms" | "categories" | "tags";

function requireToken(input: unknown): AdminInput {
  if (!input || typeof input !== "object" || typeof (input as AdminInput).accessToken !== "string") {
    throw new Error("An authenticated session is required.");
  }
  return input as AdminInput;
}

async function requireAdmin(accessToken: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as any;
  const { data: auth, error: authError } = await admin.auth.getUser(accessToken);
  if (authError || !auth.user) throw new Error("Your session is no longer valid.");

  const { data: role, error: roleError } = await admin
    .from("user_roles")
    .select("id")
    .eq("user_id", auth.user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (roleError || !role) throw new Error("Administrator access is required.");
  return { admin, user: auth.user };
}

export const getAdminDashboard = createServerFn({ method: "POST" })
  .validator(requireToken)
  .handler(async ({ data }) => {
    const { admin, user } = await requireAdmin(data.accessToken);
    const [
      metrics,
      plugins,
      claims,
      reports,
      purchases,
      transactions,
      payouts,
      platforms,
      categories,
      tags,
      audit,
      users,
      developerProfiles,
    ] = await Promise.all([
      admin.rpc("admin_dashboard_metrics", { _actor_id: user.id }),
      admin.from("plugins").select("id,name,slug,moderation_status,short_description,created_at,developer:developer_profiles(name,slug)").order("created_at", { ascending: false }).limit(100),
      admin.from("claims").select("id,status,evidence,message,created_at,developer_profile_id,plugin:plugins(name,slug)").order("created_at", { ascending: false }).limit(100),
      admin.from("reports").select("id,status,reason,details,target_type,created_at,plugin:plugins(name,slug)").order("created_at", { ascending: false }).limit(100),
      admin.from("purchases").select("id,amount,currency,status,created_at").order("created_at", { ascending: false }).limit(100),
      admin.from("transactions").select("id,type,amount,currency,description,created_at").order("created_at", { ascending: false }).limit(100),
      admin.from("payouts").select("id,amount,currency,status,requested_at").order("requested_at", { ascending: false }).limit(100),
      admin.from("platforms").select("id,name,slug,description,active,sort_order").order("sort_order"),
      admin.from("categories").select("id,name,slug,description,active,sort_order").order("sort_order"),
      admin.from("tags").select("id,name,slug,created_at").order("name"),
      admin.from("admin_audit_logs").select("id,actor_id,action,resource_type,resource_id,reason,created_at").order("created_at", { ascending: false }).limit(100),
      admin.auth.admin.listUsers({ page: 1, perPage: 200 }),
      admin.from("developer_profiles").select("id,name,slug,owner_id,is_public,created_at").order("created_at", { ascending: false }).limit(200),
    ]);

    const results = { metrics, plugins, claims, reports, purchases, transactions, payouts, platforms, categories, tags, audit, users, developerProfiles };
    for (const [resource, result] of Object.entries(results)) {
      if (result.error) throw new Error(`Unable to load ${resource}: ${result.error.message}`);
    }

    return {
      metrics: metrics.data,
      plugins: plugins.data ?? [],
      claims: claims.data ?? [],
      reports: reports.data ?? [],
      purchases: purchases.data ?? [],
      transactions: transactions.data ?? [],
      payouts: payouts.data ?? [],
      platforms: platforms.data ?? [],
      categories: categories.data ?? [],
      tags: tags.data ?? [],
      audit: audit.data ?? [],
      users: (users.data?.users ?? []).map((user: any) => ({ id: user.id, email: user.email, created_at: user.created_at, last_sign_in_at: user.last_sign_in_at })),
      developerProfiles: developerProfiles.data ?? [],
    };
  });

export const moderatePlugin = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const data = input as AdminInput & { pluginId: string; status: ModerationStatus; reason?: string };
    if (!data?.pluginId || !["draft", "pending_review", "approved", "rejected", "suspended"].includes(data.status)) throw new Error("Invalid plugin moderation request.");
    return data;
  })
  .handler(async ({ data }) => {
    const { admin, user } = await requireAdmin(data.accessToken);
    if (data.status === "rejected" && !data.reason?.trim()) throw new Error("A rejection reason is required.");
    const { data: after, error } = await admin.rpc("admin_moderate_plugin", { _actor_id: user.id, _plugin_id: data.pluginId, _status: data.status, _reason: data.reason || null });
    if (error) throw new Error(error.message);
    return after;
  });

export const updateAdminWorkflow = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const data = input as AdminInput & ({ kind: "claims"; itemId: string; status: ClaimStatus; notes?: string } | { kind: "reports"; itemId: string; status: ReportStatus; notes?: string });
    const valid = data?.kind === "claims"
      ? ["pending", "approved", "rejected"].includes(data.status)
      : data?.kind === "reports" && ["open", "reviewing", "resolved", "dismissed"].includes(data.status);
    if (!data?.itemId || !valid) throw new Error("Invalid moderation item.");
    return data;
  })
  .handler(async ({ data }) => {
    const { admin, user } = await requireAdmin(data.accessToken);
    const { data: after, error } = await admin.rpc("admin_update_workflow", { _actor_id: user.id, _kind: data.kind, _item_id: data.itemId, _status: data.status, _notes: data.notes || null });
    if (error) throw new Error(error.message);
    return after;
  });

export const saveCatalogItem = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const data = input as AdminInput & { kind: CatalogKind; id?: string; name: string; slug: string; description?: string; active?: boolean; sortOrder?: number };
    if (!data?.name?.trim() || !data?.slug?.trim() || !["platforms", "categories", "tags"].includes(data.kind)) throw new Error("A name, slug and catalog type are required.");
    return data;
  })
  .handler(async ({ data }) => {
    const { admin, user } = await requireAdmin(data.accessToken);
    const { data: after, error } = await admin.rpc("admin_save_catalog_item", { _actor_id: user.id, _kind: data.kind, _id: data.id || null, _name: data.name.trim(), _slug: data.slug.trim(), _description: data.description?.trim() || null, _active: data.active ?? true, _sort_order: data.sortOrder ?? 0 });
    if (error) throw new Error(error.message);
    return after;
  });

export const deleteCatalogItem = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const data = input as AdminInput & { kind: CatalogKind; id: string };
    if (!data?.id || !["platforms", "categories", "tags"].includes(data.kind)) throw new Error("Invalid catalog item.");
    return data;
  })
  .handler(async ({ data }) => {
    const { admin, user } = await requireAdmin(data.accessToken);
    const { error } = await admin.rpc("admin_delete_catalog_item", { _actor_id: user.id, _kind: data.kind, _id: data.id });
    if (error) throw new Error(error.message);
    return { id: data.id };
  });
