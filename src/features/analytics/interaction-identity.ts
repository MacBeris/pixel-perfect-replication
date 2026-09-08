import { supabase } from "@/integrations/supabase/client";

const visitorKey = "extendshare.analytics.visitor.v1";

export function analyticsVisitorId() {
  try {
    const stored = window.localStorage.getItem(visitorKey);
    if (stored && /^[0-9a-f-]{36}$/i.test(stored)) return stored;
    const created = crypto.randomUUID();
    window.localStorage.setItem(visitorKey, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}

export async function interactionIdentity() {
  const { data } = await supabase.auth.getSession();
  return {
    visitorId: analyticsVisitorId(),
    accessToken: data.session?.access_token,
  };
}
