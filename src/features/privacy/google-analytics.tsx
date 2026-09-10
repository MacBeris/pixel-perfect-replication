import { useEffect } from "react";
import { useLocation } from "@tanstack/react-router";

import { useAnalyticsConsent } from "./consent";

const measurementId = "G-FDFQ9Y3M3D";
const scriptId = "extendshare-google-analytics";

type AnalyticsWindow = Window & {
  dataLayer?: unknown[][];
  gtag?: (...args: unknown[]) => void;
  [key: `ga-disable-${string}`]: boolean | undefined;
};

function ensureGoogleAnalytics(target: AnalyticsWindow) {
  target[`ga-disable-${measurementId}`] = false;
  target.dataLayer = target.dataLayer ?? [];
  target.gtag = target.gtag ?? ((...args: unknown[]) => target.dataLayer?.push(args));
  if (!document.getElementById(scriptId)) {
    const script = document.createElement("script");
    script.id = scriptId;
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.appendChild(script);
    target.gtag("js", new Date());
    target.gtag("config", measurementId, { send_page_view: false });
  }
}

export function GoogleAnalytics() {
  const consent = useAnalyticsConsent();
  const location = useLocation();

  useEffect(() => {
    const target = window as unknown as AnalyticsWindow;
    if (consent !== "accepted") {
      target[`ga-disable-${measurementId}`] = true;
      return;
    }
    ensureGoogleAnalytics(target);
    target.gtag?.("event", "page_view", {
      page_location: window.location.href,
      page_path: `${location.pathname}${location.searchStr ?? ""}`,
      page_title: document.title,
    });
  }, [consent, location.pathname, location.searchStr]);

  return null;
}
