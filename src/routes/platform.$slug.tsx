import { createFileRoute, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PluginGrid } from "@/features/plugins/plugin-grid";
import { fetchPlugins } from "@/services/catalog";
import { siteUrl } from "@/lib/site";
import { getPlatformSeo } from "@/features/seo/seo.functions";

const platformCopy: Record<string, string> = {
  wordpress:
    "Discover WordPress plugins for websites and WooCommerce stores. Compare extensions and follow official source and download links.",
  blender:
    "Discover Blender extensions for modeling, animation, rendering and creative workflows. Compare add-ons and visit their official sources.",
};

export const Route = createFileRoute("/platform/$slug")({
  loader: async ({ params }) => {
    const platform = await getPlatformSeo({ data: { slug: params.slug } });
    if (!platform) throw notFound();
    return platform;
  },
  head: ({ params, loaderData }) => {
    const name = loaderData?.name ?? params.slug;
    const title = `${name} Plugins and Extensions | ExtendShare`;
    const description =
      platformCopy[params.slug] ??
      loaderData?.description ??
      `Discover plugins, extensions and add-ons for ${name} on ExtendShare.`;
    const canonical = siteUrl(`/platform/${params.slug}`);
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: canonical },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: canonical }],
    };
  },
  component: PlatformPage,
});

function PlatformPage() {
  const { slug } = Route.useParams();
  const platform = Route.useLoaderData();

  const { data, isLoading } = useQuery({
    queryKey: ["plugins", "platform", slug],
    queryFn: () => fetchPlugins({ platformSlug: slug, limit: 48 }),
  });

  return (
    <div className="container-page py-10 sm:py-14">
      <h1 className="break-words text-3xl font-semibold md:text-4xl">
        {platform.name} plugins and extensions
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        {platformCopy[slug] ??
          platform.description ??
          `Browse plugins, extensions and add-ons made for ${platform.name}.`}
      </p>
      <div className="mt-8">
        <PluginGrid plugins={data ?? []} isLoading={isLoading} skeletonCount={8} />
      </div>
    </div>
  );
}
