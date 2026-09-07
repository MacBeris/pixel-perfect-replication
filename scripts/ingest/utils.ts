import { createHash } from "node:crypto";

const entities: Record<string, string> = {
  amp: "&", apos: "'", gt: ">", hellip: "…", laquo: "«", lt: "<", nbsp: " ",
  quot: '"', raquo: "»", rsquo: "’", ndash: "–", mdash: "—",
};

export function plainText(value: unknown): string {
  return String(value ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(x?[0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(code.toLowerCase().startsWith("x") ? parseInt(code.slice(1), 16) : parseInt(code, 10)),
    )
    .replace(/&([a-z]+);/gi, (all, name: string) => entities[name.toLowerCase()] ?? all)
    .replace(/\s+/g, " ")
    .trim();
}

export function slugify(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)]));
  }
  return value;
}

export function hashJson(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

export function isoDate(value: unknown): string | null {
  if (!value) return null;
  const date = new Date(String(value).replace(/ (\d{1,2}:\d{2}(?:am|pm)) GMT$/i, "T$1Z"));
  return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}

export function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

