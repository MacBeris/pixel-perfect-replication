import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Busy } from "@/features/dashboard/ui";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    const legacy = ["library", "favorites", "wishlist"].find(
      (tab) => location.pathname === `/${tab}`,
    );
    const returnTo =
      location.pathname === "/dashboard"
        ? location.href
        : legacy
          ? `/dashboard?tab=${legacy}`
          : "/dashboard";
    return { user: error ? null : data.user, returnTo };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, returnTo } = Route.useRouteContext();
  const navigate = useNavigate();
  useEffect(() => {
    if (!user) void navigate({ to: "/auth", search: { next: returnTo }, replace: true });
  }, [user, returnTo, navigate]);
  return user ? <Outlet /> : <Busy />;
}
