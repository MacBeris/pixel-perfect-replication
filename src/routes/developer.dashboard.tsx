import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/developer/dashboard")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard", search: { tab: "developer" }, replace: true });
  },
});
