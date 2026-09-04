import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTheme, type ThemeMode } from "@/lib/theme";
import { type Tab, message } from "./data";
import { Busy, Empty, Failure, Metrics, Panel, fieldClass } from "./ui";

function useAction(userId: string) {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: (action: () => Promise<unknown>) => action(),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ["account", userId] });
      toast.success("Changes saved");
    },
    onError: (e) => toast.error(message(e)),
  });
}
function Pager({
  page,
  setPage,
  more,
}: {
  page: number;
  setPage: (page: number) => void;
  more: boolean;
}) {
  return (
    <div className="mt-5 flex items-center justify-between">
      <Button variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>
        Previous
      </Button>
      <span className="text-sm text-muted-foreground">Page {page + 1}</span>
      <Button variant="outline" disabled={!more} onClick={() => setPage(page + 1)}>
        Next
      </Button>
    </div>
  );
}
const savedSelect = "plugin_id,plugin:plugins(id,name,slug,logo_url,short_description)" as const;
export function AccountOverview({ userId }: { userId: string }) {
  const q = useQuery({
    queryKey: ["account", userId, "overview"],
    queryFn: async () => {
      const results = await Promise.all([
        supabase
          .from("purchases")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("status", "paid"),
        supabase
          .from("favorites")
          .select("plugin_id", { count: "exact", head: true })
          .eq("user_id", userId),
        supabase
          .from("wishlists")
          .select("plugin_id", { count: "exact", head: true })
          .eq("user_id", userId),
        supabase
          .from("collections")
          .select("id", { count: "exact", head: true })
          .eq("owner_id", userId),
        supabase.from("reviews").select("id", { count: "exact", head: true }).eq("user_id", userId),
      ]);
      for (const r of results) if (r.error) throw r.error;
      return results.map((r) => r.count ?? 0);
    },
  });
  if (q.isPending) return <Busy />;
  if (q.error) return <Failure error={q.error} retry={() => void q.refetch()} />;
  return (
    <div className="space-y-6">
      <Metrics
        items={["Paid purchases", "Favorites", "Wishlist", "Collections", "Reviews"].map(
          (label, i) => ({ label, value: q.data[i] ?? 0 }),
        )}
      />
      <Panel
        title="Make this space your own"
        description="Your tools, saved discoveries and creative work, together."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {(["library", "collections", "developer", "settings"] as const).map((tab) => (
            <Link
              key={tab}
              to="/dashboard"
              search={{ tab }}
              className="rounded-xl border border-border p-5 transition-colors hover:bg-secondary"
            >
              <h3 className="font-medium capitalize">{tab}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {
                  {
                    library: "Revisit your paid purchases.",
                    collections: "Organize the tools you discover.",
                    developer: "Build your creator profile.",
                    settings: "Update your account and appearance.",
                  }[tab]
                }
              </p>
            </Link>
          ))}
        </div>
      </Panel>
    </div>
  );
}
export function SavedPlugins({
  userId,
  tab,
}: {
  userId: string;
  tab: "library" | "favorites" | "wishlist";
}) {
  const [page, setPage] = useState(0);
  const action = useAction(userId);
  const q = useQuery({
    queryKey: ["account", userId, tab, page],
    queryFn: async () => {
      const query =
        tab === "library"
          ? supabase
              .from("purchases")
              .select(savedSelect)
              .eq("user_id", userId)
              .eq("status", "paid")
          : supabase
              .from(tab === "wishlist" ? "wishlists" : "favorites")
              .select(savedSelect)
              .eq("user_id", userId);
      const { data, error } = await query
        .order("created_at", { ascending: false })
        .range(page * 20, page * 20 + 19);
      if (error) throw error;
      return data;
    },
  });
  if (q.isPending) return <Busy />;
  if (q.error) return <Failure error={q.error} retry={() => void q.refetch()} />;
  return (
    <Panel
      title={
        { library: "Your library", favorites: "Your favorites", wishlist: "Your wishlist" }[tab]
      }
      description={
        tab === "library"
          ? "Plugins from your paid purchases. Free library additions are not available yet."
          : "Keep the extensions you want to revisit close at hand."
      }
    >
      <div className="space-y-3">
        {q.data.map((row, i) => (
          <div
            key={`${row.plugin_id}-${i}`}
            className="flex items-center gap-4 rounded-xl border border-border p-4"
          >
            {row.plugin?.logo_url && (
              <img alt="" src={row.plugin.logo_url} className="size-12 rounded-lg object-cover" />
            )}
            <div className="min-w-0 flex-1">
              {row.plugin ? (
                <Link
                  to="/plugins/$slug"
                  params={{ slug: row.plugin.slug }}
                  className="font-medium hover:underline"
                >
                  {row.plugin.name}
                </Link>
              ) : (
                <p>Plugin unavailable</p>
              )}
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                {row.plugin?.short_description}
              </p>
            </div>
            {tab !== "library" && (
              <Button
                variant="outline"
                size="sm"
                disabled={action.isPending}
                onClick={() =>
                  action.mutate(async () => {
                    const { error } = await supabase
                      .from(tab === "wishlist" ? "wishlists" : "favorites")
                      .delete()
                      .eq("user_id", userId)
                      .eq("plugin_id", row.plugin_id);
                    if (error) throw error;
                  })
                }
              >
                Remove
              </Button>
            )}
          </div>
        ))}
      </div>
      {!q.data.length && (
        <Empty>
          {tab === "library"
            ? "You haven't purchased any plugins yet."
            : "No saved plugins yet. Explore the catalog to get started."}
        </Empty>
      )}
      <Pager page={page} setPage={setPage} more={q.data.length === 20} />
    </Panel>
  );
}
export function Collections({ userId }: { userId: string }) {
  const [selected, setSelected] = useState<string>();
  const [page, setPage] = useState(0);
  const action = useAction(userId);
  const q = useQuery({
    queryKey: ["account", userId, "collections", page],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collections")
        .select("*")
        .eq("owner_id", userId)
        .order("created_at", { ascending: false })
        .range(page * 20, page * 20 + 19);
      if (error) throw error;
      return data;
    },
  });
  const current = q.data?.find((c) => c.id === selected);
  if (q.isPending) return <Busy />;
  if (q.error) return <Failure error={q.error} retry={() => void q.refetch()} />;
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const values = {
      name: String(form.get("name")).trim(),
      slug: String(form.get("slug")).trim(),
      description: String(form.get("description")).trim(),
      is_public: form.get("is_public") === "on",
    };
    action.mutate(async () => {
      const response = current
        ? await supabase
            .from("collections")
            .update(values)
            .eq("id", current.id)
            .eq("owner_id", userId)
            .select("id")
            .single()
        : await supabase
            .from("collections")
            .insert({ ...values, owner_id: userId })
            .select("id")
            .single();
      if (response.error) throw response.error;
      setSelected(undefined);
    });
  }
  return (
    <div className="space-y-6">
      <Panel title="Collections" description="Group useful plugins around a workflow or project.">
        <div className="space-y-3">
          {q.data.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border p-4"
            >
              <button className="text-left" onClick={() => setSelected(c.id)}>
                <span className="font-medium">{c.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {c.is_public ? "Public" : "Private"}
                </span>
                <p className="text-sm text-muted-foreground">{c.description}</p>
              </button>
              <Button
                variant="ghost"
                disabled={action.isPending}
                onClick={() => {
                  if (window.confirm(`Delete collection "${c.name}"?`))
                    action.mutate(async () => {
                      const { error } = await supabase
                        .from("collections")
                        .delete()
                        .eq("id", c.id)
                        .eq("owner_id", userId);
                      if (error) throw error;
                      setSelected(undefined);
                    });
                }}
              >
                Delete
              </Button>
            </div>
          ))}
        </div>
        {!q.data.length && <Empty>No collections yet. Create your first one below.</Empty>}
        <Pager
          page={page}
          setPage={(p) => {
            setSelected(undefined);
            setPage(p);
          }}
          more={q.data.length === 20}
        />
      </Panel>
      <Panel title={current ? "Edit collection" : "Create a collection"}>
        <form key={current?.id ?? "new"} onSubmit={save} className="space-y-4">
          <label className="block text-sm">
            Name
            <Input name="name" required maxLength={100} defaultValue={current?.name} />
          </label>
          <label className="block text-sm">
            Slug
            <Input
              name="slug"
              required
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              maxLength={80}
              defaultValue={current?.slug}
            />
          </label>
          <label className="block text-sm">
            Description
            <textarea
              aria-label="Description"
              name="description"
              className={fieldClass}
              maxLength={3000}
              defaultValue={current?.description ?? ""}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="is_public" defaultChecked={current?.is_public ?? false} />
            Public collection
          </label>
          <div className="flex gap-2">
            <Button disabled={action.isPending}>Save collection</Button>
            {current && (
              <Button type="button" variant="outline" onClick={() => setSelected(undefined)}>
                New collection
              </Button>
            )}
          </div>
        </form>
      </Panel>
      {current && <CollectionContents userId={userId} collectionId={current.id} />}
    </div>
  );
}
function CollectionContents({ userId, collectionId }: { userId: string; collectionId: string }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const action = useAction(userId);
  const q = useQuery({
    queryKey: ["account", userId, "collection-items", collectionId, page],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collection_plugins")
        .select("plugin_id,collection:collections!inner(owner_id),plugin:plugins(id,name,slug)")
        .eq("collection_id", collectionId)
        .eq("collection.owner_id", userId)
        .order("created_at", { ascending: false })
        .range(page * 20, page * 20 + 19);
      if (error) throw error;
      return data;
    },
  });
  const candidates = useQuery({
    queryKey: ["account", userId, "collection-search", search],
    enabled: search.length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plugins")
        .select("id,name")
        .eq("moderation_status", "approved")
        .ilike("name", `%${search.replace(/[%_]/g, "")}%`)
        .limit(10);
      if (error) throw error;
      return data;
    },
  });
  return (
    <Panel title="Collection plugins">
      {q.isPending ? (
        <Busy />
      ) : q.error ? (
        <Failure error={q.error} retry={() => void q.refetch()} />
      ) : (
        <>
          <div className="space-y-2">
            {q.data.map((row) => (
              <div
                key={row.plugin_id}
                className="flex items-center justify-between gap-3 rounded-lg border p-3"
              >
                <span>{row.plugin?.name ?? "Plugin unavailable"}</span>
                <Button
                  variant="ghost"
                  disabled={action.isPending}
                  onClick={() =>
                    action.mutate(async () => {
                      const { error } = await supabase
                        .from("collection_plugins")
                        .delete()
                        .eq("collection_id", collectionId)
                        .eq("plugin_id", row.plugin_id);
                      if (error) throw error;
                    })
                  }
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
          {!q.data.length && <Empty>This collection is empty.</Empty>}
          <Pager page={page} setPage={setPage} more={q.data.length === 20} />
        </>
      )}
      <form
        className="mt-5 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(String(new FormData(e.currentTarget).get("search")).trim());
        }}
      >
        <Input
          name="search"
          aria-label="Find plugins to add"
          placeholder="Find a plugin…"
          minLength={2}
          required
        />
        <Button variant="outline">Search</Button>
      </form>
      {candidates.error && (
        <Failure error={candidates.error} retry={() => void candidates.refetch()} />
      )}
      <div className="mt-3 space-y-2">
        {candidates.data?.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-3 p-2">
            <span>{p.name}</span>
            <Button
              variant="outline"
              disabled={action.isPending || q.data?.some((r) => r.plugin_id === p.id)}
              onClick={() =>
                action.mutate(async () => {
                  const { error } = await supabase
                    .from("collection_plugins")
                    .upsert(
                      { collection_id: collectionId, plugin_id: p.id },
                      { onConflict: "collection_id,plugin_id", ignoreDuplicates: true },
                    );
                  if (error) throw error;
                })
              }
            >
              Add
            </Button>
          </div>
        ))}
      </div>
      {candidates.data?.length === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">No matching plugins.</p>
      )}
    </Panel>
  );
}
export function Reviews({ userId }: { userId: string }) {
  const [page, setPage] = useState(0);
  const action = useAction(userId);
  const q = useQuery({
    queryKey: ["account", userId, "reviews", page],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("id,title,body,rating,status,created_at,plugin:plugins(name,slug)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .range(page * 20, page * 20 + 19);
      if (error) throw error;
      return data;
    },
  });
  if (q.isPending) return <Busy />;
  if (q.error) return <Failure error={q.error} retry={() => void q.refetch()} />;
  return (
    <Panel
      title="Your reviews"
      description="Update the feedback you have shared with the community."
    >
      <div className="space-y-5">
        {q.data.map((r) => (
          <form
            key={r.id}
            className="space-y-3 rounded-xl border p-4"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              action.mutate(async () => {
                const { error } = await supabase
                  .from("reviews")
                  .update({
                    title: String(f.get("title")),
                    body: String(f.get("body")),
                    rating: Number(f.get("rating")),
                  })
                  .eq("id", r.id)
                  .eq("user_id", userId)
                  .select("id")
                  .single();
                if (error) throw error;
              });
            }}
          >
            <p className="font-medium">
              {r.plugin?.name ?? "Plugin unavailable"}{" "}
              <span className="text-xs text-muted-foreground">· {r.status}</span>
            </p>
            <label className="block text-sm">
              Rating
              <select
                aria-label="Rating"
                className={fieldClass}
                name="rating"
                defaultValue={r.rating}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n} / 5
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Title
              <Input name="title" maxLength={200} defaultValue={r.title ?? ""} />
            </label>
            <label className="block text-sm">
              Review
              <textarea
                className={fieldClass}
                name="body"
                rows={3}
                maxLength={5000}
                defaultValue={r.body ?? ""}
              />
            </label>
            <Button disabled={action.isPending}>Save review</Button>
          </form>
        ))}
      </div>
      {!q.data.length && <Empty>You haven't written any reviews yet.</Empty>}
      <Pager page={page} setPage={setPage} more={q.data.length === 20} />
    </Panel>
  );
}
export function Settings({ userId }: { userId: string }) {
  const action = useAction(userId);
  const { theme, setTheme } = useTheme();
  const q = useQuery({
    queryKey: ["account", userId, "settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("username,display_name,bio,avatar_url")
        .eq("id", userId)
        .single();
      if (error) throw error;
      return data;
    },
  });
  if (q.isPending) return <Busy />;
  if (q.error) return <Failure error={q.error} retry={() => void q.refetch()} />;
  return (
    <div className="space-y-6">
      <Panel title="Account profile">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            action.mutate(async () => {
              const avatar = String(f.get("avatar_url")).trim();
              if (avatar && (!URL.canParse(avatar) || new URL(avatar).protocol !== "https:"))
                throw new Error("Use an HTTPS avatar URL.");
              const { error } = await supabase
                .from("profiles")
                .update({
                  username: String(f.get("username")).trim() || null,
                  display_name: String(f.get("display_name")).trim(),
                  bio: String(f.get("bio")).trim(),
                  avatar_url: avatar || null,
                })
                .eq("id", userId)
                .select("id")
                .single();
              if (error) throw error;
            });
          }}
        >
          {(["display_name", "username", "avatar_url"] as const).map((name, i) => (
            <label key={name} className="block text-sm">
              {["Display name", "Username", "Avatar URL"][i]}
              <Input
                name={name}
                defaultValue={q.data[name] ?? ""}
                maxLength={name === "avatar_url" ? 2048 : 100}
              />
            </label>
          ))}
          <label className="block text-sm">
            Bio
            <textarea
              name="bio"
              className={fieldClass}
              rows={4}
              maxLength={3000}
              defaultValue={q.data.bio ?? ""}
            />
          </label>
          <Button disabled={action.isPending}>Save settings</Button>
        </form>
      </Panel>
      <Panel title="Appearance">
        <label className="block text-sm">
          Theme
          <select
            className={fieldClass}
            value={theme}
            aria-label="Theme"
            onChange={(e) => setTheme(e.target.value as ThemeMode)}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
      </Panel>
    </div>
  );
}
export function AccountSection({
  userId,
  tab,
}: {
  userId: string;
  tab: Exclude<Tab, "developer">;
}) {
  if (tab === "overview") return <AccountOverview userId={userId} />;
  if (tab === "collections") return <Collections userId={userId} />;
  if (tab === "reviews") return <Reviews userId={userId} />;
  if (tab === "settings") return <Settings userId={userId} />;
  return <SavedPlugins key={tab} userId={userId} tab={tab} />;
}
