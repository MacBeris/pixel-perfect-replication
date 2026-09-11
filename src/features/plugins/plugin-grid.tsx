import { PluginCard } from "@/features/plugins/plugin-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import type { PluginListItem } from "@/types/catalog";

type Props = {
  plugins: PluginListItem[];
  isLoading?: boolean;
  emptyMessage?: string;
  skeletonCount?: number;
};

export function PluginGrid({ plugins, isLoading, emptyMessage = "Nothing here yet.", skeletonCount = 4 }: Props) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: skeletonCount }).map((_, index) => (
          <Skeleton key={index} className="h-40 rounded-xl" />
        ))}
      </div>
    );
  }

  if (!plugins.length) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {plugins.map((plugin) => (
        <PluginCard key={plugin.id} plugin={plugin} />
      ))}
    </div>
  );
}

export function PluginGridError({ retry, retrying = false }: { retry: () => void; retrying?: boolean }) {
  return (
    <div role="alert" className="rounded-xl border border-dashed border-border bg-surface p-8 text-center">
      <p className="text-sm font-medium text-foreground">Plugins could not be loaded.</p>
      <p className="mt-1 text-sm text-muted-foreground">Check your connection and try again.</p>
      <Button variant="outline" size="sm" className="mt-4" disabled={retrying} onClick={retry}>
        {retrying ? "Retrying…" : "Try again"}
      </Button>
    </div>
  );
}
