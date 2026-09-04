import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Busy, Failure, Panel, fieldClass } from "@/features/dashboard/ui";
import { message } from "@/features/dashboard/data";
import { publishing } from "./client";
import { DownloadButton } from "./plugin-download";

const loadedSchema = z.object({
  plugin: z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    short_description: z.string(),
    full_description: z.string().nullable(),
    platform_id: z.string(),
    compatibility: z.string().nullable(),
    license: z.string().nullable(),
    listing_type: z.enum(["direct_sale", "external_listing"]),
    external_purchase_url: z.string().nullable(),
    moderation_status: z.string(),
    rejection_reason: z.string().nullable(),
  }),
  versions: z.array(
    z.object({
      id: z.string(),
      version_number: z.string(),
      changelog: z.string().nullable(),
      compatibility: z.string().nullable(),
      file_verified_at: z.string().nullable(),
      file_size: z.number().nullable(),
    }),
  ),
  assets: z.array(
    z.object({ id: z.string(), asset_type: z.string(), public_url: z.string().nullable() }),
  ),
  categories: z.array(z.object({ category_id: z.string() })),
  tags: z.array(z.object({ tag_id: z.string() })),
});
type Loaded = z.infer<typeof loadedSchema>;
type Catalog = { id: string; name: string }[];
export function PluginEditor({
  userId,
  profileId,
  pluginId,
  onClose,
}: {
  userId: string;
  profileId: string;
  pluginId?: string | undefined;
  onClose: () => void;
}) {
  const q = useQuery({
    queryKey: ["account", userId, "editor", profileId, pluginId],
    queryFn: async () => {
      const [platforms, categories, tags, loaded] = await Promise.all([
        supabase.from("platforms").select("id,name").eq("active", true).order("name"),
        supabase.from("categories").select("id,name").eq("active", true).order("name"),
        supabase.from("tags").select("id,name").order("name"),
        pluginId ? publishing("load", { id: pluginId }) : Promise.resolve(null),
      ]);
      for (const value of [platforms, categories, tags]) if (value.error) throw value.error;
      return {
        platforms: platforms.data ?? [],
        categories: categories.data ?? [],
        tags: tags.data ?? [],
        loaded: loaded ? loadedSchema.parse(loaded) : null,
      };
    },
  });
  if (q.isPending) return <Busy />;
  if (q.error) return <Failure error={q.error} retry={() => void q.refetch()} />;
  return (
    <EditorForm
      key={pluginId ?? profileId}
      {...q.data}
      userId={userId}
      profileId={profileId}
      onClose={onClose}
    />
  );
}
function EditorForm({
  loaded,
  platforms,
  categories,
  tags,
  userId,
  profileId,
  onClose,
}: {
  loaded: Loaded | null;
  platforms: Catalog;
  categories: Catalog;
  tags: Catalog;
  userId: string;
  profileId: string;
  onClose: () => void;
}) {
  const cache = useQueryClient();
  const [id] = useState(() => loaded?.plugin.id ?? crypto.randomUUID());
  const [created, setCreated] = useState(Boolean(loaded));
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState(loaded?.plugin.moderation_status ?? "draft");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [form, setForm] = useState({
    name: loaded?.plugin.name ?? "",
    slug: loaded?.plugin.slug ?? "",
    short_description: loaded?.plugin.short_description ?? "",
    platform_id: loaded?.plugin.platform_id ?? "",
    full_description: loaded?.plugin.full_description ?? "",
    compatibility: loaded?.plugin.compatibility ?? "",
    license: loaded?.plugin.license ?? "",
    listing_type: loaded?.plugin.listing_type ?? "direct_sale",
    external_purchase_url: loaded?.plugin.external_purchase_url ?? "",
    categories: loaded?.categories.map((x) => x.category_id) ?? ([] as string[]),
    tags: loaded?.tags.map((x) => x.tag_id) ?? ([] as string[]),
  });
  const [version, setVersion] = useState({
    version_number: loaded?.versions[0]?.version_number ?? "1.0.0",
    changelog: loaded?.versions[0]?.changelog ?? "",
    compatibility: loaded?.versions[0]?.compatibility ?? "",
  });
  const [assets, setAssets] = useState(loaded?.assets ?? []);
  const [verified, setVerified] = useState(Boolean(loaded?.versions[0]?.file_verified_at));
  const [uploadProgress, setUploadProgress] = useState("");
  const [newTags, setNewTags] = useState("");
  const editable = status === "draft";
  const steps = ["Basics", "Description", "Media", "Distribution", "Version", "Review"];
  async function refresh() {
    const data = loadedSchema.parse(await publishing("load", { id }));
    setAssets(data.assets);
    setVerified(Boolean(data.versions[0]?.file_verified_at));
    setStatus(data.plugin.moderation_status);
    await cache.invalidateQueries({ queryKey: ["account", userId, "developer-analytics"] });
  }
  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
      setUploadProgress("");
    }
  }
  async function save() {
    await publishing(created ? "save" : "create", {
      id,
      developer_id: profileId,
      ...form,
      tag_names: newTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    });
    setCreated(true);
    setNotice("Draft saved. You can return to it from Developer.");
    await cache.invalidateQueries({ queryKey: ["account", userId, "developer-analytics"] });
  }
  async function saveVersion() {
    await publishing("version", { id, ...version });
  }
  async function upload(kind: string, file?: File) {
    if (!file) return;
    await run(async () => {
      await save();
      if (kind === "zip") await saveVersion();
      if (kind !== "zip") {
        const bitmap = await createImageBitmap(file);
        bitmap.close();
      }
      setUploadProgress("Preparing upload…");
      const reservation = z
        .object({ uploadId: z.string(), bucket: z.string(), path: z.string(), token: z.string() })
        .parse(
          await publishing("reserve_upload", {
            id,
            kind,
            name: file.name,
            mime: file.type || "application/octet-stream",
            size: file.size,
          }),
        );
      setUploadProgress("Uploading file… Keep this page open.");
      const result = await supabase.storage
        .from(reservation.bucket)
        .uploadToSignedUrl(reservation.path, reservation.token, file, {
          contentType: file.type || "application/octet-stream",
        });
      if (result.error) throw result.error;
      setUploadProgress("Verifying uploaded file…");
      await publishing("finish_upload", { id, upload_id: reservation.uploadId });
      await refresh();
      setNotice("File uploaded and verified.");
    });
  }
  const checks: [string, boolean][] = [
    [
      "Name and slug",
      form.name.trim().length >= 2 && /^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$/.test(form.slug),
    ],
    ["Short description", form.short_description.trim().length >= 10],
    ["Platform", Boolean(form.platform_id)],
    [
      "Categories and tags",
      form.categories.length > 0 && (form.tags.length > 0 || Boolean(newTags.trim())),
    ],
    ["Full description", form.full_description.trim().length >= 30],
    ["Compatibility", Boolean(form.compatibility.trim())],
    ["Logo", assets.some((a) => a.asset_type === "logo")],
    ["Screenshots", assets.some((a) => a.asset_type === "screenshot")],
    ...(form.listing_type === "direct_sale"
      ? ([
          ["Verified ZIP", verified],
          [
            "Version changelog and compatibility",
            Boolean(version.changelog.trim() && version.compatibility.trim()),
          ],
        ] as [string, boolean][])
      : ([["External HTTPS URL", /^https:\/\//.test(form.external_purchase_url)]] as [
          string,
          boolean,
        ][])),
  ];
  function field(
    key:
      | "name"
      | "slug"
      | "short_description"
      | "full_description"
      | "compatibility"
      | "license"
      | "external_purchase_url",
    label: string,
    multiline = false,
  ) {
    return (
      <label className="grid gap-2 text-sm">
        {label}
        {multiline ? (
          <textarea
            className={fieldClass}
            rows={key === "full_description" ? 10 : 3}
            value={form[key]}
            onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          />
        ) : (
          <input
            className={fieldClass}
            value={form[key]}
            onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          />
        )}
      </label>
    );
  }
  function choices(key: "categories" | "tags", items: Catalog) {
    return (
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm capitalize">{key}</legend>
        <div className="flex max-h-48 flex-wrap gap-3 overflow-y-auto rounded-lg border p-3">
          {items.map((item) => (
            <label key={item.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form[key].includes(item.id)}
                onChange={(e) =>
                  setForm({
                    ...form,
                    [key]: e.target.checked
                      ? [...form[key], item.id]
                      : form[key].filter((x) => x !== item.id),
                  })
                }
              />
              {item.name}
            </label>
          ))}
        </div>
      </fieldset>
    );
  }
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">{created ? "Your plugin" : "Create plugin"}</h2>
          <Badge variant="secondary">{status.replaceAll("_", " ")}</Badge>
        </div>
        <Button variant="outline" disabled={busy} onClick={onClose}>
          Back to Developer
        </Button>
      </div>
      {!editable && (
        <Panel
          title={status === "pending_review" ? "Submission received" : "Read-only submission"}
          description={
            status === "pending_review"
              ? "Your plugin and files are locked while awaiting review."
              : (loaded?.plugin.rejection_reason ?? "This submission cannot be edited.")
          }
        >
          {status === "rejected" && (
            <Button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await publishing("revise", { id });
                  setStatus("draft");
                  await refresh();
                })
              }
            >
              Revise submission
            </Button>
          )}
          {created && verified && (
            <div className="mt-3">
              <DownloadButton pluginId={id} test />
            </div>
          )}
        </Panel>
      )}
      <div className="flex flex-wrap gap-2" aria-label="Publishing steps">
        {steps.map((label, i) => (
          <Button
            key={label}
            variant={step === i ? "default" : "outline"}
            size="sm"
            disabled={busy || (!created && i > 0)}
            onClick={() =>
              void run(async () => {
                if (editable) {
                  await save();
                  if (step === 4 && form.listing_type === "direct_sale") await saveVersion();
                }
                setStep(i);
              })
            }
          >
            {i + 1}. {label}
          </Button>
        ))}
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/40 p-4 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {(notice || uploadProgress) && (
        <p role="status" className="text-sm text-muted-foreground">
          {uploadProgress || notice}
        </p>
      )}
      <Panel
        title={steps[step] ?? "Review"}
        description={step === 0 ? "Save Basics to create a private draft." : ""}
      >
        <fieldset disabled={!editable || busy} className="grid gap-5 disabled:opacity-75">
          {step === 0 && (
            <>
              {field("name", "Name")}
              {field("slug", "Slug")}
              {field("short_description", "Short description", true)}
              <label className="grid gap-2 text-sm">
                Platform
                <select
                  className={fieldClass}
                  value={form.platform_id}
                  onChange={(e) => setForm({ ...form, platform_id: e.target.value })}
                >
                  <option value="">Choose platform</option>
                  {platforms.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              {choices("categories", categories)}
              {choices("tags", tags)}
              <label className="grid gap-2 text-sm">
                New tags (comma-separated, up to 5)
                <input
                  className={fieldClass}
                  value={newTags}
                  onChange={(e) => setNewTags(e.target.value)}
                  placeholder="procedural, trees"
                />
              </label>
            </>
          )}
          {step === 1 && (
            <>
              {field(
                "full_description",
                "Full description — include features, requirements and installation instructions",
                true,
              )}
              {field("compatibility", "Supported versions / compatibility", true)}
              {field("license", "License")}
            </>
          )}
          {step === 2 && (
            <>
              <p className="text-sm text-muted-foreground">
                JPEG, PNG or WebP, up to 5 MB each. Up to 10 screenshots. Media URLs are public,
                including draft media.
              </p>
              {["logo", "screenshot", "banner"].map((kind) => (
                <label key={kind} className="grid gap-2 text-sm capitalize">
                  {kind}
                  {kind === "banner" ? " (optional)" : ""}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      void upload(kind, file);
                    }}
                  />
                </label>
              ))}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {assets.map((asset) => (
                  <div key={asset.id} className="rounded-lg border p-2">
                    {asset.public_url && (
                      <img
                        src={asset.public_url}
                        alt={asset.asset_type}
                        className="h-24 w-full rounded object-contain"
                      />
                    )}
                    <p className="text-xs">{asset.asset_type}</p>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        void run(async () => {
                          await publishing("remove_asset", { id, asset_id: asset.id });
                          await refresh();
                        })
                      }
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </>
          )}
          {step === 3 && (
            <>
              <label className="grid gap-2 text-sm">
                Distribution
                <select
                  className={fieldClass}
                  value={form.listing_type}
                  onChange={(e) =>
                    setForm({ ...form, listing_type: e.target.value as typeof form.listing_type })
                  }
                >
                  <option value="direct_sale">Hosted on Extendly</option>
                  <option value="external_listing">External listing</option>
                </select>
              </label>
              {form.listing_type === "external_listing" ? (
                field("external_purchase_url", "External HTTPS URL")
              ) : (
                <p className="text-sm text-muted-foreground">
                  New hosted plugins are free. Marketplace purchases and paid publishing are not
                  available yet.
                </p>
              )}
            </>
          )}
          {step === 4 &&
            (form.listing_type === "external_listing" ? (
              <p>
                This listing links to an external platform. No ZIP or hosted version is required.
              </p>
            ) : (
              <>
                {(["version_number", "changelog", "compatibility"] as const).map((key) => (
                  <label key={key} className="grid gap-2 text-sm">
                    {key === "version_number"
                      ? "Version number"
                      : key === "changelog"
                        ? "Changelog"
                        : "Version compatibility"}
                    <textarea
                      rows={key === "version_number" ? 1 : 3}
                      className={fieldClass}
                      value={version[key]}
                      onChange={(e) => setVersion({ ...version, [key]: e.target.value })}
                    />
                  </label>
                ))}
                <label className="grid gap-2 text-sm">
                  ZIP package — up to 50 MB
                  <input
                    type="file"
                    accept=".zip,application/zip"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      void upload("zip", file);
                    }}
                  />
                </label>
                <p className="text-sm">
                  {verified
                    ? "A verified ZIP is attached. Upload again to replace it before submission."
                    : "Upload a non-empty ZIP. Format validation is not a malware scan."}
                </p>
              </>
            ))}
        </fieldset>
        {step === 5 && (
          <div className="space-y-5">
            <div className="rounded-xl bg-muted/40 p-5">
              <h3 className="text-xl font-semibold">{form.name}</h3>
              <p className="mt-2 text-sm">{form.short_description}</p>
              <p className="mt-4 whitespace-pre-wrap text-sm text-muted-foreground">
                {form.full_description}
              </p>
            </div>
            <ul className="grid gap-2 text-sm sm:grid-cols-2">
              {checks.map(([label, ok]) => (
                <li key={label} className={ok ? "text-foreground" : "text-destructive"}>
                  {ok ? "✓" : "○"} {label}
                </li>
              ))}
            </ul>
            {editable && (
              <Button
                disabled={busy || checks.some(([, ok]) => !ok)}
                onClick={() =>
                  void run(async () => {
                    await save();
                    if (form.listing_type === "direct_sale") await saveVersion();
                    await publishing("submit", { id });
                    await refresh();
                    setNotice("Submitted for review.");
                  })
                }
              >
                Submit for review
              </Button>
            )}
          </div>
        )}
        {editable && (
          <div className="mt-6 flex flex-wrap gap-3">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await save();
                  if (step === 4 && form.listing_type === "direct_sale") await saveVersion();
                })
              }
            >
              Save draft
            </Button>
            {step < 5 && (
              <Button
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await save();
                    if (step === 4 && form.listing_type === "direct_sale") await saveVersion();
                    setStep(step + 1);
                  })
                }
              >
                Save and continue
              </Button>
            )}
          </div>
        )}
      </Panel>
      {created && verified && editable && <DownloadButton pluginId={id} test />}
    </div>
  );
}
