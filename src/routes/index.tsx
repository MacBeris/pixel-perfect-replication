import { createFileRoute } from "@tanstack/react-router";
import { Hero } from "@/features/home/hero";
import { PlatformGrid } from "@/features/home/platform-grid";
import { PluginSection } from "@/features/home/plugin-section";
import { CategoryGrid } from "@/features/home/category-grid";
import { t } from "@/lib/i18n";
import { SITE_URL } from "@/lib/site";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ExtendShare — Plugins, extensions and add-ons marketplace" },
      {
        name: "description",
        content:
          "Discover plugins, extensions and add-ons for WordPress, Blender and more. Compare tools, find official downloads and discover new extensions on ExtendShare.",
      },
      { property: "og:title", content: "ExtendShare — Extend what your tools can do" },
      {
        property: "og:description",
        content:
          "Discover and compare plugins, extensions and add-ons with clear links to their official sources.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: SITE_URL },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: SITE_URL }],
  }),
  component: Index,
});

function Index() {
  return (
    <>
      <Hero />
      <PlatformGrid />
      <PluginSection
        title={t("section.trending")}
        description="What the community is looking at right now."
        queryKey="trending"
        query={{ sort: "trending" }}
        viewAllSearch={{ sort: "trending" }}
      />
      <PluginSection
        title={t("section.popular")}
        queryKey="popular"
        query={{ sort: "popular" }}
        viewAllSearch={{ sort: "popular" }}
      />
      <PluginSection
        title={t("section.newReleases")}
        queryKey="newest"
        query={{ sort: "newest" }}
        viewAllSearch={{ sort: "newest" }}
      />
      <PluginSection
        title={t("section.topRated")}
        queryKey="top_rated"
        query={{ sort: "top_rated" }}
        viewAllSearch={{ sort: "top_rated" }}
      />
      <PluginSection
        title={t("section.free")}
        queryKey="free"
        query={{ pricingModel: "free" }}
        viewAllSearch={{ pricing: "free" }}
      />
      <PluginSection
        title={t("section.openSource")}
        queryKey="open_source"
        query={{ openSourceOnly: true }}
        viewAllSearch={{ openSource: "true" }}
      />
      <CategoryGrid />
    </>
  );
}
