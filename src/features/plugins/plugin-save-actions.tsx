import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Heart, ListPlus, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type SavedState = { favorites: string[]; wishlist: string[] };
type SavedList = "favorites" | "wishlist";

const emptyState: SavedState = { favorites: [], wishlist: [] };

function useSavedPlugins() {
  const { user, loading } = useAuth();
  const query = useQuery({
    queryKey: ["saved-plugins", user?.id],
    enabled: !loading && !!user,
    queryFn: async (): Promise<SavedState> => {
      const [favorites, wishlist] = await Promise.all([
        supabase.from("favorites").select("plugin_id").eq("user_id", user!.id),
        supabase.from("wishlists").select("plugin_id").eq("user_id", user!.id),
      ]);
      if (favorites.error) throw favorites.error;
      if (wishlist.error) throw wishlist.error;
      return {
        favorites: favorites.data.map((row) => row.plugin_id),
        wishlist: wishlist.data.map((row) => row.plugin_id),
      };
    },
  });
  return { user, loading, ...query, data: query.data ?? emptyState };
}

export function PluginSaveActions({
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
  const saved = useSavedPlugins();
  const mutation = useMutation({
    mutationFn: async ({ list, active }: { list: SavedList; active: boolean }) => {
      if (!saved.user) throw new Error("Sign in to save plugins.");
      const table = list === "wishlist" ? "wishlists" : "favorites";
      const response = active
        ? await supabase.from(table).delete().eq("user_id", saved.user.id).eq("plugin_id", pluginId)
        : await supabase
            .from(table)
            .upsert(
              { user_id: saved.user.id, plugin_id: pluginId },
              { onConflict: "user_id,plugin_id", ignoreDuplicates: true },
            );
      if (response.error) throw response.error;
      return { list, active };
    },
    onMutate: async ({ list, active }) => {
      if (!saved.user) return;
      const key = ["saved-plugins", saved.user.id];
      await cache.cancelQueries({ queryKey: key });
      const previous = cache.getQueryData<SavedState>(key);
      cache.setQueryData<SavedState>(key, (current = emptyState) => ({
        ...current,
        [list]: active
          ? current[list].filter((id) => id !== pluginId)
          : Array.from(new Set([...current[list], pluginId])),
      }));
      return { key, previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous) cache.setQueryData(context.key, context.previous);
      toast.error(error instanceof Error ? error.message : "Could not update your saved plugins.");
    },
    onSuccess: ({ list, active }) => {
      toast.success(
        active
          ? `Removed from ${list === "wishlist" ? "wishlist" : "favorites"}`
          : `Added to ${list === "wishlist" ? "wishlist" : "favorites"}`,
      );
    },
    onSettled: async () => {
      if (!saved.user) return;
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["saved-plugins", saved.user.id] }),
        cache.invalidateQueries({ queryKey: ["account", saved.user.id] }),
        cache.invalidateQueries({ queryKey: ["plugins"] }),
      ]);
    },
  });

  function toggle(list: SavedList) {
    if (!saved.user) {
      void navigate({
        to: "/auth",
        search: { next: `/dashboard?tab=${list === "wishlist" ? "wishlist" : "favorites"}` },
      });
      return;
    }
    mutation.mutate({ list, active: saved.data[list].includes(pluginId) });
  }

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {(["favorites", "wishlist"] as const).map((list) => {
        const active = saved.data[list].includes(pluginId);
        const label = list === "favorites" ? "Favorites" : "Wishlist";
        const Icon = list === "favorites" ? Heart : ListPlus;
        return (
          <Button
            key={list}
            type="button"
            size={compact ? "sm" : "default"}
            variant={active ? "secondary" : "outline"}
            aria-pressed={active}
            aria-label={`${active ? "Remove from" : "Add to"} ${label}`}
            disabled={saved.loading || mutation.isPending}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              toggle(list);
            }}
          >
            {mutation.isPending && mutation.variables?.list === list ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <Icon className={cn(list === "favorites" && active && "fill-current")} />
            )}
            {compact ? label : `${active ? "Remove from" : "Add to"} ${label}`}
          </Button>
        );
      })}
    </div>
  );
}
