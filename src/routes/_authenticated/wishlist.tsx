import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PluginGrid } from "@/features/plugins/plugin-grid";
import type { PluginListItem } from "@/types/catalog";

const PLUGIN_SELECT =
  "plugin:plugins(id,name,slug,logo_url,short_description,price,currency,pricing_model,is_open_source,rating_average,reviews_count,downloads_count,updated_at,platform:platforms(name,slug))";

export const Route = createFileRoute("/_authenticated/wishlist")({
  head: () => ({
    meta: [
      { title: "Wishlist — Extendly" },
      { name: "description", content: "Paid plugins you plan to buy later on Extendly." },
      { property: "og:title", content: "Wishlist — Extendly" },
      { property: "og:description", content: "Plugins you saved to buy later on Extendly." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WishlistPage,
});

function WishlistPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["wishlist"],
    queryFn: async () => {
      const { data, error } = await supabase.from("wishlists").select(PLUGIN_SELECT);
      if (error) throw error;
      return (data ?? []).map((row) => row.plugin).filter(Boolean) as unknown as PluginListItem[];
    },
  });

  return (
    <div className="container-page py-14">
      <h1 className="text-3xl font-semibold md:text-4xl">Wishlist</h1>
      <p className="mt-2 text-sm text-muted-foreground">Plugins you want to buy later.</p>
      <div className="mt-8">
        <PluginGrid plugins={data ?? []} isLoading={isLoading} emptyMessage="Your wishlist is empty." />
      </div>
    </div>
  );
}
