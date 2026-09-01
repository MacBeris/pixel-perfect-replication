import { PluginCard } from "@/features/plugins/plugin-card";
import { Skeleton } from "@/components/ui/skeleton";
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
