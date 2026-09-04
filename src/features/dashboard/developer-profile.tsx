import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type DeveloperProfile, message } from "./data";
import { Busy, Failure, Panel, fieldClass } from "./ui";

import {
  readDeveloperDraft,
  saveDeveloperDraft,
  clearDeveloperDraft,
  developerDraftAvatar,
  saveDeveloperDraftAvatar,
} from "./developer-draft";

const url = z
  .string()
  .trim()
  .max(2048)
  .refine((v) => !v || (URL.canParse(v) && new URL(v).protocol === "https:"), "Use an HTTPS URL");
const profileSchema = z.object({
  name: z.string().trim().min(2).max(100),
  slug: z
    .string()
    .min(3)
    .max(80)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  account_type: z.enum(["individual", "company", "organization"]),
  description: z.string().max(3000),
  website_url: url,
  github_url: url,
  twitter_url: url,
  avatar_url: url,
  is_public: z.boolean(),
  evidence_links: z.array(url.refine((v) => v.length > 0)).max(10),
});
export function DeveloperProfileForm({
  userId,
  profile,
  onSaved,
  onCancel,
}: {
  userId: string;
  profile?: DeveloperProfile;
  onSaved: (id: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    profile ? {} : readDeveloperDraft(userId),
  );
  const evidence = useQuery({
    queryKey: ["account", userId, "evidence", profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("developer_profile_evidence")
        .select("links")
        .eq("developer_id", profile!.id)
        .maybeSingle();
      if (error) throw error;
      return data?.links ?? [];
    },
  });
  const [busy, setBusy] = useState(false);
  const [avatar, setAvatar] = useState(profile?.avatar_url ?? "");
  const [file, setFile] = useState<File | null>(() =>
    profile ? null : developerDraftAvatar(userId),
  );
  const [error, setError] = useState<string | null>(null);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    let uploaded: string | undefined;
    try {
      const values = profileSchema.parse({
        name: form.get("name"),
        slug: form.get("slug"),
        account_type: form.get("account_type"),
        description: form.get("description"),
        website_url: form.get("website_url"),
        github_url: form.get("github_url"),
        twitter_url: form.get("twitter_url"),
        avatar_url: avatar,
        is_public: form.get("is_public") === "on",
        evidence_links: String(form.get("evidence") ?? "")
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
      });
      if (file) {
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 2097152)
          throw new Error("Choose a JPEG, PNG or WebP image up to 2 MB.");
        const bitmap = await createImageBitmap(file);
        bitmap.close();
        const ext = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp";
        uploaded = `${userId}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(uploaded, file, { contentType: file.type, upsert: false });
        if (uploadError) throw uploadError;
        values.avatar_url = supabase.storage.from("avatars").getPublicUrl(uploaded).data.publicUrl;
      }
      const { data, error: saveError } = await supabase.rpc("save_developer_profile", {
        _input: values,
        ...(profile ? { _profile_id: profile.id } : {}),
      });
      if (saveError)
        throw new Error(
          saveError.code === "23505"
            ? "This slug is already in use. Choose another."
            : saveError.message,
        );
      setAvatar(values.avatar_url);
      clearDeveloperDraft(userId);
      toast.success(profile ? "Developer profile saved" : "Your developer profile is ready");
      onSaved(data);
    } catch (e) {
      if (uploaded) await supabase.storage.from("avatars").remove([uploaded]);
      setError(
        e instanceof z.ZodError
          ? e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
          : message(e),
      );
    } finally {
      setBusy(false);
    }
  }
  if (profile && evidence.isPending) return <Busy />;
  if (evidence.error)
    return <Failure error={evidence.error} retry={() => void evidence.refetch()} />;
  return (
    <Panel
      title={profile ? "Edit developer profile" : "Become a Developer"}
      description="One account. A public identity for the extensions you create."
    >
      <form
        onSubmit={save}
        onInput={(event) => {
          if (!profile) {
            const el = event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
            if (el.name && el.type !== "file") {
              const next = {
                ...draft,
                [el.name]:
                  el.type === "checkbox" ? String((el as HTMLInputElement).checked) : el.value,
              };
              setDraft(next);
              saveDeveloperDraft(userId, next);
            }
          }
        }}
        className="space-y-5"
      >
        <fieldset disabled={busy} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm">
              Developer name
              <Input
                name="name"
                required
                minLength={2}
                maxLength={100}
                defaultValue={profile?.name ?? draft["name"]}
              />
            </label>
            <label className="space-y-2 text-sm">
              Account type
              <select
                name="account_type"
                className={fieldClass}
                defaultValue={profile?.account_type ?? draft["account_type"] ?? "individual"}
              >
                <option value="individual">Individual</option>
                <option value="company">Company</option>
                <option value="organization">Organization</option>
              </select>
            </label>
          </div>
          <label className="block space-y-2 text-sm">
            Profile slug
            <Input
              name="slug"
              required
              minLength={3}
              maxLength={80}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              placeholder="your-studio"
              defaultValue={profile?.slug ?? draft["slug"]}
            />
            <span className="text-xs text-muted-foreground">
              Your public address: /developers/your-studio
            </span>
          </label>
          <label className="block space-y-2 text-sm">
            Description
            <textarea
              aria-label="Description"
              name="description"
              rows={4}
              maxLength={3000}
              className={fieldClass}
              defaultValue={profile?.description ?? draft["description"] ?? ""}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-3">
            {(["website_url", "github_url", "twitter_url"] as const).map((key, i) => (
              <label key={key} className="space-y-2 text-sm">
                {["Website", "GitHub", "X / Twitter"][i]}
                <Input
                  name={key}
                  type="url"
                  placeholder="https://"
                  defaultValue={profile?.[key] ?? draft[key] ?? ""}
                />
              </label>
            ))}
          </div>
          <label className="block space-y-2 text-sm">
            Avatar{" "}
            {avatar && (
              <img
                src={avatar}
                className="size-16 rounded-xl object-cover"
                alt="Developer avatar"
              />
            )}
            <Input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                const selected = e.target.files?.[0] ?? null;
                setFile(selected);
                if (!profile) saveDeveloperDraftAvatar(userId, selected);
              }}
            />
            <span className="text-xs text-muted-foreground">
              {file ? `${file.name} selected. ` : ""}JPEG, PNG or WebP, up to 2 MB.
            </span>
          </label>
          <label className="block space-y-2 text-sm">
            Optional evidence of your work
            <textarea
              name="evidence"
              className={fieldClass}
              rows={3}
              defaultValue={evidence.data?.join("\n") ?? draft["evidence"] ?? ""}
              placeholder="https://example.com/my-work"
            />
            <span className="text-xs text-muted-foreground">
              One HTTPS link per line, up to 10. Visible only to you and administrators. These links
              do not grant a verification badge.
            </span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              name="is_public"
              type="checkbox"
              defaultChecked={profile?.is_public ?? draft["is_public"] !== "false"}
            />
            Show my developer profile publicly
          </label>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex gap-3">
            <Button type="submit">
              {busy ? "Saving…" : profile ? "Save profile" : "Activate developer profile"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                clearDeveloperDraft(userId);
                onCancel();
              }}
            >
              Cancel
            </Button>
          </div>
        </fieldset>
      </form>
    </Panel>
  );
}
