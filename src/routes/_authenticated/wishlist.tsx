import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/_authenticated/wishlist")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard", search: { tab: "wishlist" }, replace: true });
  },
});
