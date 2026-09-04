import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/developer/plugins/$id/analytics")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/dashboard",
      search: { tab: "developer", plugin: params.id, view: "analytics" },
      replace: true,
    });
  },
});
