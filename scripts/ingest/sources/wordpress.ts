import type { FetchOptions, HttpClient, NormalizedSourcePlugin, SourceAdapter } from "../types.ts";
import { isoDate, plainText, slugify, unique } from "../utils.ts";

type WordPressPlugin = Record<string, unknown> & { slug: string; name: string };
type WordPressResponse = { info?: { pages?: number }; plugins?: WordPressPlugin[]; error?: string };

const API = "https://api.wordpress.org/plugins/info/1.2/";

function requestUrl(action: "query_plugins" | "plugin_information", params: Record<string, string>) {
  const query = new URLSearchParams({ action });
  for (const [key, value] of Object.entries(params)) query.set(`request[${key}]`, value);
  if (action === "query_plugins") {
    for (const field of ["description", "sections", "active_installs", "icons", "banners", "downloaded"]) query.set(`request[fields][${field}]`, "1");
  }
  return `${API}?${query}`;
}

const categoryRules: Array<[RegExp, string]> = [
  [/seo|search engine/, "seo"], [/shop|store|commerce|payment/, "ecommerce"], [/security|firewall|spam/, "security"],
  [/cache|performance|speed|optimi/, "performance"], [/analytics|tracking|statistics/, "analytics"],
  [/marketing|newsletter|email/, "marketing"], [/design|block|builder|theme|gallery/, "design-ui"],
  [/developer|api|debug|code/, "developer-tools"], [/integration|connector|webhook/, "integrations"],
];

export const wordpressAdapter: SourceAdapter<WordPressPlugin> = {
  key: "wordpress",
  platformSlug: "wordpress",
  async *fetchList(http: HttpClient, options: FetchOptions) {
    const perPage = Math.min(100, options.limit ?? 100);
    const maxPages = options.pages ?? Math.ceil((options.limit ?? perPage) / perPage);
    let emitted = 0;
    for (let page = 1; page <= maxPages && emitted < (options.limit ?? Infinity); page += 1) {
      const data = await http.json<WordPressResponse>(requestUrl("query_plugins", { page: String(page), per_page: String(perPage), browse: "popular" }));
      if (!Array.isArray(data.plugins)) throw new Error("WordPress API returned no plugin list");
      for (const plugin of data.plugins) {
        yield plugin;
        emitted += 1;
        if (emitted >= (options.limit ?? Infinity)) return;
      }
      if (page >= (data.info?.pages ?? page)) return;
    }
  },
  async fetchDetails(http, externalId) {
    const result = await http.json<WordPressPlugin & { error?: string }>(requestUrl("plugin_information", { slug: externalId }));
    if (result.error) {
      if (/not found|closed/i.test(result.error)) return null;
      throw new Error(`WordPress API: ${result.error}`);
    }
    return result;
  },
  getExternalId: (raw) => raw.slug,
  getSourceUrl: (raw) => `https://wordpress.org/plugins/${raw.slug}/`,
  normalize(raw): NormalizedSourcePlugin {
    const tagsRecord = (raw.tags && typeof raw.tags === "object" ? raw.tags : {}) as Record<string, unknown>;
    const tags = Object.entries(tagsRecord).map(([slug, name]) => ({ slug: slugify(slug), name: plainText(name) })).filter((tag) => tag.slug && tag.name).slice(0, 20);
    const searchable = `${tags.map((tag) => `${tag.slug} ${tag.name}`).join(" ")} ${plainText(raw.short_description)}`;
    const categorySlugs = unique(categoryRules.filter(([pattern]) => pattern.test(searchable.toLowerCase())).map(([, category]) => category));
    if (!categorySlugs.length) categorySlugs.push("content");
    const icons = (raw.icons && typeof raw.icons === "object" ? raw.icons : {}) as Record<string, string>;
    const banners = (raw.banners && typeof raw.banners === "object" ? raw.banners : {}) as Record<string, string>;
    const author = plainText(raw.author);
    const sourceUrl = `https://wordpress.org/plugins/${raw.slug}/`;
    return {
      source: "wordpress", external_id: raw.slug, slug: slugify(raw.slug), name: plainText(raw.name),
      short_description: plainText(raw.short_description).slice(0, 300),
      description: plainText((raw.sections as Record<string, unknown> | undefined)?.description ?? raw.description) || null,
      author_name: author || null, author_url: typeof raw.author_profile === "string" ? raw.author_profile : null,
      source_url: sourceUrl, homepage_url: typeof raw.homepage === "string" ? raw.homepage : null,
      version: typeof raw.version === "string" ? raw.version : null, pricing_type: "free", price: 0, currency: "USD",
      license: null, is_open_source: true,
      rating: typeof raw.rating === "number" ? Math.round(raw.rating / 20 * 100) / 100 : null,
      ratings_count: typeof raw.num_ratings === "number" ? raw.num_ratings : null,
      installs_count: typeof raw.active_installs === "number" ? raw.active_installs : null,
      downloads_count: typeof raw.downloaded === "number" ? raw.downloaded : null,
      category_slugs: categorySlugs, tags, icon_url: icons["2x"] ?? icons["1x"] ?? icons.svg ?? null,
      assets: (banners.high ?? banners.low) ? [{ type: "cover", url: banners.high ?? banners.low, alt: `${plainText(raw.name)} banner`, sort_order: 0 }] : [],
      compatibility: [raw.requires ? `Requires WordPress ${raw.requires}+` : null, raw.tested ? `Tested through ${raw.tested}` : null, raw.requires_php ? `Requires PHP ${raw.requires_php}+` : null].filter(Boolean).join(" · ") || null,
      published_at: isoDate(raw.added), source_updated_at: isoDate(raw.last_updated),
    };
  },
};

