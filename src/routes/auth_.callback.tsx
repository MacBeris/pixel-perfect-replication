import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import type { EmailOtpType } from "@supabase/supabase-js";
import { AlertCircle, CheckCircle2, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/layout/wordmark";
import { supabase } from "@/integrations/supabase/client";
import { safeDashboardReturn } from "@/features/dashboard/data";

type Search = {
  next: string;
  code: string | undefined;
  token_hash: string | undefined;
  type: string | undefined;
  error_description: string | undefined;
};
export const Route = createFileRoute("/auth_/callback")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): Search => ({
    next: safeDashboardReturn(search["next"]),
    code: typeof search["code"] === "string" ? search["code"] : undefined,
    token_hash: typeof search["token_hash"] === "string" ? search["token_hash"] : undefined,
    type: typeof search["type"] === "string" ? search["type"] : undefined,
    error_description:
      typeof search["error_description"] === "string" ? search["error_description"] : undefined,
  }),
  head: () => ({ meta: [{ title: "Confirming your account — Extendly" }] }),
  component: AuthCallback,
});

function AuthCallback() {
  const search = Route.useSearch();
  const [state, setState] = useState<"working" | "success" | "error">("working");
  const [detail, setDetail] = useState("");
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const hash = new URLSearchParams(window.location.hash.slice(1));
        const suppliedError = search.error_description || hash.get("error_description");
        if (suppliedError) throw new Error(suppliedError);
        if (search.code) {
          const { error } = await supabase.auth.exchangeCodeForSession(search.code);
          if (error) throw error;
        } else if (search.token_hash && search.type) {
          const allowed = [
            "signup",
            "invite",
            "magiclink",
            "recovery",
            "email_change",
            "email",
          ] as const;
          if (!allowed.includes(search.type as (typeof allowed)[number]))
            throw new Error("This confirmation link is not valid.");
          const { error } = await supabase.auth.verifyOtp({
            token_hash: search.token_hash,
            type: search.type as EmailOtpType,
          });
          if (error) throw error;
        }
        const { data, error } = await supabase.auth.getSession();
        if (error || !data.session)
          throw new Error("This confirmation link is invalid or has expired.");
        if (active) setState("success");
      } catch (error) {
        if (!active) return;
        setDetail(
          error instanceof Error && /expired/i.test(error.message)
            ? "This link has expired. Return to sign in and request a new confirmation email."
            : "We could not confirm this link. It may have expired or already been used.",
        );
        setState("error");
      }
    })();
    return () => {
      active = false;
    };
  }, [search.code, search.error_description, search.token_hash, search.type]);

  return (
    <main className="container-page flex min-h-[75vh] items-center justify-center py-16">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-card">
        <div className="flex justify-center">
          <Wordmark />
        </div>
        {state === "working" ? (
          <>
            <LoaderCircle className="mx-auto mt-8 size-9 animate-spin text-primary" />
            <h1 className="mt-5 text-2xl font-semibold">Confirming your account</h1>
            <p className="mt-2 text-sm text-muted-foreground">Keep this page open for a moment.</p>
          </>
        ) : state === "success" ? (
          <>
            <CheckCircle2 className="mx-auto mt-8 size-11 text-primary" />
            <h1 className="mt-5 text-2xl font-semibold">You’re signed in</h1>
            <p role="status" className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Your email has been confirmed and your Extendly account is ready.
            </p>
            <Button className="mt-7 w-full" onClick={() => window.location.assign(search.next)}>
              Return to Extendly
            </Button>
          </>
        ) : (
          <>
            <AlertCircle className="mx-auto mt-8 size-11 text-destructive" />
            <h1 className="mt-5 text-2xl font-semibold">Confirmation failed</h1>
            <p role="alert" className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {detail}
            </p>
            <Button
              className="mt-7 w-full"
              variant="outline"
              onClick={() => window.location.assign("/auth")}
            >
              Return to sign in
            </Button>
          </>
        )}
      </div>
    </main>
  );
}
