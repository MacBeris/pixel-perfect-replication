import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { publishing } from "./client";
import { message } from "@/features/dashboard/data";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export function PluginDistribution({ plugin }: { plugin: Tables<"plugins"> }) {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["account", user?.id ?? "public", "distribution", plugin.id],
    queryFn: async () => {
      const [versions, assets, purchases, profile, roles] = await Promise.all([
        supabase
          .from("plugin_versions")
          .select("id,is_current,status,file_verified_at")
          .eq("plugin_id", plugin.id),
        supabase
          .from("plugin_assets")
          .select("id,asset_type,public_url,alt_text")
          .eq("plugin_id", plugin.id)
          .order("sort_order"),
        user
          ? supabase
              .from("purchases")
              .select("id")
              .eq("user_id", user.id)
              .eq("plugin_id", plugin.id)
              .in("status", ["paid", "partially_refunded"])
          : Promise.resolve({ data: [], error: null }),
        user && plugin.developer_id
          ? supabase
              .from("developer_profiles")
              .select("id")
              .eq("id", plugin.developer_id)
              .eq("owner_id", user.id)
          : Promise.resolve({ data: [], error: null }),
        user
          ? supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin")
          : Promise.resolve({ data: [], error: null }),
      ]);
      for (const r of [versions, assets, purchases, profile, roles]) if (r.error) throw r.error;
      return {
        versions: versions.data ?? [],
        assets: assets.data ?? [],
        owned: Boolean(profile.data?.length || roles.data?.length),
        purchased: Boolean(purchases.data?.length),
      };
    },
  });
  if (q.isPending)
    return <p className="mt-6 text-sm text-muted-foreground">Loading distribution details…</p>;
  if (q.error)
    return (
      <p className="mt-6 text-sm text-destructive">Distribution unavailable. Please reload.</p>
    );
  const current = q.data.versions.some(
    (v) => v.is_current && v.status === "published" && v.file_verified_at,
  );
  const test = q.data.owned && q.data.versions.some((v) => v.file_verified_at);
  let url: string | undefined;
  try {
    const u = new URL(plugin.external_purchase_url ?? "");
    if (u.protocol === "https:" && !u.username && !u.password) url = u.href;
  } catch {
    /* No valid external URL. */
  }
  return (
    <div className="mt-8 space-y-6">
      {plugin.listing_type === "external_listing" ? (
        plugin.moderation_status === "approved" &&
        url &&
        (user ? (
          <ExternalButton pluginId={plugin.id} />
        ) : (
          <Button asChild>
            <a href={url} rel="nofollow noopener noreferrer">
              Visit external platform
            </a>
          </Button>
        ))
      ) : test ? (
        <DownloadButton pluginId={plugin.id} test />
      ) : plugin.moderation_status === "approved" && current ? (
        plugin.pricing_model !== "free" && !q.data.purchased ? (
          <p className="text-sm text-muted-foreground">
            Purchase unavailable — marketplace payments are coming soon.
          </p>
        ) : user ? (
          <DownloadButton pluginId={plugin.id} />
        ) : (
          <Button asChild>
            <Link to="/auth">Sign in to download ZIP</Link>
          </Button>
        )
      ) : (
        <p className="text-sm text-muted-foreground">No published ZIP is available.</p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {q.data.assets
          .filter((a) => a.asset_type !== "logo" && a.public_url)
          .map((a) => (
            <img
              key={a.id}
              src={a.public_url ?? ""}
              alt={a.alt_text ?? `${plugin.name} ${a.asset_type}`}
              className="w-full rounded-xl border object-contain"
            />
          ))}
      </div>
    </div>
  );
}
export function DownloadButton({ pluginId, test = false }: { pluginId: string; test?: boolean }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div>
      <Button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const data = z
              .object({ signedUrl: z.string().url() })
              .parse(await publishing("download", { id: pluginId }));
            window.location.assign(data.signedUrl);
          } catch (e) {
            setError(message(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Preparing download…" : test ? "Test download ZIP" : "Download ZIP"}
      </Button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
export function ExternalButton({ pluginId }: { pluginId: string }) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div>
      <Button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const data = z
              .object({ url: z.string().url() })
              .parse(await publishing("outbound", { id: pluginId }));
            window.location.assign(data.url);
          } catch (e) {
            setError(message(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        Visit external platform
      </Button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
