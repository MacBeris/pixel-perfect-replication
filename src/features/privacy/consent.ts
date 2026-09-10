import { useSyncExternalStore } from "react";

export type AnalyticsConsent = "accepted" | "rejected" | null;

const storageKey = "extendshare.privacy.analytics.v1";
const changedEvent = "extendshare:analytics-consent-changed";
export const openPrivacySettingsEvent = "extendshare:open-privacy-settings";

export function getAnalyticsConsent(): AnalyticsConsent {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(storageKey);
  return value === "accepted" || value === "rejected" ? value : null;
}

export function setAnalyticsConsent(value: Exclude<AnalyticsConsent, null>) {
  window.localStorage.setItem(storageKey, value);
  window.dispatchEvent(new Event(changedEvent));
}

function subscribe(listener: () => void) {
  window.addEventListener(changedEvent, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(changedEvent, listener);
    window.removeEventListener("storage", listener);
  };
}

export function useAnalyticsConsent() {
  return useSyncExternalStore(subscribe, getAnalyticsConsent, () => null);
}
