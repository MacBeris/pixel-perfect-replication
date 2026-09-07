import { loadEnvFile } from "node:process";
import { pathToFileURL } from "node:url";
import { createAdminClient, runImport, runVerification, type IngestOptions } from "./engine.ts";
import type { SourceKey } from "./types.ts";

try { loadEnvFile(".env"); } catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

export function parseArgs(args: string[]): IngestOptions {
  const value = (name: string) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
  const source = value("--source") as SourceKey | undefined;
  if (!source || !["wordpress", "blender", "chrome", "shopify"].includes(source)) throw new Error("Use --source wordpress|blender|chrome|shopify");
  const number = (name: string) => {
    const raw = value(name);
    if (raw === undefined) return undefined;
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isSafeInteger(parsed) || parsed < 1) throw new Error(`${name} must be a positive integer`);
    return parsed;
  };
  return { source, limit: number("--limit"), pages: number("--pages"), dryRun: args.includes("--dry-run"), force: args.includes("--force"), verbose: args.includes("--verbose"), verify: args.includes("--verify") };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.verify && options.dryRun) throw new Error("--verify cannot be combined with --dry-run");
  let db;
  if (!options.dryRun || options.verify) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
    db = createAdminClient(url, key);
  }
  const result = options.verify ? await runVerification(options, db!) : await runImport(options, db);
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
