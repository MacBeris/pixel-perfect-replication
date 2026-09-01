import { createFileRoute } from "@tanstack/react-router";
import { Hero } from "@/features/home/hero";
import { PlatformGrid } from "@/features/home/platform-grid";
import { PluginSection } from "@/features/home/plugin-section";
import { CategoryGrid } from "@/features/home/category-grid";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Extendly — Plugins, extensions and add-ons marketplace" },
      {
        name: "description",
        content:
          "Discover, buy and sell plugins, extensions and add-ons for WordPress, Blender, Unity, Figma, VS Code, Chrome, Shopify and more.",
      },
      { property: "og:title", content: "Extendly — Extend what your tools can do" },
      {
        property: "og:description",
        content: "A marketplace for plugins, extensions and add-ons across 10 creative and developer platforms.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
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
