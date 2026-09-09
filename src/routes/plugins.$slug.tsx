import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { PluginDistribution } from "@/features/publishing/plugin-download";
import { PluginReviews } from "@/features/reviews/plugin-reviews";
import { Download, Star } from "lucide-react";
import { PublicPluginView } from "@/features/analytics/plugin-interactions";
import { PluginFavoriteAction } from "@/features/plugins/plugin-favorite-action";
import { siteUrl } from "@/lib/site";
import { getPluginSeo } from "@/features/seo/seo.functions";

function plainText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function truncateWords(value: string, limit: number) {
  const clean = plainText(value);
  if (clean.length <= limit) return clean;
  const shortened = clean.slice(0, Math.max(0, limit - 1));
  return `${shortened.replace(/\s+\S*$/, "").replace(/[.,;:!?\s]+$/, "")}…`;
}

function pluginDescription(plugin: {
  name: string;
  short_description: string;
  compatibility: string | null;
  source: string | null;
  platform: { name: string; slug: string } | null;
}) {
  const platform = plugin.platform?.name ?? "your platform";
  const compatibility = plugin.compatibility
    ? ` Compatible with ${truncateWords(plugin.compatibility, 38)}.`
    : "";
  const source = plugin.source
    ? ` Official ${plugin.source} source and download link.`
    : " Download information on ExtendShare.";
  const prefix = `${plugin.name} for ${platform}.${compatibility}${source}`;
  const remaining = Math.max(0, 165 - prefix.length - 1);
  return `${prefix} ${truncateWords(plugin.short_description, remaining)}`.trim();
}

export const Route = createFileRoute("/plugins/$slug")({
  loader: async ({ params }) => {
    const result = await getPluginSeo({ data: { slug: params.slug } });
    if (!result.exists) throw notFound();
    return result;
  },
  head: ({ params, loaderData }) => {
    const canonical = siteUrl(`/plugins/${params.slug}`);
    if (!loaderData?.public) {
      return {
        meta: [
          { title: "Plugin preview — ExtendShare" },
          { name: "robots", content: "noindex,nofollow" },
        ],
        links: [{ rel: "canonical", href: canonical }],
      };
    }
    const plugin = loaderData.plugin;
    const platform = plugin.platform?.name ?? "Extension";
    const title = `${plugin.name} – ${platform} Plugin | ExtendShare`;
    const description = pluginDescription(plugin);
    const image =
      plugin.plugin_assets.find((asset) => asset.asset_type === "cover")?.public_url ??
      plugin.plugin_assets.find((asset) => asset.asset_type === "screenshot")?.public_url ??
      plugin.logo_url;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: canonical },
        ...(image ? [{ property: "og:image", content: image }] : []),
        { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
      ],
      links: [{ rel: "canonical", href: canonical }],
    };
  },
  notFoundComponent: PluginNotFound,
  component: PluginDetail,
});

function PluginNotFound() {
  return (
    <div className="container-page py-24 text-center">
      <h1 className="text-2xl font-semibold">Plugin not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This plugin doesn&apos;t exist or is not publicly available.
      </p>
      <Link to="/plugins" className="mt-6 inline-block text-sm text-primary hover:underline">
        Back to catalog
      </Link>
    </div>
  );
}

