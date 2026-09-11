import { createFileRoute, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PluginGrid, PluginGridError } from "@/features/plugins/plugin-grid";
import { fetchPlugins } from "@/services/catalog";
import { siteUrl } from "@/lib/site";
import { getCategorySeo } from "@/features/seo/seo.functions";

export const Route = createFileRoute("/category/$slug")({
  loader: async ({ params }) => {
    const category = await getCategorySeo({ data: { slug: params.slug } });
    if (!category) throw notFound();
    return category;
  },
  head: ({ params, loaderData }) => {
    const name = loaderData?.name ?? params.slug;
    const description =
      loaderData?.description ??
      `Discover ${name.toLowerCase()} plugins, extensions and add-ons on ExtendShare.`;
    const title = `${name} Plugins and Extensions | ExtendShare`;
    const canonical = siteUrl(`/category/${params.slug}`);
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
  component: CategoryPage,
});

function CategoryPage() {
  const { slug } = Route.useParams();
  const category = Route.useLoaderData();

  const { data, error, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["plugins", "category", slug],
    queryFn: () => fetchPlugins({ categorySlug: slug, limit: 48 }),
  });

  return (
    <div className="container-page py-10 sm:py-14">
      <h1 className="break-words text-3xl font-semibold md:text-4xl">{category.name} plugins</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        {category.description ?? `Browse plugins and extensions in ${category.name}.`}
      </p>
      <div className="mt-8">
        {error ? (
          <PluginGridError retrying={isFetching} retry={() => void refetch()} />
        ) : (
          <PluginGrid plugins={data ?? []} isLoading={isLoading} skeletonCount={8} />
        )}
      </div>
    </div>
  );
}
