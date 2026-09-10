import { useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertCircle, CheckCircle2, Eye, EyeOff, LoaderCircle, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { Wordmark } from "@/components/layout/wordmark";
import { safeDashboardReturn } from "@/features/dashboard/data";
import { authErrorMessage, validateAuthForm } from "@/features/auth/feedback";

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { next?: string } => ({
    next: safeDashboardReturn(search["next"]),
  }),
  head: () => ({
    meta: [
      { title: "Sign in or create an account — ExtendShare" },
      {
        name: "description",
        content:
          "Sign in to ExtendShare to manage favorites, reviews, collections and your developer profile.",
      },
      { property: "og:title", content: "Sign in or create an account — ExtendShare" },
      {
        property: "og:description",
        content: "Access your ExtendShare library, favorites and developer dashboard.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { next } = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const pending = useRef(false);
  const [fields, setFields] = useState<{ username?: string; email?: string; password?: string }>(
    {},
  );
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const errorRef = useRef<HTMLDivElement>(null);
  const signup = mode === "signup";

  async function continueWithGoogle() {
    if (pending.current) return;
    pending.current = true;
    setLoading(true);
    setError("");
    try {
      const callback = new URL("/auth/callback", window.location.origin);
      callback.searchParams.set("next", safeDashboardReturn(next));
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: callback.toString() },
      });
      if (error) throw error;
    } catch (cause) {
      pending.current = false;
      setLoading(false);
      setError(authErrorMessage(cause));
      requestAnimationFrame(() => errorRef.current?.focus());
    }
  }

  function edited() {
    setError("");
    setConfirmation("");
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const normalizedEmail = email.trim();
    setEmail(normalizedEmail);
    setError("");
    setConfirmation("");
    const invalid = validateAuthForm(normalizedEmail, password, signup, username);
    setFields(invalid);
    if (invalid.username || invalid.email || invalid.password) {
      document
        .getElementById(
          invalid.username ? "auth-username" : invalid.email ? "auth-email" : "auth-password",
        )
        ?.focus();
      return;
    }
    pending.current = true;
    setLoading(true);
    try {
      if (signup) {
        const normalizedUsername = username.trim().toLowerCase();
        const { data: existing, error: usernameError } = await supabase
          .from("profiles")
          .select("id")
          .eq("username", normalizedUsername)
          .limit(1);
        if (usernameError) throw usernameError;
        if (existing.length) {
          setFields({ username: "This username is already taken. Choose another." });
          document.getElementById("auth-username")?.focus();
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeDashboardReturn(next))}`,
            data: { username: normalizedUsername, full_name: normalizedUsername },
          },
        });
        if (error) throw error;
        if (data.session) window.location.assign(safeDashboardReturn(next));
        else {
          setConfirmation(normalizedEmail);
          setPassword("");
          setUsername("");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        if (error) throw error;
        window.location.assign(safeDashboardReturn(next));
      }
    } catch (cause) {
      setError(authErrorMessage(cause));
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      pending.current = false;
      setLoading(false);
    }
  }

  return (
    <div className="container-page flex min-h-[80vh] items-center justify-center py-10 sm:py-16">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <div className="px-6 pb-6 pt-8 sm:px-8">
          <div className="flex justify-center">
            <Wordmark />
          </div>
          <h1 className="mt-6 text-center text-2xl font-semibold tracking-tight">
            {signup ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-2 text-center text-sm leading-relaxed text-muted-foreground">
            {signup
              ? "Discover extensions and build your developer profile."
              : "Sign in to your library, favorites and developer workspace."}
          </p>
          <Tabs
            className="mt-6"
            value={mode}
            onValueChange={(value) => {
              if (pending.current) return;
              setMode(value === "signup" ? "signup" : "signin");
              setFields({});
              edited();
              setShowPassword(false);
            }}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger disabled={loading} value="signin">
                Sign in
              </TabsTrigger>
              <TabsTrigger disabled={loading} value="signup">
                Create account
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button
            type="button"
            variant="outline"
            className="mt-6 h-11 w-full"
            disabled={loading}
            onClick={() => void continueWithGoogle()}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="mr-2 size-4">
              <path
                fill="#4285F4"
                d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z"
              />
              <path
                fill="#34A853"
                d="M12 22c2.7 0 4.97-.9 6.62-2.36l-3.24-2.54c-.9.6-2.05.96-3.38.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z"
              />
              <path
                fill="#FBBC05"
                d="M6.39 13.93A6.02 6.02 0 0 1 6.08 12c0-.67.11-1.32.31-1.93V7.45H3.04A10 10 0 0 0 2 12c0 1.61.39 3.14 1.04 4.55l3.35-2.62Z"
              />
              <path
                fill="#EA4335"
                d="M12 5.94c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.63 9.63 0 0 0 12 2a10 10 0 0 0-8.96 5.45l3.35 2.62C7.18 7.7 9.39 5.94 12 5.94Z"
              />
            </svg>
            Continue with Google
          </Button>
          <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            <span>or use email</span>
            <span className="h-px flex-1 bg-border" />
          </div>
          <form className="space-y-5" onSubmit={submit} noValidate aria-busy={loading}>
            {error && (
              <div
                ref={errorRef}
                tabIndex={-1}
                role="alert"
                className="flex gap-3 rounded-xl border border-destructive/25 bg-destructive/5 p-4 text-sm leading-relaxed text-destructive outline-none"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}
            {confirmation && (
              <div
                role="status"
                className="rounded-xl border border-primary/25 bg-primary/5 p-4 text-sm"
              >
                <div className="flex items-center gap-2 font-medium">
                  <CheckCircle2 className="size-4" />
                  Check your inbox
                </div>
                <p className="mt-2 break-words text-muted-foreground">
                  If confirmation is needed, we have sent a link to {confirmation}. Check spam too.
                  If you already have an account, switch to Sign in.
                </p>
              </div>
            )}
            {signup && (
              <div className="space-y-2">
                <Label htmlFor="auth-username">Username</Label>
                <Input
                  id="auth-username"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  minLength={3}
                  maxLength={30}
                  pattern="[a-z0-9][a-z0-9_-]{2,29}"
                  placeholder="your_name"
                  required
                  disabled={loading}
                  value={username}
                  aria-invalid={Boolean(fields.username)}
                  aria-describedby="username-hint"
                  onChange={(e) => {
                    setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""));
                    setFields((v) => ({ ...v, username: "" }));
                    edited();
                  }}
                />
                <p
                  id="username-hint"
                  className={
                    fields.username ? "text-sm text-destructive" : "text-xs text-muted-foreground"
                  }
                >
                  {fields.username ||
                    "3–30 characters: lowercase letters, numbers, _ or -. This public name must be unique."}
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="auth-email">Email</Label>
              <div className="relative">
                <Mail
                  className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id="auth-email"
                  className="h-11 pl-10"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="you@example.com"
                  required
                  disabled={loading}
                  value={email}
                  aria-invalid={Boolean(fields.email)}
                  aria-describedby={fields.email ? "email-error" : undefined}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setFields((v) => ({ ...v, email: "" }));
                    edited();
                  }}
                />
              </div>
              {fields.email && (
                <p id="email-error" className="text-sm text-destructive">
                  {fields.email}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="auth-password">Password</Label>
              <div className="relative">
                <Input
                  id="auth-password"
                  className="h-11 pr-12"
                  type={showPassword ? "text" : "password"}
                  autoComplete={signup ? "new-password" : "current-password"}
                  required
                  disabled={loading}
                  value={password}
                  aria-invalid={Boolean(fields.password)}
                  aria-describedby={
                    fields.password ? "password-error" : signup ? "password-hint" : undefined
                  }
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setFields((v) => ({ ...v, password: "" }));
                    edited();
                  }}
                />
                <button
                  type="button"
                  disabled={loading}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="absolute right-1 top-1 flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary focus-visible:outline focus-visible:outline-primary"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {fields.password ? (
                <p id="password-error" className="text-sm text-destructive">
                  {fields.password}
                </p>
              ) : (
                signup && (
                  <p id="password-hint" className="text-xs text-muted-foreground">
                    Use at least 8 characters. A longer, unique password is best.
                  </p>
                )
              )}
            </div>
            <Button
              type="submit"
              className="h-11 w-full"
              disabled={loading || Boolean(confirmation)}
            >
              {loading && <LoaderCircle className="mr-2 size-4 animate-spin" />}
              {loading
                ? signup
                  ? "Creating account…"
                  : "Signing in…"
                : confirmation
                  ? "Check your email"
                  : signup
                    ? "Create account"
                    : "Sign in"}
            </Button>
            {signup && (
              <p className="text-center text-xs leading-5 text-muted-foreground">
                By creating an account, you agree to the{" "}
                <Link to="/terms" className="text-foreground underline underline-offset-4">
                  Terms of Service
                </Link>{" "}
                and acknowledge the{" "}
                <Link to="/privacy" className="text-foreground underline underline-offset-4">
                  Privacy Policy
                </Link>
                .
              </p>
            )}
          </form>
        </div>
        <div className="border-t bg-secondary/20 px-6 py-5 text-center text-sm text-muted-foreground">
          <Link to="/plugins" className="transition hover:text-foreground">
            Keep browsing without an account
          </Link>
        </div>
      </div>
    </div>
  );
}
