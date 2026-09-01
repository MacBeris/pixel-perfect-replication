import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PluginGrid } from "@/features/plugins/plugin-grid";
import { fetchPlatforms, fetchPlugins } from "@/services/catalog";

export const Route = createFileRoute("/platform/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug} plugins and extensions — Extendly` },
      { name: "description", content: `Browse plugins, extensions and add-ons for ${params.slug} on Extendly.` },
      { property: "og:title", content: `${params.slug} plugins — Extendly` },
      { property: "og:description", content: `Browse the ${params.slug} catalog on Extendly.` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PlatformPage,
});

function PlatformPage() {
  const { slug } = Route.useParams();
  const { data: platforms } = useQuery({ queryKey: ["platforms"], queryFn: fetchPlatforms });
  const platform = (platforms ?? []).find((item) => item.slug === slug);

  const { data, isLoading } = useQuery({
    queryKey: ["plugins", "platform", slug],
    queryFn: () => fetchPlugins({ platformSlug: slug, limit: 48 }),
  });

  return (
    <div className="container-page py-14">
      <h1 className="text-3xl font-semibold md:text-4xl">{platform?.name ?? slug} plugins</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        {platform?.description ?? "Plugins, extensions and add-ons for this platform."}
      </p>
      <div className="mt-8">
        <PluginGrid plugins={data ?? []} isLoading={isLoading} skeletonCount={8} />
      </div>
    </div>
  );
}
