import { supabaseAdmin as db } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import { validSignature } from "./file-validation";

function object(value: Json): Record<string, Json | undefined> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid request");
  return value;
}
function safeExternal(value: unknown) {
  const url = new URL(String(value));
  if (url.protocol !== "https:" || url.username || url.password)
    throw new Error("Use an HTTPS URL without credentials");
  return url.href;
}
export async function handlePublishing(action: string, token: string, input: Json): Promise<Json> {
  const { data: auth, error } = await db.auth.getUser(token);
  if (error || !auth.user) throw new Error("Your session has expired. Please sign in again.");
  const actor = auth.user.id;
  const args = object(input);
  const id = String(args["id"] ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Invalid plugin ID");
  if (args["external_purchase_url"])
    args["external_purchase_url"] = safeExternal(args["external_purchase_url"]);
  async function rpc(operation: string, payload: Json = input) {
    const { data, error } = await db.rpc("publishing_action", {
      _actor: actor,
      _action: operation,
      _input: payload,
    });
    if (error)
      throw new Error(
        error.code === "23505" ? "This slug or version number is already in use." : error.message,
      );
    return data;
  }
  if (action === "load") {
    const { data: plugin, error } = await db.from("plugins").select("*").eq("id", id).single();
    if (error || !plugin) throw new Error("Plugin unavailable");
    const { data: owner } = await db
      .from("developer_profiles")
      .select("id")
      .eq("id", plugin.developer_id ?? "")
      .eq("owner_id", actor)
      .maybeSingle();
    if (!owner) throw new Error("Plugin unavailable");
    const [versions, assets, categories, tags] = await Promise.all([
      db.from("plugin_versions").select("*").eq("plugin_id", id).order("created_at"),
      db.from("plugin_assets").select("*").eq("plugin_id", id).order("sort_order"),
      db.from("plugin_categories").select("category_id").eq("plugin_id", id),
      db.from("plugin_tags").select("tag_id").eq("plugin_id", id),
    ]);
    for (const result of [versions, assets, categories, tags])
      if (result.error) throw new Error(result.error.message);
    return {
      plugin,
      versions: versions.data,
      assets: assets.data,
      categories: categories.data,
      tags: tags.data,
    } as Json;
  }
  if (action === "reserve_upload") {
    const reservation = object(await rpc(action));
    const bucket = String(reservation["bucket"]),
      path = String(reservation["staging_path"]);
    const { data, error } = await db.storage
      .from(bucket)
      .createSignedUploadUrl(path, { upsert: false });
    if (error) throw new Error(error.message);
    // Bounded opportunistic cleanup, only this actor's expired unfinished uploads.
    const { data: expired } = await db
      .from("plugin_uploads")
      .select("id,bucket,staging_path,final_path")
      .eq("actor_id", actor)
      .is("completed_at", null)
      .lt("created_at", new Date(Date.now() - 3 * 3600000).toISOString())
      .limit(10);
    for (const old of expired ?? []) {
      const removed = await db.storage.from(old.bucket).remove([old.staging_path, old.final_path]);
      if (!removed.error)
        await db.from("plugin_uploads").delete().eq("id", old.id).is("completed_at", null);
    }
    return { uploadId: reservation["id"] ?? null, bucket, path, token: data.token };
  }
  if (action === "finish_upload") {
    const { data: upload, error } = await db
      .from("plugin_uploads")
      .select("*")
      .eq("id", String(args["upload_id"]))
      .eq("plugin_id", id)
      .eq("actor_id", actor)
      .single();
    if (error || !upload) throw new Error("Upload unavailable");
    if (upload.completed_at) return { completed: true };
    if (Date.now() - Date.parse(upload.created_at) > 2 * 3600000)
      throw new Error("Upload expired. Please upload again.");
    const bucket = db.storage.from(upload.bucket);
    // Move before verification. Previously issued upload tokens cannot change this path.
    const moved = await bucket.move(upload.staging_path, upload.final_path);
    if (moved.error) {
      const exists = await bucket.info(upload.final_path);
      if (exists.error) throw new Error("Upload is not complete. Try again.");
    }
    const info = await bucket.info(upload.final_path);
    if (
      info.error ||
      Number(info.data.size) !== upload.size ||
      info.data.contentType !== upload.mime
    )
      throw new Error("File size or MIME does not match the upload");
    const signed = await bucket.createSignedUrl(upload.final_path, 60);
    if (signed.error) throw new Error(signed.error.message);
    const response = await fetch(signed.data.signedUrl, { headers: { Range: "bytes=0-31" } });
    if (!response.ok || !response.body) throw new Error("Unable to validate the uploaded file");
    const reader = response.body.getReader();
    const { value } = await reader.read();
    await reader.cancel();
    if (!value || !validSignature(value, upload.mime, upload.kind === "zip"))
      throw new Error(
        "The file contents do not match its format. Choose a valid image or non-empty ZIP.",
      );
    const publicUrl =
      upload.kind === "zip" ? null : bucket.getPublicUrl(upload.final_path).data.publicUrl;
    return rpc(action, { id, upload_id: upload.id, public_url: publicUrl });
  }
  if (action === "download") {
    const authorized = object(await rpc("download"));
    const { data, error } = await db.storage
      .from("plugin-files")
      .createSignedUrl(String(authorized["file_path"]), 60, {
        download: String(authorized["filename"]),
      });
    if (error) throw new Error("The ZIP is temporarily unavailable. Please try again.");
    await rpc("record_download");
    return {
      signedUrl: data.signedUrl,
      filename: authorized["filename"] ?? null,
      expires_at: new Date(Date.now() + 60000).toISOString(),
    };
  }
  if (action === "outbound") {
    const value = object(await rpc(action));
    return { url: safeExternal(value["url"]) };
  }
  return rpc(action);
}
