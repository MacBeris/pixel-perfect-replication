export const SITE_URL = "https://extendshare.com";

export function siteUrl(path = "/") {
  return new URL(path, SITE_URL).toString();
}
