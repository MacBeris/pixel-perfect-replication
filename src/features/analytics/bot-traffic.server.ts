import {
  botReason,
  isPrefetch,
  isTrackablePagePath,
  normalizedPath,
} from "./site-analytics.shared";

type WorkerEnv = {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

export async function recordExcludedBotPageRequest(request: Request, rawEnv: unknown) {
  if (request.method !== "GET" || isPrefetch(request.headers)) return;
  const accept = request.headers.get("accept") ?? "";
  const destination = request.headers.get("sec-fetch-dest");
  if (!accept.includes("text/html") && destination !== "document") return;

  const path = normalizedPath(request.url);
  if (!isTrackablePagePath(path)) return;
  const cf = (request as Request & { cf?: Parameters<typeof botReason>[1] }).cf;
  const reason = botReason(request.headers.get("user-agent") ?? "", cf);
  if (!reason) return;

  const env = rawEnv as WorkerEnv;
  const supabaseUrl = env?.SUPABASE_URL ?? process.env["SUPABASE_URL"];
  const key = env?.SUPABASE_SERVICE_ROLE_KEY ?? process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !key) return;
  const headers = new Headers({
    apikey: key,
    "content-type": "application/json",
    prefer: "return=minimal",
  });
  if (!key.startsWith("sb_secret_")) headers.set("authorization", `Bearer ${key}`);
  const response = await fetch(`${supabaseUrl}/rest/v1/site_analytics_events`, {
    method: "POST",
    headers,
    body: JSON.stringify({ event_kind: "excluded_bot", path, excluded_reason: reason }),
  });
  if (!response.ok) throw new Error(`Bot analytics insert failed (${response.status}).`);
}
