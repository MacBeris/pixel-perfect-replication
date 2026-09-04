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
import { ArrowLeft, ArrowUpRight, Code2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  developerFields,
  loadAnalytics,
  type Analytics,
  type DashboardSearch,
  type DeveloperProfile,
} from "./data";
import { DeveloperProfileForm } from "./developer-profile";
import { PluginEditor } from "@/features/publishing/plugin-editor";
import { Busy, Empty, Failure, Metrics, Panel, fieldClass } from "./ui";

export function DeveloperSection({ userId, search }: { userId: string; search: DashboardSearch }) {
  const [onboarding, setOnboarding] = useState(false);
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
            <Button className="mt-6" onClick={() => setOnboarding(true)}>
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
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
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
          <h2 className="text-2xl font-semibold tracking-tight">{plugin?.name ?? profile.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {search.plugin
              ? "Plugin performance and release history"
              : "Your creative work, at a glance"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
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
        </div>
      </div>
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
            items={[
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
            ]}
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
            </>
          ) : (
            <Panel
              title="Your plugins"
              description="Publishing and editing will be available in a future update."
            >
              <div className="mb-4">
                <Button onClick={() => change({ view: "create", plugin: undefined })}>
                  <Plus className="mr-2 size-4" />
                  Create plugin
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full whitespace-nowrap text-left text-sm">
                  <thead className="border-b text-xs text-muted-foreground">
                    <tr>
                      {[
                        "Plugin",
                        "Status",
                        "Platform",
                        "Distribution",
                        "Version",
                        "Downloads",
                        "Views",
                        "Rating",
                        "Reviews",
                        "Updated",
                        "Actions",
                      ].map((h) => (
                        <th key={h} className="px-3 py-3 font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {d.plugins.map((p) => (
                      <tr key={p.id} className="border-b border-border/60">
                        <td className="px-3 py-4">
                          <div className="flex items-center gap-3">
                            {p.logo_url ? (
                              <img
                                className="size-9 rounded-lg object-cover"
                                src={p.logo_url}
                                alt=""
                              />
                            ) : (
                              <Code2 className="size-8 rounded-lg bg-secondary p-1.5" />
                            )}
                            <span className="font-medium">{p.name}</span>
                          </div>
                        </td>
                        <td className="px-3">
                          <Badge variant="secondary">
                            {p.moderation_status.replaceAll("_", " ")}
                          </Badge>
                          {p.rejection_reason && (
                            <p className="mt-1 max-w-48 whitespace-normal text-xs text-muted-foreground">
                              {p.rejection_reason}
                            </p>
                          )}
                        </td>
                        <td className="px-3">{p.platform ?? "—"}</td>
                        <td className="px-3">
                          {p.listing_type === "external_listing" ? "External" : "Hosted"}
                        </td>
                        <td className="px-3">{p.current_version ?? "Not set"}</td>
                        <td className="px-3">{p.downloads_count}</td>
                        <td className="px-3">{p.views_count}</td>
                        <td className="px-3">{p.reviews_count ? p.rating_average : "—"}</td>
                        <td className="px-3">{p.reviews_count}</td>
                        <td className="px-3">
                          {new Date(p.updated_at).toLocaleDateString("en-US")}
                        </td>
                        <td className="px-3">
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" asChild>
                              <Link to="/plugins/$slug" params={{ slug: p.slug }}>
                                View
                              </Link>
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => change({ plugin: p.id, view: "analytics", page: 1 })}
                            >
                              Analytics
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => change({ plugin: p.id, view: "versions", page: 1 })}
                            >
                              Versions
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => change({ plugin: p.id, view: "edit", page: 1 })}
                            >
                              {p.moderation_status === "draft"
                                ? "Resume draft"
                                : p.moderation_status === "rejected"
                                  ? "Revise submission"
                                  : "Submission"}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={p.moderation_status !== "draft"}
                              onClick={() => change({ plugin: p.id, view: "edit", page: 1 })}
                            >
                              Submit for review
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
      {(incomplete || d.recent_reviews.length > 0) && (
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
      {d.recent_reviews.length > 0 && (
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
function Versions({ data }: { data: Analytics }) {
  return (
    <Panel
      title="Versions"
      description="Release information is available in read-only mode. Per-version download tracking is not available yet."
    >
      {!data.versions.length ? (
        <Empty>No versions have been added yet.</Empty>
      ) : (
        <div className="overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b text-muted-foreground">
              <tr>
                {["Version", "Status", "Release date", "Downloads", "Share of downloads"].map(
                  (h) => (
                    <th className="p-3" key={h}>
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {data.versions.map((v) => (
                <tr key={v.id} className="border-b">
                  <td className="p-3">
                    {v.version_number} {v.is_current && <Badge variant="secondary">Current</Badge>}
                  </td>
                  <td className="p-3">{v.status}</td>
                  <td className="p-3">
                    {v.released_at
                      ? new Date(v.released_at).toLocaleDateString("en-US")
                      : "Not released"}
                  </td>
                  <td className="p-3">Unavailable</td>
                  <td className="p-3">Unavailable</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Button className="mt-4" variant="outline" disabled>
        Upload version — Coming soon
      </Button>
    </Panel>
  );
}
