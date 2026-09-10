import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PluginGrid } from "@/features/plugins/plugin-grid";
import { fetchPlugins, type PluginQuery } from "@/services/catalog";
import { t } from "@/lib/i18n";

type Props = {
  title: string;
  description?: string;
  query: PluginQuery;
  queryKey: string;
  viewAllSearch?: Record<string, string | undefined>;
};

export function PluginSection({ title, description, query, queryKey, viewAllSearch }: Props) {
  const { data, error, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["plugins", queryKey],
    queryFn: () => fetchPlugins({ limit: 4, ...query }),
  });

  return (
    <section className="container-page py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold md:text-2xl">{title}</h2>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        <Link
          to="/plugins"
          search={viewAllSearch ?? {}}
          className="inline-flex shrink-0 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          {t("common.viewAll")} <ArrowRight className="size-4" />
        </Link>
      </div>

      <div className="mt-6">
        {error ? (
          <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center">
            <p className="text-sm font-medium text-foreground">Plugins could not be loaded.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Check your connection and try again.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              disabled={isFetching}
              onClick={() => void refetch()}
            >
              {isFetching ? "Retrying…" : "Try again"}
            </Button>
          </div>
        ) : (
          <PluginGrid
            plugins={data ?? []}
            isLoading={isLoading}
            emptyMessage="No plugins published here yet."
          />
        )}
      </div>
    </section>
  );
}
