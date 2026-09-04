import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";

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
  const { data, isLoading } = useQuery({
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
      <h1 className="mt-3 text-3xl font-semibold md:text-4xl">{data.name}</h1>
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
      {data.full_description ? (
        <div className="mt-10 max-w-3xl whitespace-pre-line text-sm leading-7 text-foreground/90">
          {data.full_description}
        </div>
      ) : null}
    </article>
  );
}
