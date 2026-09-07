import { useEffect, useRef } from "react";
import { recordPluginInteraction } from "./analytics.functions";
import { interactionIdentity } from "./interaction-identity";

export function PublicPluginView({ pluginId }: { pluginId: string }) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    void interactionIdentity()
      .then((identity) =>
        recordPluginInteraction({ data: { pluginId, type: "page_view", ...identity } }),
      )
      .catch(() => {
        // Analytics must never prevent the public plugin page from rendering.
      });
  }, [pluginId]);
  return null;
}
