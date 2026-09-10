import { useEffect } from "react";
import { useLocation } from "@tanstack/react-router";

import { interactionIdentity } from "./interaction-identity";
import { recordSitePageView } from "./site-analytics.functions";
import { useAnalyticsConsent } from "@/features/privacy/consent";

const sessionKey = "extendshare.analytics.session.v1";
const timeoutMs = 30 * 60 * 1000;

function analyticsSessionId() {
  const now = Date.now();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(sessionKey) ?? "null") as {
      id?: string;
      lastActivity?: number;
    } | null;
    const active =
      parsed?.id &&
      /^[0-9a-f-]{36}$/i.test(parsed.id) &&
      typeof parsed.lastActivity === "number" &&
      now - parsed.lastActivity < timeoutMs;
    const id = active ? parsed.id! : crypto.randomUUID();
    window.localStorage.setItem(sessionKey, JSON.stringify({ id, lastActivity: now }));
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

export function SiteAnalyticsTracker() {
  const location = useLocation();
  const consent = useAnalyticsConsent();

  useEffect(() => {
    if (consent !== "accepted") return;
    const timer = window.setTimeout(() => {
      void interactionIdentity().then(({ visitorId, accessToken }) =>
        recordSitePageView({
          data: {
            path: `${location.pathname}${location.searchStr ?? ""}`,
            visitorId,
            sessionId: analyticsSessionId(),
            referrer: document.referrer || undefined,
            accessToken,
          },
        }).catch(() => undefined),
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, [consent, location.pathname, location.searchStr]);

  return null;
}
