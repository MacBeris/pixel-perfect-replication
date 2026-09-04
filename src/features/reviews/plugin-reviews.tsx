import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { saveReview, reviewEligibility } from "./review.functions";
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
  const q = useQuery({
    queryKey: ["plugin", pluginId, "reviews", user?.id ?? "public", page],
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from("reviews")
        .select("id,rating,title,body,updated_at", { count: "exact" })
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
          Sign in and download through Extendly to leave a rating.
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
      ) : access.data?.allowed ? (
        <ReviewForm
          key={`${user.id}:${pluginId}:${access.data.own?.updated_at ?? "new"}`}
          pluginId={pluginId}
          own={access.data.own}
        />
      ) : (
        <p className="mt-6 rounded-xl border bg-secondary/30 p-5 text-sm text-muted-foreground">
          {access.data?.own && access.data.own.status !== "active"
            ? "Your review is under moderation and cannot be edited here."
            : "Hosted plugins can be rated after downloading through Extendly. External listings require an existing purchase; visiting an external platform does not count as a download. Authors cannot review their own plugins."}
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
          q.data.rows.map((r) => (
            <article key={r.id} className="rounded-xl border p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">Community member</span>
                <span
                  aria-label={`${r.rating} out of 5 stars`}
                  className="ml-auto inline-flex gap-0.5"
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      aria-hidden="true"
                      className={`size-4 ${n <= r.rating ? "fill-warning text-warning" : "text-muted-foreground"}`}
                    />
                  ))}
                </span>
              </div>
              {r.title && <h3 className="mt-3 break-words font-medium">{r.title}</h3>}
              {r.body && (
                <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                  {r.body}
                </p>
              )}
              <p className="mt-3 text-xs text-muted-foreground">
                {new Date(r.updated_at).toLocaleDateString("en-US")}
              </p>
            </article>
          ))
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
function ReviewForm({ pluginId, own }: { pluginId: string; own: OwnReview | null }) {
  const cache = useQueryClient();
  const [rating, setRating] = useState(own?.rating ?? 0);
  const [title, setTitle] = useState(own?.title ?? "");
  const [body, setBody] = useState(own?.body ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className="mt-6 rounded-xl border bg-card p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!rating || busy) return;
        setBusy(true);
        setError("");
        try {
          await saveReview({ data: { accessToken: await token(), pluginId, rating, title, body } });
          toast.success(own ? "Review updated" : "Review published");
          await cache.invalidateQueries();
        } catch (e) {
          setError(message(e));
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3 className="font-semibold">{own ? "Update your review" : "Share your experience"}</h3>
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
        <Button type="submit" disabled={!rating || busy}>
          {busy ? "Saving…" : own ? "Update review" : "Publish review"}
        </Button>
      </fieldset>
    </form>
  );
}
