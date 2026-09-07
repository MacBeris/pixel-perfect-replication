import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SafeHttpClient } from "./http.ts";
import { getAdapter } from "./registry.ts";
import { hashJson } from "./utils.ts";
import { noOpEnrichment, type EnrichmentStage, type SourceKey } from "./types.ts";

export type IngestOptions = {
  source: SourceKey;
  limit?: number;
  pages?: number;
  dryRun: boolean;
  force: boolean;
  verbose: boolean;
  verify: boolean;
};

type Counters = { fetched: number; created: number; updated: number; unchanged: number; failed: number };

export function createAdminClient(url: string, key: string): SupabaseClient {
  const isOpaque = key.startsWith("sb_secret_");
  const customFetch: typeof fetch = (input, init) => {
    const headers = new Headers(init?.headers);
    if (isOpaque && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
    headers.set("apikey", key);
    return fetch(input, { ...init, headers });
  };
  return createClient(url, key, { global: { fetch: customFetch }, auth: { persistSession: false, autoRefreshToken: false } });
}

async function recordFailure(db: SupabaseClient, source: string, externalId: string, raw: unknown, runId: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  await db.from("raw_source_items").upsert({ source, external_id: externalId, raw_payload: raw, raw_hash: hashJson(raw), status: "error", error_message: message.slice(0, 2000), last_run_id: runId, last_seen_at: new Date().toISOString() }, { onConflict: "source,external_id" });
}

export async function runImport(options: IngestOptions, db?: SupabaseClient, enrichment: EnrichmentStage = noOpEnrichment) {
  const adapter = getAdapter(options.source);
  const http = new SafeHttpClient();
  const counts: Counters = { fetched: 0, created: 0, updated: 0, unchanged: 0, failed: 0 };
  let runId: string | undefined;
  if (!options.dryRun) {
    if (!db) throw new Error("Supabase configuration is required unless --dry-run is used");
    const { data, error } = await db.from("import_runs").insert({ source: options.source, parameters: options }).select("id").single();
    if (error) throw error;
    runId = data.id;
  }

  try {
    for await (const raw of adapter.fetchList(http, { limit: options.limit, pages: options.pages, verbose: options.verbose })) {
      if (options.limit && counts.fetched >= options.limit) break;
      counts.fetched += 1;
      const externalId = adapter.getExternalId(raw);
      try {
        const normalized = await enrichment.enrich(adapter.normalize(raw));
        if (options.verbose || options.dryRun) console.log(`[${options.source}] ${externalId} -> ${normalized.slug}`);
        if (options.dryRun) continue;
        const { data, error } = await db!.rpc("ingest_source_item", {
          _run_id: runId, _source: options.source, _platform_slug: adapter.platformSlug,
          _external_id: externalId, _raw: raw, _raw_hash: hashJson(raw),
          _normalized: normalized, _normalized_hash: hashJson(normalized), _force: options.force,
        });
        if (error) throw error;
        const outcome = String((data as { outcome?: string })?.outcome ?? "failed") as keyof Counters;
        if (outcome in counts) counts[outcome] += 1;
        else counts.failed += 1;
      } catch (error) {
        counts.failed += 1;
        console.error(`[${options.source}] ${externalId}: ${error instanceof Error ? error.message : error}`);
        if (db && runId) await recordFailure(db, options.source, externalId, raw, runId, error);
      }
    }
    if (db && runId) {
      const status = counts.failed === 0 ? "completed" : counts.failed < counts.fetched ? "partial" : "failed";
      const { error } = await db.from("import_runs").update({ ...counts, status, finished_at: new Date().toISOString() }).eq("id", runId);
      if (error) throw error;
    }
    return { runId, ...counts };
  } catch (error) {
    if (db && runId) await db.from("import_runs").update({ ...counts, status: "failed", finished_at: new Date().toISOString(), error_message: (error instanceof Error ? error.message : String(error)).slice(0, 2000) }).eq("id", runId);
    throw error;
  }
}

export async function runVerification(options: IngestOptions, db: SupabaseClient) {
  const adapter = getAdapter(options.source);
  const http = new SafeHttpClient({ timeoutMs: 20_000, retries: 4, concurrency: 3, minDelayMs: 250 });
  const { data: run, error: runError } = await db.from("import_runs").insert({ source: options.source, parameters: { ...options, verify: true } }).select("id").single();
  if (runError) throw runError;
  let query = db.from("plugins").select("external_id").eq("source", options.source).eq("source_managed", true).not("external_id", "is", null).order("source_last_checked_at", { ascending: true, nullsFirst: true });
  if (options.limit) query = query.limit(options.limit);
  const { data, error } = await query;
  if (error) throw error;
  const ids = (data ?? []).map((row) => row.external_id as string);
  const counts = { checked: 0, present: 0, missing: 0, hidden: 0, failed: 0 };
  try {
    const results = adapter.checkPresence
      ? await adapter.checkPresence(http, ids)
      : new Map(await Promise.all(ids.map(async (id) => [id, (await adapter.fetchDetails(http, id)) !== null] as const)));
    for (const id of ids) {
      const exists = results.get(id);
      if (exists === undefined) { counts.failed += 1; continue; }
      const { data: result, error: rpcError } = await db.rpc("record_source_presence", { _source: options.source, _external_id: id, _exists: exists });
      if (rpcError) { counts.failed += 1; console.error(`[${options.source}] verify ${id}: ${rpcError.message}`); continue; }
      counts.checked += 1;
      const outcome = (result as { outcome?: string })?.outcome;
      if (outcome === "present") counts.present += 1;
      if (outcome === "missing") counts.missing += 1;
      if (outcome === "hidden") counts.hidden += 1;
      if (options.verbose) console.log(`[${options.source}] ${id}: ${outcome}`);
    }
    await db.from("import_runs").update({ status: counts.failed ? "partial" : "completed", finished_at: new Date().toISOString(), fetched: counts.checked, unchanged: counts.present, updated: counts.missing + counts.hidden, failed: counts.failed }).eq("id", run.id);
  } catch (error) {
    await db.from("import_runs").update({ status: "failed", finished_at: new Date().toISOString(), failed: ids.length || 1, error_message: (error instanceof Error ? error.message : String(error)).slice(0, 2000) }).eq("id", run.id);
    throw error;
  }
  return { runId: run.id, ...counts };
}
