import { createFileRoute, Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { siteUrl } from "@/lib/site";

const description =
  "Learn how ExtendShare helps people discover and compare plugins, extensions and add-ons from official sources, including WordPress and Blender.";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About ExtendShare | Plugin and Extension Discovery" },
      { name: "description", content: description },
      { property: "og:title", content: "About ExtendShare" },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: siteUrl("/about") },
    ],
    links: [{ rel: "canonical", href: siteUrl("/about") }],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <main className="container-page py-10 sm:py-14 md:py-20">
      <div className="max-w-3xl">
        <p className="text-sm font-medium text-primary">About ExtendShare</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
          One place to discover better extensions
        </h1>
        <p className="mt-5 text-lg leading-8 text-muted-foreground">
          ExtendShare is a catalog for plugins, extensions and add-ons. It helps people compare
          tools, understand compatibility and reach the official place where each extension is
          maintained or distributed.
        </p>
      </div>

      <div className="mt-12 grid gap-5 md:grid-cols-2">
        <section className="rounded-xl border bg-card p-6">
          <h2 className="text-xl font-semibold">A cross-platform catalog</h2>
          <p className="mt-3 leading-7 text-muted-foreground">
            The current catalog includes extensions for WordPress and Blender. ExtendShare is
            designed to support more creative, commerce and developer platforms as the catalog
            grows.
          </p>
          <div className="mt-4 flex gap-4 text-sm">
            <Link
              to="/platform/$slug"
              params={{ slug: "wordpress" }}
              className="text-primary hover:underline"
            >
              WordPress plugins
            </Link>
            <Link
              to="/platform/$slug"
              params={{ slug: "blender" }}
              className="text-primary hover:underline"
            >
              Blender extensions
            </Link>
          </div>
        </section>
        <section className="rounded-xl border bg-card p-6">
          <h2 className="text-xl font-semibold">Official sources, clearly identified</h2>
          <p className="mt-3 leading-7 text-muted-foreground">
            External listings are imported from trusted public catalogs and link back to their
            official source or download page. ExtendShare keeps source statistics separate from
            activity recorded on ExtendShare.
          </p>
        </section>
        <section className="rounded-xl border bg-card p-6">
          <h2 className="text-xl font-semibold">Built for useful comparison</h2>
          <p className="mt-3 leading-7 text-muted-foreground">
            Structured platform, category, compatibility, version, rating and source information
            makes it easier to evaluate extensions without searching across disconnected catalogs.
          </p>
        </section>
        <section className="rounded-xl border bg-card p-6">
          <h2 className="text-xl font-semibold">Listings can return to their creators</h2>
          <p className="mt-3 leading-7 text-muted-foreground">
            An imported listing can be claimed by its verified author. This allows creators to
            connect the listing to their developer profile and manage richer information about their
            work.
          </p>
        </section>
      </div>

      <section className="mt-12 rounded-2xl border bg-surface p-7 md:p-9">
        <h2 className="text-2xl font-semibold">Our goal</h2>
        <p className="mt-3 max-w-3xl leading-7 text-muted-foreground">
          ExtendShare aims to become a dependable discovery layer for the extension ecosystem:
          useful to people looking for better tools and fair to the developers who create them.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/plugins">Explore plugins</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/for-developers">For developers</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
