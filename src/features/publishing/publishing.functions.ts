import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Json } from "@/integrations/supabase/types";

const requestSchema = z.object({
  accessToken: z.string().min(1).max(10000),
  action: z.enum([
    "load",
    "create",
    "save",
    "version",
    "reserve_upload",
    "finish_upload",
    "remove_asset",
    "submit",
    "revise",
    "download",
    "outbound",
  ]),
  input: z.record(z.unknown()),
});

export const publishingRequest = createServerFn({ method: "POST" })
  .validator((input: unknown) => requestSchema.parse(input))
  .handler(async ({ data }) => {
    const { handlePublishing } = await import("./publishing.server");
    return handlePublishing(data.action, data.accessToken, data.input as Json);
  });
