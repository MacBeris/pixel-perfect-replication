import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PluginGrid } from "@/features/plugins/plugin-grid";
import { fetchCategories, fetchPlugins } from "@/services/catalog";
import { siteUrl } from "@/lib/site";

export const Route = createFileRoute("/category/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug} plugins by category — ExtendShare` },
      { name: "description", content: `Browse ${params.slug} plugins, extensions and add-ons on ExtendShare.` },
      { property: "og:title", content: `${params.slug} plugins — ExtendShare` },
      { property: "og:description", content: `Browse the ${params.slug} category on ExtendShare.` },
      { property: "og:type", content: "website" },
      { property: "og:url", content: siteUrl(`/category/${params.slug}`) },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: siteUrl(`/category/${params.slug}`) }],
  }),
  component: CategoryPage,
});

function CategoryPage() {
  const { slug } = Route.useParams();
  const { data: categories } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const category = (categories ?? []).find((item) => item.slug === slug);

  const { data, isLoading } = useQuery({
    queryKey: ["plugins", "category", slug],
    queryFn: () => fetchPlugins({ categorySlug: slug, limit: 48 }),
  });

  return (
    <div className="container-page py-14">
      <h1 className="text-3xl font-semibold md:text-4xl">{category?.name ?? slug}</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        {category?.description ?? "Plugins and extensions in this category."}
      </p>
      <div className="mt-8">
        <PluginGrid plugins={data ?? []} isLoading={isLoading} skeletonCount={8} />
      </div>
    </div>
  );
}
