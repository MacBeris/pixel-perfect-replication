import type { FetchOptions, HttpClient, NormalizedSourcePlugin, SourceAdapter } from "../types.ts";
import { plainText, slugify, unique } from "../utils.ts";

type BlenderExtension = Record<string, unknown> & { id: string; name: string; website: string };
type BlenderIndex = { version: string; data: BlenderExtension[] };
const API = "https://extensions.blender.org/api/v1/extensions/";

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

export const blenderAdapter: SourceAdapter<BlenderExtension> = {
  key: "blender",
  platformSlug: "blender",
  async *fetchList(http: HttpClient, options: FetchOptions) {
    const index = await getIndex(http);
    for (const item of index.data.slice(0, options.limit ?? index.data.length)) yield item;
  },
  async fetchDetails(http, externalId) {
    const index = await getIndex(http);
    return index.data.find((item) => item.id === externalId) ?? null;
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
    return {
      source: "blender", external_id: raw.id, slug: slugify(raw.id), name: plainText(raw.name),
      short_description: plainText(raw.tagline).slice(0, 300), description: null,
      author_name: plainText(raw.maintainer) || null, author_url: null, source_url: raw.website,
      homepage_url: raw.website, version: typeof raw.version === "string" ? raw.version : null,
      pricing_type: "free", price: 0, currency: "USD", license: licenses.join(", ") || null,
      is_open_source: true, rating: null, ratings_count: null, installs_count: null, downloads_count: null,
      category_slugs: categorySlugs,
      tags: sourceTags.slice(0, 20).map((name) => ({ name, slug: slugify(name) })).filter((tag) => tag.slug),
      icon_url: null, assets: [],
      compatibility: raw.blender_version_min ? `Blender ${raw.blender_version_min}+${raw.blender_version_max ? ` through ${raw.blender_version_max}` : ""}` : null,
      published_at: null, source_updated_at: null,
    };
  },
};
