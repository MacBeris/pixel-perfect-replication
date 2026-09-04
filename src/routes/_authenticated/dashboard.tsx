import { createFileRoute, Link } from "@tanstack/react-router";
import {
  LayoutDashboard,
  LibraryBig,
  Heart,
  ListPlus,
  FolderOpen,
  MessageSquare,
  Code2,
  Settings,
} from "lucide-react";
import { searchSchema, tabs } from "@/features/dashboard/data";
import { AccountSection } from "@/features/dashboard/account";
import { DeveloperSection } from "@/features/dashboard/developer";
import { fieldClass } from "@/features/dashboard/ui";

export const Route = createFileRoute("/_authenticated/dashboard")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [{ title: "Your dashboard — Extendly" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  component: Dashboard,
});
const icons = [
  LayoutDashboard,
  LibraryBig,
  Heart,
  ListPlus,
  FolderOpen,
  MessageSquare,
  Code2,
  Settings,
];
function Dashboard() {
  const { user } = Route.useRouteContext();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  if (!user) return null;
  return (
    <div className="container-page py-8 lg:py-12">
      <div className="mb-7">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Your workspace
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Account dashboard</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Discover, organize and create. All from one account.
        </p>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[210px_minmax(0,1fr)]">
        <label className="block text-sm lg:hidden">
          Dashboard section
          <select
            aria-label="Dashboard section"
            className={fieldClass}
            value={search.tab}
            onChange={(event) =>
              void navigate({
                search: { tab: tabs.find((tab) => tab === event.target.value) ?? "overview" },
              })
            }
          >
            {tabs.map((tab) => (
              <option key={tab} value={tab}>
                {tab[0]?.toUpperCase()}
                {tab.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <nav
          aria-label="Account dashboard"
          className="hidden gap-1 rounded-xl border border-border bg-card p-2 lg:sticky lg:top-24 lg:flex lg:flex-col"
        >
          {tabs.map((tab, i) => {
            const Icon = icons[i] ?? LayoutDashboard;
            return (
              <Link
                key={tab}
                to="/dashboard"
                search={{ tab }}
                aria-current={search.tab === tab ? "page" : undefined}
                className={`flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm capitalize transition-colors ${search.tab === tab ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
              >
                <Icon className="size-4" />
                {tab}
              </Link>
            );
          })}
        </nav>
        <div className="min-w-0" key={user.id}>
          {search.tab === "developer" ? (
            <DeveloperSection userId={user.id} search={search} />
          ) : (
            <AccountSection userId={user.id} tab={search.tab} />
          )}
        </div>
      </div>
    </div>
  );
}
