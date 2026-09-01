import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PluginGrid } from "@/features/plugins/plugin-grid";
import type { PluginListItem } from "@/types/catalog";

const PLUGIN_SELECT =
  "plugin:plugins(id,name,slug,logo_url,short_description,price,currency,pricing_model,is_open_source,rating_average,reviews_count,downloads_count,updated_at,platform:platforms(name,slug))";

export const Route = createFileRoute("/_authenticated/favorites")({
  head: () => ({
    meta: [
      { title: "Favorites — Extendly" },
      { name: "description", content: "Plugins and extensions you saved as favorites on Extendly." },
      { property: "og:title", content: "Favorites — Extendly" },
      { property: "og:description", content: "Your saved plugins on Extendly." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FavoritesPage,
});

function FavoritesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["favorites"],
    queryFn: async () => {
      const { data, error } = await supabase.from("favorites").select(PLUGIN_SELECT);
      if (error) throw error;
      return (data ?? []).map((row) => row.plugin).filter(Boolean) as unknown as PluginListItem[];
    },
  });

  return (
    <div className="container-page py-14">
      <h1 className="text-3xl font-semibold md:text-4xl">Favorites</h1>
      <p className="mt-2 text-sm text-muted-foreground">Plugins you starred while browsing.</p>
      <div className="mt-8">
        <PluginGrid plugins={data ?? []} isLoading={isLoading} emptyMessage="No favorites yet." />
      </div>
    </div>
  );
}
