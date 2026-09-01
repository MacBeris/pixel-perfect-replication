import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PluginGrid } from "@/features/plugins/plugin-grid";
import { fetchCategories, fetchPlugins } from "@/services/catalog";

export const Route = createFileRoute("/category/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug} plugins by category — Extendly` },
      { name: "description", content: `Browse ${params.slug} plugins, extensions and add-ons on Extendly.` },
      { property: "og:title", content: `${params.slug} plugins — Extendly` },
      { property: "og:description", content: `Browse the ${params.slug} category on Extendly.` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
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
