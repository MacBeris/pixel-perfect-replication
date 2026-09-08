const botPattern =
  /(?:googlebot|bingbot|yandexbot|baiduspider|duckduckbot|ahrefsbot|semrushbot|mj12bot|dotbot|petalbot|discordbot|twitterbot|facebookexternalhit|slackbot|uptimerobot|pingdom|statuscake|curl\/|wget\/|python-requests|go-http-client|headlesschrome|lighthouse)/i;
const assetPattern =
  /\.(?:avif|bmp|css|gif|ico|jpe?g|js|json|map|mjs|otf|pdf|png|svg|ttf|webp|woff2?|xml|zip)$/i;

export type CloudflareBotSignal = {
  botManagement?: { verifiedBot?: boolean; score?: number; staticResource?: boolean };
};

export function botReason(userAgent: string, cf?: CloudflareBotSignal) {
  if (cf?.botManagement?.verifiedBot) return "cloudflare_verified_bot";
  if (typeof cf?.botManagement?.score === "number" && cf.botManagement.score <= 29) {
    return "cloudflare_bot_score";
  }
  if (botPattern.test(userAgent)) return "known_bot_user_agent";
  return null;
}

export function isTrackablePagePath(path: string) {
  const clean = path.toLowerCase();
  if (assetPattern.test(clean)) return false;
  return ![
    "/api/",
    "/_server/",
    "/_build/",
    "/assets/",
    "/favicon",
    "/robots.txt",
    "/sitemap",
    "/health",
    "/healthcheck",
  ].some((part) => clean === part.replace(/\/$/, "") || clean.startsWith(part));
}

export function isPrefetch(headers: Headers) {
  return ["purpose", "sec-purpose", "x-purpose", "x-moz"].some((name) =>
    /prefetch|preload/i.test(headers.get(name) ?? ""),
  );
}

export function normalizedPath(value: string) {
  try {
    const url = new URL(value, "https://extendshare.com");
    return `${url.pathname}${url.search}`.slice(0, 1024);
  } catch {
    return "/";
  }
}
