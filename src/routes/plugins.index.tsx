import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PluginGrid } from "@/features/plugins/plugin-grid";
import { fetchPlatforms, fetchPlugins } from "@/services/catalog";
import type { PluginSort } from "@/types/catalog";
import { t } from "@/lib/i18n";

type PluginSearch = {
  q?: string;
  platform?: string;
  pricing?: string;
  openSource?: string;
  sort?: PluginSort;
};

export const Route = createFileRoute("/plugins/")({
  validateSearch: (search: Record<string, unknown>): PluginSearch => ({
    q: typeof search['q'] === "string" ? search['q'] : undefined,
    platform: typeof search['platform'] === "string" ? search['platform'] : undefined,
    pricing: typeof search['pricing'] === "string" ? search['pricing'] : undefined,
    openSource: typeof search['openSource'] === "string" ? search['openSource'] : undefined,
    sort: typeof search['sort'] === "string" ? (search['sort'] as PluginSort) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Explore plugins and extensions — Extendly" },
      {
        name: "description",
        content:
          "Search and filter plugins, extensions and add-ons by platform, category, pricing, license and rating on Extendly.",
      },
      { property: "og:title", content: "Explore plugins and extensions — Extendly" },
      {
        property: "og:description",
        content: "Search the Extendly catalog by platform, pricing, license and rating.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PluginsPage,
});

const sortOptions: { value: PluginSort; label: string }[] = [
  { value: "popular", label: "Popular" },
  { value: "trending", label: "Trending" },
  { value: "top_rated", label: "Top rated" },
  { value: "newest", label: "Newest" },
  { value: "most_downloaded", label: "Most downloaded" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
];

function PluginsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [term, setTerm] = useState(search.q ?? "");

  const { data: platforms } = useQuery({ queryKey: ["platforms"], queryFn: fetchPlatforms });
  const { data, isLoading } = useQuery({
    queryKey: ["plugins", "explore", search],
    queryFn: () =>
      fetchPlugins({
        limit: 48,
        ...(search.q ? { search: search.q } : {}),
        ...(search.platform ? { platformSlug: search.platform } : {}),
        ...(search.pricing ? { pricingModel: search.pricing } : {}),
        ...(search.openSource === "true" ? { openSourceOnly: true } : {}),
        sort: search.sort ?? "popular",
      }),
  });

  function update(patch: Partial<PluginSearch>) {
    navigate({ search: (prev) => ({ ...prev, ...patch }) });
  }

  return (
    <div className="container-page py-12">
      <h1 className="text-3xl font-semibold md:text-4xl">Explore plugins</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Search across every supported platform, filter by pricing and license, and sort what matters.
      </p>

      <form
        className="mt-8 flex flex-col gap-3 lg:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          update({ q: term || undefined });
        }}
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder={t("search.placeholder")}
            className="h-11 pl-9"
            aria-label={t("search.placeholder")}
          />
        </div>

        <Select
          value={search.platform ?? "all"}
          onValueChange={(value) => update({ platform: value === "all" ? undefined : value })}
        >
          <SelectTrigger className="h-11 lg:w-48">
            <SelectValue placeholder="Platform" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All platforms</SelectItem>
            {(platforms ?? []).map((platform) => (
              <SelectItem key={platform.id} value={platform.slug}>
                {platform.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={search.pricing ?? "all"}
          onValueChange={(value) => update({ pricing: value === "all" ? undefined : value })}
        >
          <SelectTrigger className="h-11 lg:w-40">
            <SelectValue placeholder="Pricing" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any pricing</SelectItem>
            <SelectItem value="free">Free</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="freemium">Freemium</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={search.sort ?? "popular"}
          onValueChange={(value) => update({ sort: value as PluginSort })}
        >
          <SelectTrigger className="h-11 lg:w-52">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            {sortOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button type="submit" className="h-11">
          Search
        </Button>
      </form>

      <div className="mt-8">
        <PluginGrid
          plugins={data ?? []}
          isLoading={isLoading}
          skeletonCount={8}
          emptyMessage="No plugins match these filters yet."
        />
      </div>
    </div>
  );
}
