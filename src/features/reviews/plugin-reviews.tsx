import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { deleteReview, saveReview, reviewEligibility } from "./review.functions";
import { message } from "@/features/dashboard/data";

async function token() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Please sign in.");
  return data.session.access_token;
}
type OwnReview = {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  updated_at: string;
};

type ReviewRow = OwnReview & {
  user_id: string;
  author: { username: string; avatar_url: string | null } | null;
};

function initial(value: string | null | undefined) {
  return value?.trim().charAt(0).toUpperCase() || "U";
}
export function PluginReviews({
  pluginId,
  rating,
  count,
}: {
  pluginId: string;
  rating: number;
  count: number;
}) {
  const { user } = useAuth();
  const [page, setPage] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const cache = useQueryClient();
  const q = useQuery({
    queryKey: ["plugin", pluginId, "reviews", user?.id ?? "public", page],
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from("reviews")
        .select("id,user_id,rating,title,body,updated_at,author:profiles(username,avatar_url)", {
          count: "exact",
        })
        .eq("plugin_id", pluginId)
        .eq("status", "active")
        .order("updated_at", { ascending: false })
        .order("id")
        .range(page * 20, page * 20 + 19);
      if (error) throw error;
      return { rows: data, count: count ?? 0 };
    },
  });
  const access = useQuery({
    queryKey: ["account", user?.id, "review-access", pluginId],
    enabled: Boolean(user),
    queryFn: async () => reviewEligibility({ data: { accessToken: await token(), pluginId } }),
  });
  return (
    <section id="reviews" className="mt-14 scroll-mt-24 border-t pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Ratings & reviews</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {count
              ? `${rating.toFixed(1)} average from ${count} ${count === 1 ? "review" : "reviews"}`
              : "No reviews yet"}
          </p>
        </div>
        <span className="inline-flex items-center gap-1 text-lg font-semibold">
          <Star className="size-5 fill-warning text-warning" />
          {count ? rating.toFixed(1) : "—"}
        </span>
      </div>
      {!user ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Sign in and download through ExtendShare to leave a rating.
        </p>
      ) : access.isPending ? (
        <p className="mt-6 text-sm text-muted-foreground">Checking review eligibility…</p>
      ) : access.error ? (
        <div role="alert" className="mt-6 text-sm text-destructive">
          Could not check review eligibility.{" "}
          <Button variant="outline" onClick={() => void access.refetch()}>
            Retry
          </Button>
        </div>
      ) : access.data?.allowed && !access.data.own ? (
        <ReviewForm key={`${user.id}:${pluginId}:new`} pluginId={pluginId} own={access.data.own} />
      ) : access.data?.own?.status === "active" ? null : (
        <p className="mt-6 rounded-xl border bg-secondary/30 p-5 text-sm text-muted-foreground">
          {access.data?.own
            ? "Your review is under moderation and cannot be edited here."
            : "Hosted plugins can be rated after downloading through ExtendShare. External listings require an existing purchase; visiting an external platform does not count as a download. Authors cannot review their own plugins."}
        </p>
      )}
      <div className="mt-7 space-y-4">
        {q.isPending ? (
          <p className="text-sm text-muted-foreground">Loading reviews…</p>
        ) : q.error ? (
          <div role="alert">
            Reviews could not be loaded.{" "}
            <Button variant="outline" onClick={() => void q.refetch()}>
              Retry
            </Button>
          </div>
        ) : q.data?.rows.length ? (
          (q.data.rows as ReviewRow[]).map((r) => {
            const isOwn = r.user_id === user?.id;
            const username = r.author?.username ?? "user";
            return (
              <article key={r.id} className="group rounded-xl border p-5">
                <div className="flex items-start gap-3">
                  <Avatar className="size-10 border" aria-hidden="true">
                    <AvatarImage src={r.author?.avatar_url ?? undefined} alt="" />
                    <AvatarFallback className="text-sm font-medium">
                      {initial(username)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="break-all font-medium">@{username}</span>
                      <span
                        aria-label={`${r.rating} out of 5 stars`}
                        className="inline-flex gap-0.5"
                      >
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star
                            key={n}
                            aria-hidden="true"
                            className={`size-4 ${n <= r.rating ? "fill-warning text-warning" : "text-muted-foreground"}`}
                          />
                        ))}
                      </span>
                      <time dateTime={r.updated_at} className="text-xs text-muted-foreground">
                        {new Date(r.updated_at).toLocaleDateString("en-US")}
                      </time>
                      {isOwn && (
                        <TooltipProvider delayDuration={250}>
                          <div className="ml-auto flex items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="size-11 sm:size-8"
                                  aria-label="Edit review"
                                  onClick={() => setEditingId(r.id)}
                                >
                                  <Pencil aria-hidden="true" className="size-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Edit review</TooltipContent>
                            </Tooltip>
                            <AlertDialog>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="ghost"
                                      className="size-11 text-destructive hover:text-destructive sm:size-8"
                                      aria-label="Delete review"
                                    >
                                      <Trash2 aria-hidden="true" className="size-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                </TooltipTrigger>
                                <TooltipContent>Delete review</TooltipContent>
                              </Tooltip>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete review?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to permanently delete this review?
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel disabled={deletingId === r.id}>
                                    Cancel
                                  </AlertDialogCancel>
                                  <AlertDialogAction
                                    disabled={deletingId === r.id}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    onClick={async () => {
                                      setDeletingId(r.id);
                                      try {
                                        await deleteReview({
                                          data: { accessToken: await token(), pluginId },
                                        });
                                        toast.success("Review deleted");
                                        await Promise.all([
                                          cache.invalidateQueries({
                                            queryKey: ["plugin", pluginId, "reviews"],
                                          }),
                                          cache.invalidateQueries({ queryKey: ["account"] }),
                                        ]);
                                      } catch (error) {
                                        toast.error(message(error));
                                      } finally {
                                        setDeletingId(null);
                                      }
                                    }}
                                  >
                                    {deletingId === r.id ? "Deleting…" : "Delete review"}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TooltipProvider>
                      )}
                    </div>
                    {editingId === r.id ? (
                      <ReviewForm
                        pluginId={pluginId}
                        own={r}
                        inline
                        onCancel={() => setEditingId(null)}
                        onSaved={() => setEditingId(null)}
                      />
                    ) : (
                      <>
                        {r.title && <h3 className="mt-3 break-words font-medium">{r.title}</h3>}
                        {r.body && (
                          <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                            {r.body}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </article>
            );
          })
        ) : (
          <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            No published reviews yet.
          </p>
        )}
      </div>
      {(q.data?.count ?? 0) > 20 && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <Button variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>
            Previous reviews
          </Button>
          <span className="text-sm">Page {page + 1}</span>
          <Button
            variant="outline"
            disabled={(page + 1) * 20 >= (q.data?.count ?? 0)}
            onClick={() => setPage(page + 1)}
          >
            Next reviews
          </Button>
        </div>
      )}
    </section>
  );
}
function ReviewForm({
  pluginId,
  own,
  inline = false,
  onCancel,
  onSaved,
}: {
  pluginId: string;
  own: OwnReview | null;
  inline?: boolean;
  onCancel?: () => void;
  onSaved?: () => void;
}) {
  const cache = useQueryClient();
  const [rating, setRating] = useState(own?.rating ?? 0);
  const [title, setTitle] = useState(own?.title ?? "");
  const [body, setBody] = useState(own?.body ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className={inline ? "mt-4 border-t pt-4" : "mt-6 rounded-xl border bg-card p-5"}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!rating || busy) return;
        setBusy(true);
        setError("");
        try {
          await saveReview({ data: { accessToken: await token(), pluginId, rating, title, body } });
          toast.success(own ? "Review updated" : "Review published");
          await Promise.all([
            cache.invalidateQueries({ queryKey: ["plugin", pluginId, "reviews"] }),
            cache.invalidateQueries({ queryKey: ["account"] }),
          ]);
          onSaved?.();
        } catch (e) {
          const text = message(e);
          setError(text);
          toast.error(text);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3 className="font-semibold">{own ? "Edit your review" : "Share your experience"}</h3>
      <fieldset disabled={busy} className="mt-4 space-y-3">
        <legend className="sr-only">Your rating and optional review</legend>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`${n} stars`}
              aria-pressed={rating === n}
              onClick={() => setRating(n)}
              className="rounded p-2 focus-visible:outline focus-visible:outline-primary"
            >
              <Star
                className={`size-6 ${n <= rating ? "fill-warning text-warning" : "text-muted-foreground"}`}
              />
            </button>
          ))}
        </div>
        <label className="grid gap-1 text-sm">
          Title (optional)
          <input
            className="w-full rounded-md border bg-background p-2"
            maxLength={160}
            aria-label="Title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Review (optional)
          <textarea
            className="w-full rounded-md border bg-background p-2"
            rows={3}
            maxLength={5000}
            aria-label="Review (optional)"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={!rating || busy}>
            {busy ? "Saving…" : own ? "Save changes" : "Publish review"}
          </Button>
          {own && onCancel && (
            <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </fieldset>
    </form>
  );
}
