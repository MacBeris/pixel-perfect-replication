import { siteUrl } from "@/lib/site";

function escapeXml(value: string) {
  return value.replace(/[<>&'"]/g, (character) => {
    const entities: Record<string, string> = {
      "<": "&lt;",
      ">": "&gt;",
      "&": "&amp;",
      "'": "&apos;",
      '"': "&quot;",
    };
    return entities[character]!;
  });
}

export async function createSitemapResponse(_rawEnv: unknown) {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const [plugins, platforms, categories] = await Promise.all([
    db
      .from("plugins")
      .select("slug,updated_at")
      .eq("moderation_status", "approved")
      .is("developer_unpublished_at", null)
      .is("developer_removed_at", null)
      .is("source_hidden_at", null),
    db.from("platforms").select("slug,updated_at").eq("active", true),
    db.from("categories").select("slug,updated_at").eq("active", true),
  ]);
  const error = plugins.error ?? platforms.error ?? categories.error;
  if (error) throw new Error(`Unable to generate sitemap: ${error.message}`);

  const entries = [
    { path: "/" },
    { path: "/plugins" },
    { path: "/about" },
    { path: "/for-developers" },
    ...(platforms.data ?? []).map((item) => ({
      path: `/platform/${item.slug}`,
      updatedAt: item.updated_at,
    })),
    ...(categories.data ?? []).map((item) => ({
      path: `/category/${item.slug}`,
      updatedAt: item.updated_at,
    })),
    ...(plugins.data ?? []).map((item) => ({
      path: `/plugins/${item.slug}`,
      updatedAt: item.updated_at,
    })),
  ];
  const urls = entries
    .map(
      (entry) =>
        `  <url><loc>${escapeXml(siteUrl(entry.path))}</loc>${
          "updatedAt" in entry && entry.updatedAt
            ? `<lastmod>${new Date(entry.updatedAt).toISOString()}</lastmod>`
            : ""
        }</url>`,
    )
    .join("\n");
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    {
      headers: {
        "content-type": "application/xml; charset=utf-8",
        "cache-control": "public, max-age=900, s-maxage=900",
      },
    },
  );
}