function PluginDetail() {
  const { slug } = Route.useParams();
  const { user, loading } = useAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: ["account", user?.id ?? "public", "plugin", slug],
    enabled: !loading,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plugins")
        .select(
          "*, platform:platforms(name,slug), developer:developer_profiles(name,slug,avatar_url)",
        )
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (loading || isLoading) {
    return (
      <div className="container-page space-y-4 py-14">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error)
    return (
      <div role="alert" className="container-page py-14">
        Could not load this plugin. Please reload the page.
      </div>
    );

  if (!data) {
    return <PluginNotFound />;
  }

  return (
    <article className="container-page py-14">
      {data.moderation_status === "approved" && <PublicPluginView pluginId={data.id} />}
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Link to="/plugins" className="hover:text-foreground">
          Plugins
        </Link>
        <span>/</span>
        <span>{data.platform?.name}</span>
      </div>
      <div className="mt-5 flex items-center gap-4">
        {data.logo_url && (
          <img
            src={data.logo_url}
            alt=""
            className="size-16 shrink-0 rounded-2xl border object-contain md:size-20"
          />
        )}
        <h1 className="min-w-0 break-words text-3xl font-semibold md:text-4xl">{data.name}</h1>
      </div>
      {data.moderation_status !== "approved" && (
        <p className="mt-2 text-sm text-primary">
          Private preview · {data.moderation_status.replaceAll("_", " ")}
        </p>
      )}
      <p className="mt-3 max-w-2xl text-muted-foreground">{data.short_description}</p>
      {data.developer ? (
        <Link
          to="/developers/$slug"
          params={{ slug: data.developer.slug }}
          className="mt-3 inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
        >
          {data.developer.avatar_url && (
            <img
              src={data.developer.avatar_url}
              alt=""
              className="size-6 rounded-full object-cover"
            />
          )}
          by <span className="font-medium text-foreground">{data.developer.name}</span>
        </Link>
      ) : data.source_author_name ? (
        <a
          href={data.source_author_url ?? data.source_url ?? undefined}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex text-sm text-muted-foreground transition hover:text-foreground"
        >
          by <span className="ml-1 font-medium text-foreground">{data.source_author_name}</span>
        </a>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Badge variant="secondary">{data.pricing_model}</Badge>
        {data.is_open_source ? <Badge variant="secondary">Open source</Badge> : null}
        {data.current_version ? <Badge variant="outline">v{data.current_version}</Badge> : null}
      </div>
      <PluginFavoriteAction pluginId={data.id} className="mt-5" />
      <div className="mt-7 flex flex-wrap gap-3 text-sm">
        <a
          href={data.reviews_count > 0 ? "#reviews" : (data.source_url ?? "#reviews")}
          target={data.reviews_count > 0 || !data.source_url ? undefined : "_blank"}
          rel={data.reviews_count > 0 || !data.source_url ? undefined : "noreferrer"}
          className="inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-2 transition hover:border-primary"
        >
          <Star className="size-4 fill-warning text-warning" />
          {data.reviews_count
            ? data.rating_average.toFixed(1)
            : data.source_rating_average !== null
              ? Number(data.source_rating_average).toFixed(1)
              : "No ratings"}
          <span className="text-muted-foreground">
            · {data.reviews_count || data.source_ratings_count || 0}{" "}
            {data.reviews_count
              ? "ExtendShare reviews"
              : data.source_ratings_count
                ? `${data.source} ratings`
                : "reviews"}
          </span>
        </a>
        <span className="inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
          <Download className="size-4" />
          {data.listing_type === "external_listing"
            ? ((data.source_installs_count ?? data.source_downloads_count)?.toLocaleString(
                "en-US",
              ) ?? "—")
            : data.downloads_count.toLocaleString("en-US")}{" "}
          {data.listing_type === "external_listing" && data.source_installs_count !== null
            ? "active installs"
            : data.downloads_count === 1
              ? "download"
              : "downloads"}
        </span>
      </div>
      <PluginDistribution plugin={data} />
      {data.full_description ? (
        <div className="mt-10 max-w-3xl whitespace-pre-line text-sm leading-7 text-foreground/90">
          <h2 className="mb-4 text-2xl font-semibold">Overview</h2>
          {data.full_description}
        </div>
      ) : null}
      <PluginReviews
        key={data.id}
        pluginId={data.id}
        rating={Number(data.rating_average)}
        count={data.reviews_count}
      />
      <section className="mt-12 border-t pt-8">
        <h2 className="text-2xl font-semibold">Details</h2>
        <dl className="mt-5 grid gap-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">Version</dt>
            <dd className="mt-1">{data.current_version || "Not published"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Updated</dt>
            <dd className="mt-1">{new Date(data.updated_at).toLocaleDateString("en-US")}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Platform</dt>
            <dd className="mt-1">{data.platform?.name}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Compatibility</dt>
            <dd className="mt-1 whitespace-pre-wrap">{data.compatibility || "Not specified"}</dd>
          </div>
        </dl>
      </section>
    </article>
  );
}
