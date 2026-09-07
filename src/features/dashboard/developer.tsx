import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  Code2,
  Download,
  Eye,
  EyeOff,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Star,
  Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  developerFields,
  loadAnalytics,
  type Analytics,
  type DashboardSearch,
  type DeveloperProfile,
} from "./data";
import { DeveloperProfileForm } from "./developer-profile";
import { readDeveloperDraft, saveDeveloperDraft } from "./developer-draft";
import { PluginEditor } from "@/features/publishing/plugin-editor";
import { publishing } from "@/features/publishing/client";
import { message } from "./data";
import { Busy, Empty, Failure, Metrics, Panel, fieldClass } from "./ui";

export function DeveloperSection({ userId, search }: { userId: string; search: DashboardSearch }) {
  const [onboarding, setOnboarding] = useState(
    () => Object.keys(readDeveloperDraft(userId)).length > 0,
  );
  const cache = useQueryClient();
  const navigate = useNavigate();
  const q = useQuery({
    queryKey: ["account", userId, "developer-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("developer_profiles")
        .select(developerFields)
        .eq("owner_id", userId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });
  const change = (next: Partial<DashboardSearch>) =>
    void navigate({ to: "/dashboard", search: { ...search, ...next, tab: "developer" } });
  async function saved(id: string) {
    await cache.invalidateQueries({ queryKey: ["account", userId] });
    setOnboarding(false);
    change({ profile: id, view: undefined, plugin: undefined, page: 1 });
  }
  if (q.isPending) return <Busy />;
  if (q.error) return <Failure error={q.error} retry={() => void q.refetch()} />;
  const profile = search.profile ? q.data.find((p) => p.id === search.profile) : q.data[0];
  if (search.profile && !profile)
    return (
      <Panel title="Developer profile unavailable">
        <p className="text-sm text-muted-foreground">
          This profile is not available for your account.
        </p>
        <Button
          className="mt-4"
          onClick={() => change({ profile: undefined, plugin: undefined, view: undefined })}
        >
          Back to your profiles
        </Button>
      </Panel>
    );
  if (!profile) {
    if (onboarding)
      return (
        <DeveloperProfileForm
          userId={userId}
          onSaved={saved}
          onCancel={() => setOnboarding(false)}
        />
      );
    return (
      <Panel title="Become a Developer" description="Give your creative work a home on Extendly.">
        <div className="grid gap-6 md:grid-cols-[1fr_auto]">
          <div>
            <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
              Create a public developer profile today. Your account stays the same, with a new space
              for your plugins and their performance.
            </p>
            <ul className="mt-5 space-y-2 text-sm">
              <li>Create plugins and submit them for review</li>
              <li>Upload your first release or link to an external platform</li>
              <li>See statistics for plugins linked to your profile</li>
              <li>Sell extensions when marketplace payments launch</li>
              <li>Build your public developer identity</li>
            </ul>
            <Button
              className="mt-6"
              onClick={() => {
                saveDeveloperDraft(userId, { ...readDeveloperDraft(userId), started: "true" });
                setOnboarding(true);
              }}
            >
              <Code2 className="mr-2 size-4" />
              Become a Developer
            </Button>
          </div>
          <div className="hidden size-36 items-center justify-center rounded-2xl bg-primary/10 md:flex">
            <Code2 className="size-14 text-primary" />
          </div>
        </div>
      </Panel>
    );
  }
  return (
    <div className="space-y-6">
      {q.data.length > 1 && (
        <label className="block text-sm">
          Developer profile
          <select
            className={fieldClass}
            value={profile.id}
            onChange={(e) =>
              change({ profile: e.target.value, plugin: undefined, view: undefined, page: 1 })
            }
          >
            {q.data.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {search.view === "create" || search.view === "edit" ? (
        <PluginEditor
          userId={userId}
          profileId={profile.id}
          pluginId={search.view === "edit" ? search.plugin : undefined}
          onClose={() => change({ view: undefined, plugin: undefined, page: 1 })}
        />
      ) : search.view === "profile" ? (
        <DeveloperProfileForm
          key={profile.id}
          userId={userId}
          profile={profile}
          onSaved={saved}
          onCancel={() => change({ view: undefined })}
        />
      ) : (
        <DeveloperAnalytics
          key={profile.id}
          userId={userId}
          profile={profile}
          search={search}
          change={change}
        />
      )}
    </div>
  );
}
function DeveloperAnalytics({
  userId,
  profile,
  search,
  change,
}: {
  userId: string;
  profile: DeveloperProfile;
  search: DashboardSearch;
  change: (next: Partial<DashboardSearch>) => void;
}) {
  const cache = useQueryClient();
  const [lifecycleBusy, setLifecycleBusy] = useState<string>();
  const [lifecycleError, setLifecycleError] = useState("");
  const q = useQuery({
    queryKey: [
      "account",
      userId,
      "developer-analytics",
      profile.id,
      search.plugin,
      search.range,
      search.page,
    ],
    queryFn: () => loadAnalytics(profile.id, search),
  });
  if (q.isPending) return <Busy />;
  if (q.error) return <Failure error={q.error} retry={() => void q.refetch()} />;
  const d = q.data;
  const plugin = search.plugin ? d.plugins[0] : undefined;
  const incomplete = !profile.description || !profile.avatar_url;
  async function lifecycle(action: "unpublish" | "republish" | "delete" | "restore", id: string) {
    setLifecycleBusy(id);
    setLifecycleError("");
    try {
      await publishing(action, { id });
      await cache.invalidateQueries({ queryKey: ["account", userId] });
    } catch (error) {
      setLifecycleError(message(error));
    } finally {
      setLifecycleBusy(undefined);
    }
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          {plugin && (d.detail?.cover_url || plugin.logo_url) && (
            <img
              src={d.detail?.cover_url || plugin.logo_url || ""}
              alt=""
              className="hidden size-20 rounded-2xl object-cover shadow-sm sm:block"
            />
          )}
          <div>
            {search.plugin && (
              <Button
                variant="ghost"
                size="sm"
                className="mb-2"
                onClick={() => change({ plugin: undefined, view: undefined, page: 1 })}
              >
                <ArrowLeft className="mr-2 size-4" />
                All plugins
              </Button>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-semibold tracking-tight">
                {plugin?.name ?? profile.name}
              </h2>
              {plugin && <PluginStatus plugin={plugin} />}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {search.plugin
                ? `${plugin?.platform ?? "Platform unavailable"} · ${plugin?.current_version ? `v${plugin.current_version}` : "No current version"}`
                : "Your creative work, at a glance"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {plugin ? (
            <>
              {!plugin.developer_removed_at && (
                <Button variant="outline" asChild>
                  <Link to="/plugins/$slug" params={{ slug: plugin.slug }}>
                    View public page
                    <ArrowUpRight className="ml-2 size-4" />
                  </Link>
                </Button>
              )}
              <Button
                variant="outline"
                disabled={
                  Boolean(plugin.developer_removed_at) ||
                  plugin.moderation_status === "pending_review" ||
                  plugin.moderation_status === "suspended"
                }
                onClick={() => change({ view: "edit", plugin: plugin.id })}
              >
                <Pencil className="mr-2 size-4" />
                Edit
              </Button>
              {plugin.moderation_status === "approved" && !plugin.developer_removed_at && (
                <Button
                  variant="outline"
                  disabled={lifecycleBusy === plugin.id}
                  onClick={() =>
                    void lifecycle(
                      plugin.developer_unpublished_at ? "republish" : "unpublish",
                      plugin.id,
                    )
                  }
                >
                  {plugin.developer_unpublished_at ? (
                    <RotateCcw className="mr-2 size-4" />
                  ) : (
                    <EyeOff className="mr-2 size-4" />
                  )}
                  {plugin.developer_unpublished_at ? "Republish" : "Unpublish"}
                </Button>
              )}
              {!plugin.developer_removed_at && plugin.moderation_status !== "suspended" && (
                <DeletePluginAction
                  plugin={plugin}
                  busy={lifecycleBusy === plugin.id}
                  onDelete={() => void lifecycle("delete", plugin.id)}
                />
              )}
              {plugin.developer_removed_at && (
                <Button
                  variant="outline"
                  disabled={lifecycleBusy === plugin.id || plugin.moderation_status === "suspended"}
                  onClick={() => void lifecycle("restore", plugin.id)}
                >
                  <RotateCcw className="mr-2 size-4" />
                  Restore
                </Button>
              )}
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => change({ view: "profile", plugin: undefined, page: 1 })}
              >
                Edit profile
              </Button>
              <Button variant="outline" asChild>
                <Link to="/developers/$slug" params={{ slug: profile.slug }}>
                  View profile
                  <ArrowUpRight className="ml-2 size-4" />
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>
      {lifecycleError && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/40 p-4 text-sm text-destructive"
        >
          {lifecycleError}
        </p>
      )}
      {d.totals.plugins === 0 && !search.plugin ? (
        <Panel
          title="Your developer profile is ready"
          description="Your profile is active. Create your first plugin and submit it for review."
        >
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => change({ view: "create", plugin: undefined })}>
              <Plus className="mr-2 size-4" />
              Create your first plugin
            </Button>
            <Button variant="outline" onClick={() => change({ view: "profile" })}>
              Complete developer profile
            </Button>
            <Button variant="ghost" asChild>
              <Link to="/publishing-requirements">Read publishing requirements</Link>
            </Button>
          </div>
        </Panel>
      ) : (
        <>
          <Metrics
            items={
              search.plugin
                ? [
                    { label: "Total downloads", value: d.totals.downloads },
                    { label: "Total views", value: d.totals.views },
                    { label: "Rating average", value: d.totals.rating ?? "Not rated" },
                    { label: "Reviews", value: d.totals.reviews },
                    {
                      label: "Downloads · 30 days",
                      value: d.history.available ? d.history.downloads_last_30_days : "Unavailable",
                    },
                  ]
                : [
                    { label: "Total plugins", value: d.totals.plugins },
                    { label: "Published plugins", value: d.totals.published },
                    { label: "Drafts", value: d.totals.drafts },
                    { label: "Pending review", value: d.totals.pending },
                    { label: "Total downloads", value: d.totals.downloads },
                    { label: "Total views", value: d.totals.views },
                    { label: "Rating average", value: d.totals.rating ?? "Not rated" },
                    { label: "Reviews", value: d.totals.reviews },
                    { label: "Favorites", value: d.totals.favorites },
                    { label: "Wishlist adds", value: d.totals.wishlist },
                    {
                      label: "Recorded downloads · 30 days",
                      value: d.history.available ? d.history.downloads_last_30_days : "Unavailable",
                    },
                  ]
            }
          />
          <p className="text-xs text-muted-foreground">
            Totals use the existing plugin counters. Recorded events have separate historical
            coverage; they may not match lifetime totals.
          </p>
          {search.plugin && search.view === "versions" && <Versions data={d} />}
          <Performance data={d} range={search.range} onRange={(range) => change({ range })} />
          {search.plugin ? (
            <>
              <Panel
                title="Distribution"
                description={
                  plugin?.listing_type === "external_listing"
                    ? "This plugin directs visitors to an external platform."
                    : "Download totals reflect the existing counters."
                }
              >
                <Metrics
                  items={
                    plugin?.listing_type === "external_listing"
                      ? [
                          {
                            label: "Recorded outbound clicks",
                            value: d.history.available ? d.history.outbound_clicks : "Unavailable",
                          },
                        ]
                      : [{ label: "Total downloads", value: d.totals.downloads }]
                  }
                />
                <div className="mt-5 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
                  <p>Unique views: unavailable</p>
                  <p>Library users and growth: unavailable</p>
                  <p>Users / licenses: unavailable</p>
                </div>
              </Panel>
              {search.view !== "versions" && <Versions data={d} />}
              <DetailReviews data={d} />
              <PluginActivity data={d} />
            </>
          ) : (
            <Panel
              title="Your plugins"
              description="Manage publishing, visibility, edits and the lifecycle of your plugins."
            >
              <div className="mb-4">
                <Button onClick={() => change({ view: "create", plugin: undefined })}>
                  <Plus className="mr-2 size-4" />
                  Create plugin
                </Button>
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                {d.plugins.map((p) => (
                  <article
                    key={p.id}
                    className="group overflow-hidden rounded-2xl border bg-card shadow-sm transition hover:border-primary/30 hover:shadow-md"
                  >
                    <button
                      type="button"
                      className="w-full p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
                      onClick={() => change({ plugin: p.id, view: "analytics", page: 1 })}
                    >
                      <div className="flex items-start gap-4">
                        {p.logo_url ? (
                          <img
                            className="size-14 rounded-xl object-cover shadow-sm"
                            src={p.logo_url}
                            alt=""
                          />
                        ) : (
                          <div className="flex size-14 items-center justify-center rounded-xl bg-secondary">
                            <Code2 className="size-7 text-muted-foreground" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-base font-semibold">{p.name}</h3>
                            <PluginStatus plugin={p} />
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {p.platform ?? "Platform unavailable"}
                          </p>
                        </div>
                      </div>
                      <div className="mt-5 grid grid-cols-3 gap-3 border-y py-4 text-sm">
                        <Meta
                          label="Distribution"
                          value={p.listing_type === "external_listing" ? "External" : "Hosted"}
                        />
                        <Meta label="Version" value={p.current_version ?? "Not set"} />
                        <Meta
                          label="Updated"
                          value={new Date(p.updated_at).toLocaleDateString("en-US")}
                        />
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <CardMetric icon={Download} label="Downloads" value={p.downloads_count} />
                        <CardMetric icon={Eye} label="Views" value={p.views_count} />
                        <CardMetric
                          icon={Star}
                          label="Rating"
                          value={p.reviews_count ? p.rating_average : "—"}
                        />
                        <CardMetric icon={Code2} label="Reviews" value={p.reviews_count} />
                      </div>
                      {p.rejection_reason && (
                        <p className="mt-4 rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
                          {p.rejection_reason}
                        </p>
                      )}
                    </button>
                    <div
                      className="flex flex-wrap items-center gap-1 border-t bg-muted/20 px-3 py-2"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {!p.developer_removed_at && (
                        <Button size="sm" variant="ghost" asChild>
                          <Link to="/plugins/$slug" params={{ slug: p.slug }}>
                            <Eye className="mr-1 size-3.5" />
                            View
                          </Link>
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={
                          Boolean(p.developer_removed_at) ||
                          p.moderation_status === "pending_review" ||
                          p.moderation_status === "suspended"
                        }
                        onClick={() => change({ plugin: p.id, view: "edit", page: 1 })}
                      >
                        <Pencil className="mr-1 size-3.5" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => change({ plugin: p.id, view: "analytics", page: 1 })}
                      >
                        <BarChart3 className="mr-1 size-3.5" />
                        Analytics
                      </Button>
                      <div className="ml-auto">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label={`More actions for ${p.name}`}
                            >
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onSelect={() => change({ plugin: p.id, view: "versions", page: 1 })}
                            >
                              Versions
                            </DropdownMenuItem>
                            {p.moderation_status === "approved" && !p.developer_removed_at && (
                              <DropdownMenuItem
                                disabled={lifecycleBusy === p.id}
                                onSelect={() =>
                                  void lifecycle(
                                    p.developer_unpublished_at ? "republish" : "unpublish",
                                    p.id,
                                  )
                                }
                              >
                                {p.developer_unpublished_at ? "Republish" : "Unpublish"}
                              </DropdownMenuItem>
                            )}
                            {p.developer_removed_at && (
                              <DropdownMenuItem
                                disabled={
                                  lifecycleBusy === p.id || p.moderation_status === "suspended"
                                }
                                onSelect={() => void lifecycle("restore", p.id)}
                              >
                                Restore
                              </DropdownMenuItem>
                            )}
                            {!p.developer_removed_at && p.moderation_status !== "suspended" && (
                              <>
                                <DropdownMenuSeparator />
                                <DeletePluginAction
                                  plugin={p}
                                  busy={lifecycleBusy === p.id}
                                  onDelete={() => void lifecycle("delete", p.id)}
                                  menu
                                />
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between">
                <Button
                  variant="outline"
                  disabled={search.page === 1}
                  onClick={() => change({ page: search.page - 1 })}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {search.page} of {Math.max(1, Math.ceil(d.totals.plugins / 20))}
                </span>
                <Button
                  variant="outline"
                  disabled={search.page * 20 >= d.totals.plugins}
                  onClick={() => change({ page: search.page + 1 })}
                >
                  Next
                </Button>
              </div>
            </Panel>
          )}
        </>
      )}
      {!search.plugin && (incomplete || d.recent_reviews.length > 0) && (
        <Panel title="Needs attention">
          <div className="space-y-3">
            {incomplete && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-secondary/50 p-4">
                <div>
                  <p className="font-medium">Complete your profile</p>
                  <p className="text-sm text-muted-foreground">
                    Add an avatar and a description so visitors can learn about your work.
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => change({ view: "profile", plugin: undefined, page: 1 })}
                >
                  Complete profile
                </Button>
              </div>
            )}
            {d.recent_reviews.length > 0 && (
              <a
                href="#developer-reviews"
                className="block rounded-lg bg-secondary/50 p-4 text-sm hover:underline"
              >
                Read recent reviews from the last 30 days ↓
              </a>
            )}
          </div>
        </Panel>
      )}
      {!search.plugin && d.recent_reviews.length > 0 && (
        <div id="developer-reviews" className="scroll-mt-24">
          <Panel
            title="Recent reviews"
            description="Latest 20 reviews received in the last 30 days."
          >
            <div className="space-y-4">
              {d.recent_reviews.map((r) => (
                <article key={r.id} className="rounded-xl border p-4">
                  <div className="flex justify-between gap-3">
                    <p className="font-medium">{r.plugin_name}</p>
                    <span className="text-sm">{r.rating} / 5</span>
                  </div>
                  <h3 className="mt-2 text-sm font-medium">{r.title}</h3>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{r.body}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString("en-US")}
                  </p>
                </article>
              ))}
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
function DetailReviews({ data }: { data: Analytics }) {
  const reviews = data.detail?.reviews ?? [];
  return (
    <Panel title="Latest reviews" description="The most recent feedback from Extendly users.">
      {!reviews.length ? (
        <Empty>No reviews yet.</Empty>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {reviews.map((review) => (
            <article key={review.id} className="rounded-xl border p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">{review.username}</p>
                <span className="flex items-center gap-1 text-sm">
                  <Star className="size-3.5 fill-current text-amber-500" />
                  {review.rating}/5
                </span>
              </div>
              {review.title && <h3 className="mt-3 text-sm font-medium">{review.title}</h3>}
              <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">
                {review.body || "Rating without a written review."}
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                {new Date(review.created_at).toLocaleDateString("en-US")}
              </p>
            </article>
          ))}
        </div>
      )}
    </Panel>
  );
}

const activityLabels: Record<string, string> = {
  "plugin.created": "Plugin created",
  "plugin.published": "Plugin published",
  "review.created": "New review",
  "plugin.approved": "Submission approved",
  "plugin.pending_review": "Submitted for review",
  "plugin.submit": "Submitted for review",
  "plugin.rejected": "Submission rejected",
  "plugin.suspended": "Plugin suspended",
  "plugin.unpublished": "Plugin unpublished",
  "plugin.republished": "Plugin republished",
  "plugin.removed_by_developer": "Plugin removed",
  "plugin.restored_by_developer": "Plugin restored",
  "plugin.restored_by_admin": "Plugin restored by administrator",
  "plugin.metadata_updated": "Plugin details updated",
  "plugin.metadata_updated_with_change_request": "Changes submitted for review",
  "plugin.change_request_approved": "Requested changes approved",
  "plugin.change_request_rejected": "Requested changes rejected",
  "plugin.media_added": "Plugin media updated",
  "plugin.media_removed": "Plugin media removed",
};

function PluginActivity({ data }: { data: Analytics }) {
  const events = data.detail?.activity ?? [];
  return (
    <Panel title="Activity" description="A readable history of important plugin events.">
      {!events.length ? (
        <Empty>No recorded activity yet.</Empty>
      ) : (
        <ol className="space-y-1">
          {events.map((event, index) => (
            <li
              key={`${event.created_at}-${index}`}
              className="flex items-center gap-3 rounded-lg px-3 py-3 hover:bg-muted/50"
            >
              <span className="size-2 rounded-full bg-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {activityLabels[event.action] ?? "Plugin updated"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(event.created_at).toLocaleString("en-US")}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

function Performance({
  data,
  range,
  onRange,
}: {
  data: Analytics;
  range: DashboardSearch["range"];
  onRange: (range: DashboardSearch["range"]) => void;
}) {
  const [metric, setMetric] = useState<"views" | "downloads" | "outbound_clicks">("views");
  return (
    <Panel
      title="Performance overview"
      description="Recorded events in UTC. Historical coverage is unknown; missing dates are not assumed to have zero traffic."
    >
      <div className="mb-5 flex flex-wrap gap-3">
        <label className="text-xs text-muted-foreground">
          Range
          <select
            className={fieldClass}
            value={range}
            aria-label="Range"
            onChange={(e) => onRange(e.target.value as DashboardSearch["range"])}
          >
            {[
              ["7", "7 days"],
              ["30", "30 days"],
              ["90", "90 days"],
              ["365", "1 year"],
              ["all", "All time"],
            ].map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">
          Metric
          <select
            className={fieldClass}
            value={metric}
            aria-label="Metric"
            onChange={(e) => setMetric(e.target.value as typeof metric)}
          >
            <option value="views">Views</option>
            <option value="downloads">Downloads</option>
            <option value="outbound_clicks">Outbound clicks</option>
          </select>
        </label>
      </div>
      {!data.history.available ? (
        <Empty>Historical data unavailable. Trends will appear once events are recorded.</Empty>
      ) : !data.history.series.length ? (
        <Empty>No recorded events in this period. Historical coverage is unknown.</Empty>
      ) : (
        <>
          <div
            className="h-64"
            role="img"
            aria-label={`${metric.replaceAll("_", " ")} by ${data.history.bucket}, UTC`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.history.series}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={35} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={45} />
                <Tooltip />
                <Area
                  type="linear"
                  dataKey={metric}
                  stroke="#4f7cff"
                  fill="#4f7cff"
                  fillOpacity={0.12}
                  dot={{ r: 3 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <details className="mt-3 text-xs text-muted-foreground">
            <summary className="cursor-pointer">View recorded values</summary>
            <div className="mt-2 max-h-56 overflow-auto">
              <table className="w-full text-left">
                <thead>
                  <tr>
                    <th>Date (UTC)</th>
                    <th>{metric.replaceAll("_", " ")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.history.series.map((p) => (
                    <tr key={p.date}>
                      <td>{p.date}</td>
                      <td>{p[metric]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
      <p className="mt-4 text-xs text-muted-foreground">
        Add-to-library history is not available yet.
      </p>
    </Panel>
  );
}

type DeveloperPlugin = Analytics["plugins"][number];

function pluginStatus(plugin: DeveloperPlugin) {
  if (plugin.developer_removed_at) return "Removed";
  if (plugin.moderation_status === "approved" && plugin.developer_unpublished_at)
    return "Unpublished";
  if (plugin.moderation_status === "approved") return "Published";
  if (plugin.moderation_status === "suspended") return "Suspended";
  return plugin.moderation_status.replaceAll("_", " ");
}

function PluginStatus({ plugin }: { plugin: DeveloperPlugin }) {
  return (
    <Badge
      variant={plugin.developer_removed_at ? "destructive" : "secondary"}
      className="capitalize"
    >
      {pluginStatus(plugin)}
    </Badge>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate font-medium">{value}</p>
    </div>
  );
}

function CardMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Code2;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl bg-muted/50 p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" /> {label}
      </div>
      <p className="mt-1.5 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function DeletePluginAction({
  plugin,
  busy,
  onDelete,
  menu = false,
}: {
  plugin: DeveloperPlugin;
  busy: boolean;
  onDelete: () => void;
  menu?: boolean;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {menu ? (
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            disabled={busy}
            onSelect={(event) => event.preventDefault()}
          >
            <Trash2 className="size-4" /> Remove
          </DropdownMenuItem>
        ) : (
          <Button
            variant="outline"
            className="text-destructive hover:text-destructive"
            disabled={busy}
          >
            <Trash2 className="mr-2 size-4" /> Remove
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {plugin.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            The plugin will disappear from the marketplace and downloads will stop. Versions, files,
            reviews, analytics and audit history will be retained. You can restore it later unless
            an administrator suspends it.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={onDelete}
          >
            Remove plugin
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function Versions({ data }: { data: Analytics }) {
  const versions = data.detail?.versions ?? data.versions;
  return (
    <Panel
      title="Versions"
      description="Release information is available in read-only mode. Per-version download tracking is not available yet."
    >
      {!versions.length ? (
        <Empty>No versions have been added yet.</Empty>
      ) : (
        <div className="space-y-3">
          {versions.map((v) => (
            <article
              key={v.id}
              className="grid gap-3 rounded-xl border p-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-center"
            >
              <div>
                <p className="text-xs text-muted-foreground">Version</p>
                <p className="mt-1 font-semibold">
                  {v.version_number} {v.is_current && <Badge variant="secondary">Current</Badge>}
                </p>
              </div>
              <Meta label="Status" value={v.status.replaceAll("_", " ")} />
              <Meta
                label="Compatibility"
                value={
                  "compatibility" in v && typeof v.compatibility === "string"
                    ? v.compatibility
                    : "Not specified"
                }
              />
              <Meta
                label="Release date"
                value={
                  v.released_at
                    ? new Date(v.released_at).toLocaleDateString("en-US")
                    : "Not released"
                }
              />
            </article>
          ))}
          <p className="text-xs text-muted-foreground">
            Per-version downloads and download share are unavailable in the current tracking model.
          </p>
        </div>
      )}
      <Button className="mt-4" variant="outline" disabled>
        Upload version — Coming soon
      </Button>
    </Panel>
  );
}
