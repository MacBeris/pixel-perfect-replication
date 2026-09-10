import { useEffect, useRef } from "react";
import { recordPluginInteraction } from "./analytics.functions";
import { interactionIdentity } from "./interaction-identity";
import { useAnalyticsConsent } from "@/features/privacy/consent";

export function PublicPluginView({ pluginId }: { pluginId: string }) {
  const sent = useRef(false);
  const consent = useAnalyticsConsent();
  useEffect(() => {
    if (consent !== "accepted") return;
    if (sent.current) return;
    sent.current = true;
    void interactionIdentity()
      .then((identity) =>
        recordPluginInteraction({
          data: { pluginId, type: "page_view", analyticsConsent: true, ...identity },
        }),
      )
      .catch(() => {
        // Analytics must never prevent the public plugin page from rendering.
      });
  }, [consent, pluginId]);
  return null;
}
