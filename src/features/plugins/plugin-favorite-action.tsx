import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Heart, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type SavedState = { favorites: string[] };
const emptyState: SavedState = { favorites: [] };

function useFavorites() {
  const { user, loading } = useAuth();
  const query = useQuery({
    queryKey: ["favorites", user?.id],
    enabled: !loading && !!user,
    queryFn: async (): Promise<SavedState> => {
      const favorites = await supabase
        .from("favorites")
        .select("plugin_id")
        .eq("user_id", user!.id);
      if (favorites.error) throw favorites.error;
      return { favorites: favorites.data.map((row) => row.plugin_id) };
    },
  });
  return { user, loading, ...query, data: query.data ?? emptyState };
}

export function PluginFavoriteAction({
  pluginId,
  compact = false,
  className,
}: {
  pluginId: string;
  compact?: boolean;
  className?: string;
}) {
  const navigate = useNavigate();
  const cache = useQueryClient();
  const saved = useFavorites();
  const mutation = useMutation({
    mutationFn: async ({ active }: { active: boolean }) => {
      if (!saved.user) throw new Error("Sign in to save plugins.");
      const response = active
        ? await supabase
            .from("favorites")
            .delete()
            .eq("user_id", saved.user.id)
            .eq("plugin_id", pluginId)
        : await supabase
            .from("favorites")
            .upsert(
              { user_id: saved.user.id, plugin_id: pluginId },
              { onConflict: "user_id,plugin_id", ignoreDuplicates: true },
            );
      if (response.error) throw response.error;
      return { active };
    },
    onMutate: async ({ active }) => {
      if (!saved.user) return;
      const key = ["favorites", saved.user.id];
      await cache.cancelQueries({ queryKey: key });
      const previous = cache.getQueryData<SavedState>(key);
      cache.setQueryData<SavedState>(key, (current = emptyState) => ({
        favorites: active
          ? current.favorites.filter((id) => id !== pluginId)
          : Array.from(new Set([...current.favorites, pluginId])),
      }));
      return { key, previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous) cache.setQueryData(context.key, context.previous);
      toast.error(error instanceof Error ? error.message : "Could not update your favorites.");
    },
    onSuccess: ({ active }) =>
      toast.success(active ? "Removed from favorites" : "Added to favorites"),
    onSettled: async () => {
      if (!saved.user) return;
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["favorites", saved.user.id] }),
        cache.invalidateQueries({ queryKey: ["account", saved.user.id] }),
        cache.invalidateQueries({ queryKey: ["plugins"] }),
      ]);
    },
  });

  const active = saved.data.favorites.includes(pluginId);
  function toggle() {
    if (!saved.user) {
      void navigate({ to: "/auth", search: { next: "/dashboard?tab=favorites" } });
      return;
    }
    mutation.mutate({ active });
  }

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      <Button
        type="button"
        size={compact ? "sm" : "default"}
        variant="outline"
        className={cn(
          active
            ? "border-primary/45 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
            : "text-muted-foreground hover:text-foreground",
        )}
        aria-pressed={active}
        aria-label={`${active ? "Remove from" : "Add to"} Favorites`}
        disabled={saved.loading || mutation.isPending}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          toggle();
        }}
      >
        {mutation.isPending ? (
          <LoaderCircle className="animate-spin" />
        ) : (
          <Heart className={cn(active && "fill-primary text-primary")} />
        )}
        {compact ? "Favorites" : `${active ? "Remove from" : "Add to"} Favorites`}
      </Button>
    </div>
  );
}
