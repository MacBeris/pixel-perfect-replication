import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { publishing } from "./client";
import { message } from "@/features/dashboard/data";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Expand } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { interactionIdentity } from "@/features/analytics/interaction-identity";
import { recordPluginInteraction } from "@/features/analytics/analytics.functions";
import { getAnalyticsConsent } from "@/features/privacy/consent";

export function PluginDistribution({ plugin }: { plugin: Tables<"plugins"> }) {
  const { user } = useAuth();
  const location = useLocation();
  const [selectedImage, setSelectedImage] = useState<string>();
  const [lightboxOpen, setLightboxOpen] = useState(false);
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
  const gallery = useMemo(
    () => (q.data?.assets ?? []).filter((a) => a.asset_type === "screenshot" && a.public_url),
    [q.data?.assets],
  );
  const selected = gallery.find((a) => a.id === selectedImage) ?? gallery[0];
  const selectedIndex = selected ? gallery.findIndex((asset) => asset.id === selected.id) : -1;
  const showRelative = useCallback(
    (offset: number) => {
      if (!gallery.length) return;
      const next = (Math.max(0, selectedIndex) + offset + gallery.length) % gallery.length;
      setSelectedImage(gallery[next]?.id);
    },
    [gallery, selectedIndex],
  );
  useEffect(() => {
    if (!lightboxOpen || gallery.length < 2) return;
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        showRelative(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        showRelative(1);
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [lightboxOpen, gallery.length, showRelative]);
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
        plugin.moderation_status === "approved" && url && <ExternalButton pluginId={plugin.id} />
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
            <Link to="/auth" search={{ next: location.pathname }}>
              Sign in to download ZIP
            </Link>
          </Button>
        )
      ) : (
        <p className="text-sm text-muted-foreground">No published ZIP is available.</p>
      )}
      {selected && (
        <div className="space-y-3">
          <div className="relative">
            <button
              type="button"
              className="group relative block w-full overflow-hidden rounded-xl border bg-secondary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              aria-label="Open screenshot in full-size viewer"
              onClick={() => setLightboxOpen(true)}
            >
              <img
                src={selected.public_url ?? ""}
                alt={selected.alt_text || `${plugin.name} screenshot`}
                className="aspect-video max-h-[520px] w-full object-contain transition duration-200 group-hover:scale-[1.01]"
              />
              <span className="absolute bottom-3 right-3 inline-flex size-11 items-center justify-center rounded-full border bg-background/90 text-foreground opacity-90 shadow-sm transition group-hover:bg-background group-hover:opacity-100">
                <Expand className="size-5" aria-hidden="true" />
              </span>
            </button>
            {gallery.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => showRelative(-1)}
                  aria-label="Previous screenshot"
                  className="absolute left-2 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full border bg-background/95 text-foreground shadow-sm transition hover:border-primary/40 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:left-3"
                >
                  <ChevronLeft className="size-6" />
                </button>
                <button
                  type="button"
                  onClick={() => showRelative(1)}
                  aria-label="Next screenshot"
                  className="absolute right-2 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full border bg-background/95 text-foreground shadow-sm transition hover:border-primary/40 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:right-3"
                >
                  <ChevronRight className="size-6" />
                </button>
              </>
            )}
          </div>
          <div className="flex gap-2 overflow-x-auto p-1" aria-label="Plugin screenshots">
            {gallery.map((asset, i) => (
              <button
                key={asset.id}
                type="button"
                aria-label={`Show screenshot ${i + 1}`}
                aria-pressed={selected.id === asset.id}
                onClick={() => setSelectedImage(asset.id)}
                className={`shrink-0 rounded-lg border-2 p-1 transition duration-150 hover:-translate-y-0.5 hover:border-primary/60 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${selected.id === asset.id ? "border-primary bg-primary/5" : "border-transparent"}`}
              >
                <img
                  src={asset.public_url ?? ""}
                  alt=""
                  className="h-14 w-24 rounded object-contain"
                />
              </button>
            ))}
          </div>
          <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
            <DialogContent className="max-w-[min(96vw,1200px)] border-border-strong bg-card p-2 text-foreground shadow-elevated sm:p-4">
              <DialogTitle className="sr-only">{plugin.name} screenshot viewer</DialogTitle>
              <DialogDescription className="sr-only">
                Screenshot {selectedIndex + 1} of {gallery.length}. Use the arrow keys to navigate
                and Escape to close.
              </DialogDescription>
              <div className="relative flex min-h-[50dvh] items-center justify-center">
                <img
                  src={selected.public_url ?? ""}
                  alt={selected.alt_text || `${plugin.name} screenshot`}
                  className="max-h-[85dvh] w-full object-contain"
                />
                {gallery.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => showRelative(-1)}
                      aria-label="Previous screenshot"
                      className="absolute left-2 inline-flex size-12 items-center justify-center rounded-full border bg-background/95 text-foreground shadow-sm transition hover:border-primary/40 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:left-4"
                    >
                      <ChevronLeft className="size-7" />
                    </button>
                    <button
                      type="button"
                      onClick={() => showRelative(1)}
                      aria-label="Next screenshot"
                      className="absolute right-2 inline-flex size-12 items-center justify-center rounded-full border bg-background/95 text-foreground shadow-sm transition hover:border-primary/40 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:right-4"
                    >
                      <ChevronRight className="size-7" />
                    </button>
                  </>
                )}
              </div>
              <p className="pb-1 text-center text-xs text-muted-foreground">
                {selectedIndex + 1} / {gallery.length}
              </p>
            </DialogContent>
          </Dialog>
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
  const cache = useQueryClient();
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
            const analyticsConsent = getAnalyticsConsent() === "accepted";
            const identity = analyticsConsent ? await interactionIdentity() : {};
            const data = await recordPluginInteraction({
              data: {
                pluginId,
                type: "outbound_click",
                analyticsConsent,
                ...identity,
              },
            });
            if (!data.url) throw new Error("External listing unavailable");
            window.location.assign(data.url);
            void cache.invalidateQueries({ queryKey: ["account"] });
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
