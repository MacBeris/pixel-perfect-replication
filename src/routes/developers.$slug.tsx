import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { developerFields, pluginSelect } from "@/features/dashboard/data";
import { Busy, Empty, Failure, Panel } from "@/features/dashboard/ui";
import { PluginGrid } from "@/features/plugins/plugin-grid";
import { Button } from "@/components/ui/button";
import { useState } from "react";
export const Route = createFileRoute("/developers/$slug")({
  ssr: false,
  head: () => ({ meta: [{ title: "Developer profile — Extendly" }] }),
  component: DeveloperPage,
});
function DeveloperPage() {
  const { slug } = Route.useParams();
  const { user, loading } = useAuth();
  const [page, setPage] = useState(0);
  const q = useQuery({
    queryKey: ["account", user?.id ?? "public", "public-developer", slug, page],
    enabled: !loading,
    queryFn: async () => {
      const { data: profile, error } = await supabase
        .from("developer_profiles")
        .select(developerFields)
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      if (!profile || (!profile.is_public && profile.owner_id !== user?.id)) return null;
      const { data: plugins, error: pluginError } = await supabase
        .from("plugins")
        .select(pluginSelect)
        .eq("developer_id", profile.id)
        .eq("moderation_status", "approved")
        .order("published_at", { ascending: false })
        .range(page * 20, page * 20 + 19);
      if (pluginError) throw pluginError;
      return { profile, plugins };
    },
  });
  if (loading || q.isPending) return <Busy />;
  if (q.error) return <Failure error={q.error} retry={() => void q.refetch()} />;
  if (!q.data)
    return (
      <div className="container-page py-12">
        <Empty>Developer profile not found or unavailable.</Empty>
      </div>
    );
  const { profile, plugins } = q.data;
  return (
    <div className="container-page space-y-8 py-12">
      <Panel title={profile.name} description={profile.account_type}>
        <div className="flex flex-col gap-5 sm:flex-row">
          {profile.avatar_url && (
            <img
              src={profile.avatar_url}
              className="size-24 rounded-2xl object-cover"
              alt={`${profile.name} avatar`}
            />
          )}
          <div>
            {!profile.is_public && (
              <p className="mb-3 text-sm font-medium text-primary">
                Private profile — visible only to you
              </p>
            )}
            <p className="max-w-2xl whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {profile.description ?? "This developer has not added a description yet."}
            </p>
            <div className="mt-4 flex flex-wrap gap-4">
              {(["website_url", "github_url", "twitter_url"] as const).map(
                (key, i) =>
                  profile[key]?.startsWith("https://") && (
                    <a
                      key={key}
                      href={profile[key]!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline"
                    >
                      {["Website", "GitHub", "X / Twitter"][i]}
                    </a>
                  ),
              )}
            </div>
            {profile.owner_id === user?.id && (
              <Button asChild variant="outline" className="mt-5">
                <Link
                  to="/dashboard"
                  search={{ tab: "developer", profile: profile.id, view: "profile" }}
                >
                  Edit profile
                </Link>
              </Button>
            )}
          </div>
        </div>
      </Panel>
      <h2 className="text-xl font-semibold">Published plugins</h2>
      <PluginGrid plugins={plugins} emptyMessage="No published plugins yet." />
      <div className="flex justify-between">
        <Button disabled={page === 0} variant="outline" onClick={() => setPage(page - 1)}>
          Previous
        </Button>
        <Button disabled={plugins.length < 20} variant="outline" onClick={() => setPage(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}
