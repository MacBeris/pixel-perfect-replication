import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PluginGrid } from "@/features/plugins/plugin-grid";
import type { PluginListItem } from "@/types/catalog";

export const Route = createFileRoute("/_authenticated/library")({
  head: () => ({
    meta: [
      { title: "My library — Extendly" },
      { name: "description", content: "Every plugin you purchased or downloaded on Extendly, in one place." },
      { property: "og:title", content: "My library — Extendly" },
      { property: "og:description", content: "Your purchased plugins and downloads on Extendly." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LibraryPage,
});

function LibraryPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["library"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchases")
        .select("plugin:plugins(id,name,slug,logo_url,short_description,price,currency,pricing_model,is_open_source,rating_average,reviews_count,downloads_count,updated_at,platform:platforms(name,slug))")
        .eq("status", "paid");
      if (error) throw error;
      return (data ?? []).map((row) => row.plugin).filter(Boolean) as unknown as PluginListItem[];
    },
  });

  return (
    <div className="container-page py-14">
      <h1 className="text-3xl font-semibold md:text-4xl">My library</h1>
      <p className="mt-2 text-sm text-muted-foreground">Plugins you own, ready to download.</p>
      <div className="mt-8">
        <PluginGrid plugins={data ?? []} isLoading={isLoading} emptyMessage="You haven't purchased any plugins yet." />
      </div>
    </div>
  );
}
