import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3, BadgeCheck, Link2, MessageSquareText, Search, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { siteUrl } from "@/lib/site";

const description =
  "Publish or claim your plugin on ExtendShare, create a developer profile, improve discoverability and understand how users engage with your listing.";

const benefits = [
  {
    icon: UserRound,
    title: "Developer profile",
    copy: "Present your work under one public creator identity.",
  },
  {
    icon: Search,
    title: "Better discoverability",
    copy: "Make your plugin easier to find by platform, category and search.",
  },
  {
    icon: BarChart3,
    title: "Plugin analytics",
    copy: "See privacy-preserving views, downloads and engagement trends.",
  },
  {
    icon: MessageSquareText,
    title: "Reviews and ratings",
    copy: "Learn from feedback shared by verified ExtendShare users.",
  },
  {
    icon: BadgeCheck,
    title: "Claim an existing listing",
    copy: "Connect an imported external listing with its real author.",
  },
  {
    icon: Link2,
    title: "Official source links",
    copy: "Send users to the official download or source maintained by you.",
  },
];

export const Route = createFileRoute("/for-developers")({
  head: () => ({
    meta: [
      { title: "Publish or Claim Your Plugin | ExtendShare for Developers" },
      { name: "description", content: description },
      { property: "og:title", content: "ExtendShare for Developers" },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: siteUrl("/for-developers") },
    ],
    links: [{ rel: "canonical", href: siteUrl("/for-developers") }],
  }),
  component: ForDevelopersPage,
});

function ForDevelopersPage() {
  return (
    <main className="container-page py-10 sm:py-14 md:py-20">
      <div className="max-w-3xl">
        <p className="text-sm font-medium text-primary">ExtendShare for developers</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
          Help the right users discover your plugin
        </h1>
        <p className="mt-5 text-lg leading-8 text-muted-foreground">
          Reach new users with a structured listing, a public developer profile and clear links to
          the official place where your extension is maintained.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link to="/dashboard" search={{ tab: "developer" }}>
              Publish your plugin
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/dashboard" search={{ tab: "developer" }}>
              Claim your plugin
            </Link>
          </Button>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Creating and maintaining a listing is free.
        </p>
      </div>

      <section className="mt-14">
        <h2 className="text-2xl font-semibold">Tools for sustainable discovery</h2>
        <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {benefits.map(({ icon: Icon, title, copy }) => (
            <article key={title} className="rounded-xl border bg-card p-6">
              <Icon className="size-5 text-primary" aria-hidden="true" />
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-12 rounded-2xl border bg-surface p-7 md:p-9">
        <h2 className="text-2xl font-semibold">Reach new users without losing ownership</h2>
        <p className="mt-3 max-w-3xl leading-7 text-muted-foreground">
          ExtendShare supplements your official website or marketplace presence. External listings
          keep their source attribution and direct visitors to official destinations rather than
          presenting ExtendShare as the original publisher.
        </p>
        <div className="mt-5 flex flex-wrap gap-4 text-sm">
          <Link to="/about" className="text-primary hover:underline">
            How ExtendShare works
          </Link>
          <Link to="/plugins" className="text-primary hover:underline">
            Explore the catalog
          </Link>
        </div>
      </section>
    </main>
  );
}
