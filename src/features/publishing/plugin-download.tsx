import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { publishing } from "./client";
import { message } from "@/features/dashboard/data";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export function PluginDistribution({ plugin }: { plugin: Tables<"plugins"> }) {
  const { user } = useAuth();
  const [selectedImage, setSelectedImage] = useState<string>();
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
  const gallery = q.data.assets.filter((a) => a.asset_type === "screenshot" && a.public_url);
  const selected = gallery.find((a) => a.id === selectedImage) ?? gallery[0];
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
      {selected && (
        <div className="space-y-3">
          <img
            src={selected.public_url ?? ""}
            alt={selected.alt_text || `${plugin.name} screenshot`}
            className="aspect-video max-h-[520px] w-full rounded-xl border bg-secondary/30 object-contain"
          />
          <div className="flex gap-2 overflow-x-auto p-1" aria-label="Plugin screenshots">
            {gallery.map((asset, i) => (
              <button
                key={asset.id}
                type="button"
                aria-label={`Show screenshot ${i + 1}`}
                aria-pressed={selected.id === asset.id}
                onClick={() => setSelectedImage(asset.id)}
                className={`shrink-0 rounded-lg border-2 p-1 ${selected.id === asset.id ? "border-primary" : "border-transparent"}`}
              >
                <img
                  src={asset.public_url ?? ""}
                  alt=""
                  className="h-14 w-24 rounded object-contain"
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
export function DownloadButton({ pluginId, test = false }: { pluginId: string; test?: boolean }) {
  const cache = useQueryClient();
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
            void cache.invalidateQueries({ queryKey: ["account"] });
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
