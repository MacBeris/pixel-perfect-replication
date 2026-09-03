/* eslint-disable @typescript-eslint/no-explicit-any -- Server dashboard payload is intentionally flexible while marketplace modules are enabled incrementally. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Activity,
  BarChart3,
  Check,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  Flag,
  FolderTree,
  LayoutDashboard,
  Loader2,
  PackageCheck,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  deleteCatalogItem,
  getAdminDashboard,
  moderatePlugin,
  saveCatalogItem,
  updateAdminWorkflow,
} from "@/features/admin/admin.functions";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  head: () => ({ meta: [{ title: "Admin — Extendly" }] }),
});

type Section = "overview" | "plugins" | "claims" | "reports" | "catalog" | "users" | "marketplace" | "analytics" | "activity";
type DashboardData = any;

const sections: Array<{ id: Section; label: string; icon: typeof LayoutDashboard }> = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "plugins", label: "Plugin moderation", icon: PackageCheck },
  { id: "claims", label: "Claims", icon: ClipboardCheck },
  { id: "reports", label: "Reports", icon: Flag },
  { id: "catalog", label: "Catalog", icon: FolderTree },
  { id: "users", label: "Users & developers", icon: Users },
  { id: "marketplace", label: "Marketplace", icon: CircleDollarSign },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "activity", label: "Activity log", icon: Activity },
];

function statusVariant(status: string) {
  if (["approved", "paid", "published", "resolved"].includes(status)) return "default" as const;
  if (["rejected", "suspended", "failed"].includes(status)) return "destructive" as const;
  return "secondary" as const;
}

function date(value?: string | null) {
  return value ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
}

function Metric({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
      {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{children}</div>;
}

function AdminPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [authorized, setAuthorized] = useState(false);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [section, setSection] = useState<Section>("overview");
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async (accessToken = session?.access_token) => {
    if (!accessToken) return;
    setRefreshing(true);
    setLoadError(null);
    try {
      const result = await getAdminDashboard({ data: { accessToken } });
      setDashboard(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load the admin dashboard.";
      setLoadError(message);
      toast.error(message);
    } finally {
      setRefreshing(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    if (loading) return;
    if (!session) {
      navigate({ to: "/auth" });
      return;
    }
    let active = true;
    supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", session.user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error || !data) {
          toast.error("You do not have access to the admin area.");
          navigate({ to: "/" });
          return;
        }
        setAuthorized(true);
        void load(session.access_token);
      });
    return () => {
      active = false;
    };
  }, [loading, session, navigate, load]);

  async function run(action: () => Promise<unknown>) {
    try {
      await action();
      toast.success("Changes saved.");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The action could not be completed.");
    }
  }

  if (loading || !authorized) {
    return (
      <div className="container-page flex min-h-[70vh] items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (loadError || !dashboard) {
    return (
      <div className="container-page flex min-h-[70vh] items-center justify-center py-12">
        <div className="max-w-xl rounded-xl border border-border bg-card p-7 text-center shadow-sm">
          <ShieldCheck className="mx-auto size-7 text-primary" />
          <h1 className="mt-4 text-xl font-semibold">Admin access is configured, but data is unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">{loadError ?? "Loading admin data…"}</p>
          <p className="mt-4 text-sm text-muted-foreground">Set <code>SUPABASE_URL</code> and <code>SUPABASE_SERVICE_ROLE_KEY</code> as server-only Cloudflare secrets, then reload this page.</p>
          <Button className="mt-5" onClick={() => void load()} disabled={refreshing}>{refreshing ? "Retrying…" : "Retry"}</Button>
        </div>
      </div>
    );
  }

  const content = {
    overview: <Overview dashboard={dashboard} onNavigate={setSection} />,
    plugins: <Plugins dashboard={dashboard} accessToken={session!.access_token} onRun={run} />,
    claims: <Workflow dashboard={dashboard} kind="claims" accessToken={session!.access_token} onRun={run} />,
    reports: <Workflow dashboard={dashboard} kind="reports" accessToken={session!.access_token} onRun={run} />,
    catalog: <Catalog dashboard={dashboard} accessToken={session!.access_token} onRun={run} />,
    users: <UsersAndDevelopers dashboard={dashboard} />,
    marketplace: <Marketplace dashboard={dashboard} />,
    analytics: <Analytics dashboard={dashboard} />,
    activity: <ActivityLog dashboard={dashboard} />,
  }[section];

  return (
    <div className="container-page py-8 lg:py-10">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-primary"><ShieldCheck className="size-4" /> Administration</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Extendly control center</h1>
          <p className="mt-2 text-sm text-muted-foreground">Moderate the marketplace, protect its community and manage its catalog.</p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={refreshing}>
          {refreshing && <Loader2 className="mr-2 size-4 animate-spin" />} Refresh data
        </Button>
      </div>

      <div className="grid gap-8 lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="h-fit rounded-xl border border-border bg-card p-2">
          <nav className="space-y-1">
            {sections.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setSection(id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${section === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
              >
                <Icon className="size-4" /> {label}
              </button>
            ))}
          </nav>
          <div className="mt-3 border-t border-border px-3 pt-3 text-xs text-muted-foreground">
            <Link to="/" className="hover:text-foreground">Return to marketplace</Link>
          </div>
        </aside>
        <main className="min-w-0">{content}</main>
      </div>
    </div>
  );
}

function Overview({ dashboard, onNavigate }: { dashboard: DashboardData; onNavigate: (section: Section) => void }) {
  const metrics = dashboard.metrics;
  return (
    <div className="space-y-8">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Users" value={metrics.users} detail={`${metrics.developers} developer profiles`} />
        <Metric label="Plugins" value={dashboard.plugins.length} detail={`${metrics.pluginStatuses.pending_review ?? 0} awaiting review`} />
        <Metric label="Open moderation" value={metrics.openClaims + metrics.openReports} detail={`${metrics.openClaims} claims · ${metrics.openReports} reports`} />
        <Metric label="Marketplace revenue" value={`$${metrics.totalRevenue.toFixed(2)}`} detail="Stripe is not configured" />
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between"><h2 className="font-semibold">Plugin moderation</h2><Button size="sm" variant="ghost" onClick={() => onNavigate("plugins")}>Review queue <ChevronRight className="ml-1 size-4" /></Button></div>
          <div className="mt-5 flex flex-wrap gap-2">
            {Object.entries(metrics.pluginStatuses).map(([status, count]) => <Badge key={status} variant={statusVariant(status)}>{status.replaceAll("_", " ")}: {String(count)}</Badge>)}
            {!Object.keys(metrics.pluginStatuses).length && <span className="text-sm text-muted-foreground">No plugins yet.</span>}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between"><h2 className="font-semibold">Recent activity</h2><Button size="sm" variant="ghost" onClick={() => onNavigate("activity")}>View all <ChevronRight className="ml-1 size-4" /></Button></div>
          <div className="mt-4 space-y-3">
            {dashboard.audit.slice(0, 4).map((entry: any) => <div key={entry.id} className="flex items-center justify-between gap-4 text-sm"><span>{entry.action}</span><span className="shrink-0 text-xs text-muted-foreground">{date(entry.created_at)}</span></div>)}
            {!dashboard.audit.length && <p className="text-sm text-muted-foreground">Administrative actions will appear here.</p>}
          </div>
        </div>
      </section>
    </div>
  );
}

function Plugins({ dashboard, accessToken, onRun }: { dashboard: DashboardData; accessToken: string; onRun: (action: () => Promise<unknown>) => Promise<void> }) {
  const [filter, setFilter] = useState("all");
  const plugins = dashboard.plugins.filter((plugin: any) => filter === "all" || plugin.moderation_status === filter);
  const update = (plugin: any, status: string) => {
    const reason = status === "rejected" ? window.prompt("Reason for rejection (shown to the developer):") || "" : "";
    if (status === "rejected" && !reason) return;
    void onRun(() => moderatePlugin({ data: { accessToken, pluginId: plugin.id, status: status as any, reason } }));
  };
  return <div className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">Plugin moderation</h2><p className="text-sm text-muted-foreground">Approve only listings that meet marketplace quality standards.</p></div><select value={filter} onChange={(event) => setFilter(event.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm"><option value="all">All statuses</option><option value="draft">Draft</option><option value="pending_review">Pending review</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="suspended">Suspended</option></select></div><div className="space-y-3">{plugins.map((plugin: any) => <div key={plugin.id} className="rounded-xl border border-border bg-card p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><h3 className="font-semibold">{plugin.name}</h3><Badge variant={statusVariant(plugin.moderation_status)}>{plugin.moderation_status.replaceAll("_", " ")}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{plugin.short_description}</p><p className="mt-2 text-xs text-muted-foreground">Developer: {plugin.developer?.name ?? "Unclaimed"} · Submitted {date(plugin.created_at)}</p></div><div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => update(plugin, "approved")}><Check className="mr-1 size-3.5" /> Approve</Button><Button size="sm" variant="outline" onClick={() => update(plugin, "pending_review")}>Queue</Button><Button size="sm" variant="outline" onClick={() => update(plugin, "suspended")}>Suspend</Button><Button size="sm" variant="destructive" onClick={() => update(plugin, "rejected")}><X className="mr-1 size-3.5" /> Reject</Button></div></div></div>)}{!plugins.length && <Empty>No plugins match this moderation state.</Empty>}</div></div>;
}

function Workflow({ dashboard, kind, accessToken, onRun }: { dashboard: DashboardData; kind: "claims" | "reports"; accessToken: string; onRun: (action: () => Promise<unknown>) => Promise<void> }) {
  const items = dashboard[kind] as any[];
  const title = kind === "claims" ? "Plugin claims" : "Community reports";
  const resolve = (item: any, status: string) => {
    const notes = window.prompt("Optional admin note:") || "";
    void onRun(() => updateAdminWorkflow({ data: { accessToken, kind, itemId: item.id, status: status as any, notes } }));
  };
  return <div className="space-y-5"><div><h2 className="text-xl font-semibold">{title}</h2><p className="text-sm text-muted-foreground">Review evidence and leave a clear decision trail.</p></div><div className="space-y-3">{items.map((item: any) => <div key={item.id} className="rounded-xl border border-border bg-card p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><h3 className="font-semibold">{item.plugin?.name ?? (kind === "reports" ? item.target_type : "Unknown plugin")}</h3><Badge variant={statusVariant(item.status)}>{item.status}</Badge></div><p className="mt-2 text-sm text-muted-foreground">{kind === "claims" ? item.message || item.evidence || "No evidence supplied." : item.reason}</p>{kind === "reports" && item.details && <p className="mt-1 text-sm text-muted-foreground">{item.details}</p>}<p className="mt-2 text-xs text-muted-foreground">Submitted {date(item.created_at)}</p></div><div className="flex flex-wrap gap-2">{kind === "claims" ? <><Button size="sm" onClick={() => resolve(item, "approved")}>Approve</Button><Button size="sm" variant="destructive" onClick={() => resolve(item, "rejected")}>Reject</Button></> : <><Button size="sm" variant="outline" onClick={() => resolve(item, "reviewing")}>Reviewing</Button><Button size="sm" onClick={() => resolve(item, "resolved")}>Resolve</Button><Button size="sm" variant="destructive" onClick={() => resolve(item, "dismissed")}>Dismiss</Button></>}</div></div></div>)}{!items.length && <Empty>No {kind} need attention.</Empty>}</div></div>;
}

function Catalog({ dashboard, accessToken, onRun }: { dashboard: DashboardData; accessToken: string; onRun: (action: () => Promise<unknown>) => Promise<void> }) {
  const [kind, setKind] = useState<"platforms" | "categories" | "tags">("categories");
  const [editingId, setEditingId] = useState<string | undefined>();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const items = dashboard[kind] as any[];
  const editingItem = items.find((item: any) => item.id === editingId);
  const reset = () => { setEditingId(undefined); setName(""); setSlug(""); setDescription(""); };
  const save = (event: React.FormEvent) => { event.preventDefault(); void onRun(async () => { const result = await saveCatalogItem({ data: { accessToken, kind, id: editingId, name, slug, description, active: editingItem?.active, sortOrder: editingItem?.sort_order } }); reset(); return result; }); };
  const edit = (item: any) => { setEditingId(item.id); setName(item.name); setSlug(item.slug); setDescription(item.description || ""); };
  return <div className="space-y-6"><div><h2 className="text-xl font-semibold">Catalog management</h2><p className="text-sm text-muted-foreground">Control marketplace taxonomy without changing application code.</p></div><div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]"><form onSubmit={save} className="h-fit space-y-4 rounded-xl border border-border bg-card p-5"><div className="space-y-2"><Label>Type</Label><select value={kind} disabled={Boolean(editingId)} onChange={(event) => { setKind(event.target.value as any); reset(); }} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"><option value="platforms">Platform</option><option value="categories">Category</option><option value="tags">Tag</option></select></div><div className="space-y-2"><Label>Name</Label><Input value={name} onChange={(event) => setName(event.target.value)} required /></div><div className="space-y-2"><Label>Slug</Label><Input value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="lowercase-slug" required /></div>{kind !== "tags" && <div className="space-y-2"><Label>Description</Label><Textarea value={description} onChange={(event) => setDescription(event.target.value)} /></div>}<Button className="w-full" type="submit">{editingId ? "Save changes" : `Add ${kind.slice(0, -1)}`}</Button>{editingId && <Button className="w-full" type="button" variant="outline" onClick={reset}>Cancel editing</Button>}</form><div className="space-y-2">{items.map((item: any) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"><div><p className="font-medium">{item.name}</p><p className="text-xs text-muted-foreground">/{item.slug}{item.description ? ` · ${item.description}` : ""}</p></div><div className="flex items-center gap-2"><Button size="sm" variant="outline" onClick={() => edit(item)}>Edit</Button>{"active" in item && <Button size="sm" variant="outline" onClick={() => void onRun(() => saveCatalogItem({ data: { accessToken, kind, id: item.id, name: item.name, slug: item.slug, description: item.description || "", active: !item.active, sortOrder: item.sort_order } }))}>{item.active ? "Active" : "Hidden"}</Button>}<Button size="sm" variant="destructive" onClick={() => { if (window.confirm(`Delete ${item.name}? This cannot be undone.`)) void onRun(() => deleteCatalogItem({ data: { accessToken, kind, id: item.id } })); }}>Delete</Button></div></div>)}{!items.length && <Empty>No {kind} exist yet.</Empty>}</div></div></div>;
}

function UsersAndDevelopers({ dashboard }: { dashboard: DashboardData }) {
  return <div className="space-y-8"><div><h2 className="text-xl font-semibold">Users & developers</h2><p className="text-sm text-muted-foreground">Role management is intentionally restricted to technical owners outside this panel.</p></div><section><h3 className="mb-3 font-semibold">Users</h3><div className="overflow-hidden rounded-xl border border-border bg-card"><div className="divide-y divide-border">{dashboard.users.map((user: any) => <div key={user.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="font-medium">{user.email ?? "Email unavailable"}</p><p className="text-xs text-muted-foreground">Joined {date(user.created_at)} · Last sign-in {date(user.last_sign_in_at)}</p></div><Badge variant="secondary">Managed externally</Badge></div>)}{!dashboard.users.length && <Empty>No users found.</Empty>}</div></div></section><section><h3 className="mb-3 font-semibold">Developer profiles</h3><div className="grid gap-3 sm:grid-cols-2">{dashboard.developerProfiles.map((developer: any) => <div key={developer.id} className="rounded-xl border border-border bg-card p-4"><div className="flex items-center justify-between gap-2"><p className="font-medium">{developer.name}</p>{developer.verified && <Badge>Verified</Badge>}</div><p className="text-xs text-muted-foreground">/{developer.slug} · {developer.is_public ? "Public" : "Private"}</p></div>)}{!dashboard.developerProfiles.length && <Empty>No developer profiles yet.</Empty>}</div></section></div>;
}

function Marketplace({ dashboard }: { dashboard: DashboardData }) {
  return <div className="space-y-6"><div><h2 className="text-xl font-semibold">Marketplace operations</h2><p className="text-sm text-muted-foreground">Financial records are visible; payment actions remain disabled until Stripe is configured.</p></div><div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5"><div className="flex items-center gap-2 font-medium text-amber-700 dark:text-amber-300"><CircleDollarSign className="size-4" /> Stripe & Connect not configured</div><p className="mt-1 text-sm text-muted-foreground">Checkout, transfers, refunds and payouts cannot be created from this environment.</p></div><div className="grid gap-4 md:grid-cols-3"><Metric label="Purchases" value={dashboard.purchases.length} /><Metric label="Transactions" value={dashboard.transactions.length} /><Metric label="Payout requests" value={dashboard.payouts.length} /></div><section className="rounded-xl border border-border bg-card p-5"><h3 className="font-semibold">Recent transactions</h3><div className="mt-4 space-y-3">{dashboard.transactions.slice(0, 10).map((transaction: any) => <div key={transaction.id} className="flex items-center justify-between text-sm"><span>{transaction.type}{transaction.description ? ` · ${transaction.description}` : ""}</span><span>{transaction.currency} {transaction.amount}</span></div>)}{!dashboard.transactions.length && <p className="text-sm text-muted-foreground">No financial activity yet.</p>}</div></section></div>;
}

function Analytics({ dashboard }: { dashboard: DashboardData }) {
  const entries = Object.entries(dashboard.metrics.analyticsByType) as Array<[string, number]>;
  return <div className="space-y-6"><div><h2 className="text-xl font-semibold">Marketplace analytics</h2><p className="text-sm text-muted-foreground">Counts are based on recorded plugin analytics events.</p></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{entries.map(([type, count]) => <Metric key={type} label={type.replaceAll("_", " ")} value={count} />)}{!entries.length && <Empty>Analytics will appear as users browse, save and download plugins.</Empty>}</div></div>;
}

function ActivityLog({ dashboard }: { dashboard: DashboardData }) {
  const emails = useMemo(() => new Map(dashboard.users.map((user: any) => [user.id, user.email])), [dashboard.users]);
  return <div className="space-y-5"><div><h2 className="text-xl font-semibold">Activity log</h2><p className="text-sm text-muted-foreground">Append-only record of administrative marketplace actions.</p></div><div className="overflow-hidden rounded-xl border border-border bg-card"><div className="divide-y divide-border">{dashboard.audit.map((entry: any) => <div key={entry.id} className="flex flex-wrap items-center justify-between gap-4 p-4"><div><p className="font-medium">{entry.action}</p><p className="mt-1 text-xs text-muted-foreground">{entry.resource_type} · {emails.get(entry.actor_id) ?? entry.actor_id ?? "Deleted administrator"}{entry.reason ? ` · ${entry.reason}` : ""}</p></div><time className="text-xs text-muted-foreground">{date(entry.created_at)}</time></div>)}{!dashboard.audit.length && <Empty>Administrative actions will be recorded here.</Empty>}</div></div></div>;
}
