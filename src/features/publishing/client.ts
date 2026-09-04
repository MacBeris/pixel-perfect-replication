import { supabase } from "@/integrations/supabase/client";
import { publishingRequest } from "./publishing.functions";

export async function publishing(
  action:
    | "load"
    | "create"
    | "save"
    | "version"
    | "reserve_upload"
    | "finish_upload"
    | "remove_asset"
    | "submit"
    | "revise"
    | "download"
    | "outbound",
  input: Record<string, unknown>,
) {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Please sign in to continue.");
  return publishingRequest({ data: { accessToken: data.session.access_token, action, input } });
}
