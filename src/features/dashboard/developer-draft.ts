// Account-scoped drafts survive dashboard navigation. Files stay in memory only.
const drafts = new Map<string, Record<string, string>>();
const avatars = new Map<string, File>();
const key = (userId: string) => `extendly:developer-profile:${userId}`;
export function readDeveloperDraft(userId: string): Record<string, string> {
  if (typeof window === "undefined") return {};
  if (drafts.has(userId)) return drafts.get(userId)!;
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key(userId)) ?? "{}");
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const fields = Object.fromEntries(
        Object.entries(value).filter(([, v]) => typeof v === "string"),
      ) as Record<string, string>;
      drafts.set(userId, fields);
      return fields;
    }
  } catch {
    /* Storage can be blocked; in-memory drafts still work. */
  }
  return {};
}
export function saveDeveloperDraft(userId: string, value: Record<string, string>) {
  drafts.set(userId, value);
  try {
    localStorage.setItem(key(userId), JSON.stringify(value));
  } catch {
    /* Retain in memory. */
  }
}
export function clearDeveloperDraft(userId: string) {
  drafts.delete(userId);
  avatars.delete(userId);
  try {
    localStorage.removeItem(key(userId));
  } catch {
    /* Storage may be unavailable. */
  }
}
export function developerDraftAvatar(userId: string) {
  return avatars.get(userId) ?? null;
}
export function saveDeveloperDraftAvatar(userId: string, file: File | null) {
  if (file) avatars.set(userId, file);
  else avatars.delete(userId);
}
