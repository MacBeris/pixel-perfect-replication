import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { PluginDistribution } from "@/features/publishing/plugin-download";
import { PluginReviews } from "@/features/reviews/plugin-reviews";
import { Download, Star } from "lucide-react";

export const Route = createFileRoute("/plugins/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug} — plugin on Extendly` },
      {
        name: "description",
        content: `Details, pricing, versions and reviews for ${params.slug} on Extendly.`,
      },
      { property: "og:title", content: `${params.slug} — plugin on Extendly` },
      {
        property: "og:description",
        content: `Details, pricing, versions and reviews for ${params.slug}.`,
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PluginDetail,
});

function PluginDetail() {
  const { slug } = Route.useParams();
  const { user, loading } = useAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: ["account", user?.id ?? "public", "plugin", slug],
    enabled: !loading,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plugins")
        .select("*, platform:platforms(name,slug)")
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
    return (
      <div className="container-page py-24 text-center">
        <h1 className="text-2xl font-semibold">Plugin not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This plugin doesn&apos;t exist or hasn&apos;t been approved yet.
        </p>
        <Link to="/plugins" className="mt-6 inline-block text-sm text-primary hover:underline">
          Back to catalog
        </Link>
      </div>
    );
  }

  return (
    <article className="container-page py-14">
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
      <div className="mt-4 flex flex-wrap gap-2">
        <Badge variant="secondary">{data.pricing_model}</Badge>
        {data.is_open_source ? <Badge variant="secondary">Open source</Badge> : null}
        {data.current_version ? <Badge variant="outline">v{data.current_version}</Badge> : null}
      </div>
      <div className="mt-7 flex flex-wrap gap-3 text-sm">
        <a
          href="#reviews"
          className="inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-2 transition hover:border-primary"
        >
          <Star className="size-4 fill-warning text-warning" />
          {data.reviews_count ? data.rating_average.toFixed(1) : "No ratings"}
          <span className="text-muted-foreground">
            · {data.reviews_count} {data.reviews_count === 1 ? "review" : "reviews"}
          </span>
        </a>
        <span className="inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
          <Download className="size-4" />
          {data.downloads_count.toLocaleString("en-US")}{" "}
          {data.downloads_count === 1 ? "download" : "downloads"}
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
