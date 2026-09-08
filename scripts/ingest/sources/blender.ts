import type { FetchOptions, HttpClient, NormalizedSourcePlugin, SourceAdapter } from "../types.ts";
import { plainText, slugify, unique } from "../utils.ts";

type BlenderExtension = Record<string, unknown> & { id: string; name: string; website: string };
type BlenderIndex = { version: string; data: BlenderExtension[] };
const API = "https://extensions.blender.org/api/v1/extensions/";
const SITE_ORIGIN = "https://extensions.blender.org";

const blenderCategory: Record<string, string> = {
  animation: "animation", render: "rendering", rendering: "rendering", modeling: "3d-modeling",
  mesh: "3d-modeling", "geometry nodes": "3d-modeling", development: "developer-tools", pipeline: "productivity",
  "user interface": "design-ui",
};

let cachedIndex: BlenderIndex | undefined;
async function getIndex(http: HttpClient) {
  cachedIndex ??= await http.json<BlenderIndex>(API);
  if (cachedIndex.version !== "v1" || !Array.isArray(cachedIndex.data)) throw new Error("Unsupported Blender Extensions index");
  return cachedIndex;
}

type BlenderMedia = { icon_url: string | null; assets: NormalizedSourcePlugin["assets"] };

function officialMediaUrl(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value, SITE_ORIGIN);
    const pathname = url.pathname.replace(/^\/+/, "/");
    if (url.origin !== SITE_ORIGIN || url.protocol !== "https:" || !pathname.startsWith("/media/")) return null;
    url.pathname = pathname;
    return url.toString();
  } catch {
    return null;
  }
}

function attribute(tag: string, name: string) {
  return tag.match(new RegExp(`\\b${name}=["']([^"']*)["']`, "i"))?.[1];
}

export function extractBlenderMedia(html: string, extensionName: string): BlenderMedia {
  const metadataTag = html.match(/<meta[^>]+property=["']og:image["'][^>]*>/i)?.[0];
  const coverUrl = officialMediaUrl(metadataTag ? attribute(metadataTag, "content") : undefined);
  const imageTags = html.match(/<img\b[^>]*>/gi) ?? [];
  const logo = imageTags.find((tag) => attribute(tag, "alt") === `Add-on ${extensionName}`);
  const iconUrl = officialMediaUrl(logo ? attribute(logo, "src") : undefined);
  const screenshotUrls = [...new Set(imageTags
    .map((tag) => officialMediaUrl(attribute(tag, "src")))
    .filter((url): url is string => Boolean(url && url.includes("/media/thumbnails/"))))]
    .slice(0, 10);
  return {
    icon_url: iconUrl,
    assets: [
      ...(coverUrl ? [{ type: "cover" as const, url: coverUrl, alt: `${extensionName} cover`, sort_order: 0 }] : []),
      ...screenshotUrls.map((url, index) => ({ type: "screenshot" as const, url, alt: `${extensionName} screenshot ${index + 1}`, sort_order: index + 1 })),
    ],
  };
}

async function withOfficialMedia(http: HttpClient, item: BlenderExtension, verbose: boolean): Promise<BlenderExtension> {
  try {
    return { ...item, __extendly_media: extractBlenderMedia(await http.text(item.website), item.name) };
  } catch (error) {
    if (verbose) console.warn(`[blender] ${item.id}: media unavailable (${error instanceof Error ? error.message : String(error)})`);
    return item;
  }
}

export const blenderAdapter: SourceAdapter<BlenderExtension> = {
  key: "blender",
  platformSlug: "blender",
  async *fetchList(http: HttpClient, options: FetchOptions) {
    const index = await getIndex(http);
    // The official v1 index can contain separate package variants for one extension ID.
    // ExtendShare's external identity is that ID, so only emit the first (current) variant.
    const emittedIds = new Set<string>();
    let emitted = 0;
    for (const item of index.data) {
      if (emittedIds.has(item.id)) continue;
      emittedIds.add(item.id);
      yield await withOfficialMedia(http, item, options.verbose);
      emitted += 1;
      if (emitted >= (options.limit ?? Infinity)) return;
    }
  },
  async fetchDetails(http, externalId) {
    const index = await getIndex(http);
    const item = index.data.find((candidate) => candidate.id === externalId);
    return item ? await withOfficialMedia(http, item, false) : null;
  },
  async checkPresence(http, externalIds) {
    const index = await getIndex(http);
    const available = new Set(index.data.map((item) => item.id));
    return new Map(externalIds.map((id) => [id, available.has(id)]));
  },
  getExternalId: (raw) => raw.id,
  getSourceUrl: (raw) => raw.website,
  normalize(raw): NormalizedSourcePlugin {
    const sourceTags = Array.isArray(raw.tags) ? raw.tags.map(plainText).filter(Boolean) : [];
    const categorySlugs = unique(sourceTags.map((tag) => blenderCategory[tag.toLowerCase()]).filter(Boolean));
    if (!categorySlugs.length) categorySlugs.push("3d-modeling");
    const licenses = Array.isArray(raw.license) ? raw.license.map((item) => plainText(item).replace(/^SPDX:/, "")) : [];
    const media = raw.__extendly_media && typeof raw.__extendly_media === "object"
      ? raw.__extendly_media as BlenderMedia
      : { icon_url: null, assets: [] };
    return {
      source: "blender", external_id: raw.id, slug: slugify(raw.id), name: plainText(raw.name),
      short_description: plainText(raw.tagline).slice(0, 300), description: null,
      author_name: plainText(raw.maintainer) || null, author_url: null, source_url: raw.website,
      homepage_url: raw.website, version: typeof raw.version === "string" ? raw.version : null,
      pricing_type: "free", price: 0, currency: "USD", license: licenses.join(", ") || null,
      is_open_source: true, rating: null, ratings_count: null, installs_count: null, downloads_count: null,
      category_slugs: categorySlugs,
      tags: sourceTags.slice(0, 20).map((name) => ({ name, slug: slugify(name) })).filter((tag) => tag.slug),
      icon_url: media.icon_url, assets: media.assets,
      compatibility: raw.blender_version_min ? `Blender ${raw.blender_version_min}+${raw.blender_version_max ? ` through ${raw.blender_version_max}` : ""}` : null,
      published_at: null, source_updated_at: null,
    };
  },
};
