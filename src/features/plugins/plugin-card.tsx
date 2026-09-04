import { Link } from "@tanstack/react-router";
import { Download, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { PluginListItem } from "@/types/catalog";

function formatPrice(plugin: PluginListItem) {
  if (plugin.pricing_model === "free" || Number(plugin.price) === 0) return "Free";
  return `${plugin.currency === "USD" ? "$" : ""}${Number(plugin.price).toFixed(2)}`;
}

export function PluginCard({ plugin }: { plugin: PluginListItem }) {
  const cover = plugin.plugin_assets?.find((asset) => asset.asset_type === "cover")?.public_url;
  return (
    <Link
      to="/plugins/$slug"
      params={{ slug: plugin.slug }}
      className="group flex h-full flex-col rounded-xl border border-border bg-card p-5 shadow-card transition-all hover:border-border-strong hover:shadow-elevated"
    >
      {cover && (
        <img
          src={cover}
          alt=""
          className="mb-4 h-32 w-full rounded-lg border object-cover"
          loading="lazy"
        />
      )}
      <div className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface font-display text-sm font-semibold text-muted-foreground">
          {plugin.logo_url ? (
            <img
              src={plugin.logo_url}
              alt={`${plugin.name} logo`}
              className="size-full object-cover"
              loading="lazy"
            />
          ) : (
            plugin.name.slice(0, 2).toUpperCase()
          )}
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-foreground">{plugin.name}</h3>
          <p className="text-xs text-muted-foreground">
            {plugin.platform?.name ?? "Unknown platform"}
          </p>
        </div>
        <span className="ml-auto text-sm font-medium text-foreground">{formatPrice(plugin)}</span>
      </div>

      <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{plugin.short_description}</p>

      <div className="mt-auto flex items-center gap-3 pt-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Star className="size-3.5 fill-current text-warning" />
          {Number(plugin.rating_average).toFixed(1)}
          <span className="text-muted-foreground/70">({plugin.reviews_count})</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <Download className="size-3.5" />
          {plugin.downloads_count}
        </span>
        {plugin.is_open_source ? (
          <Badge variant="secondary" className="ml-auto text-[10px]">
            Open source
          </Badge>
        ) : null}
      </div>
    </Link>
  );
}
