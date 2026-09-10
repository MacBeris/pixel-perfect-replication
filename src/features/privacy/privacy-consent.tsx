import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { openPrivacySettingsEvent, setAnalyticsConsent, useAnalyticsConsent } from "./consent";

export function PrivacyConsentManager() {
  const consent = useAnalyticsConsent();
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const open = () => setSettingsOpen(true);
    window.addEventListener(openPrivacySettingsEvent, open);
    return () => window.removeEventListener(openPrivacySettingsEvent, open);
  }, []);

  function choose(value: "accepted" | "rejected") {
    setAnalyticsConsent(value);
    setSettingsOpen(false);
  }

  return (
    <>
      {consent === null && (
        <section
          aria-label="Analytics privacy choice"
          className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-3xl rounded-2xl border bg-background p-5 shadow-xl sm:bottom-5 sm:p-6"
        >
          <h2 className="text-lg font-semibold">Your privacy choices</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            ExtendShare uses essential browser storage for sign-in and preferences. With your
            permission, we also use Google Analytics and privacy-preserving ExtendShare analytics to
            understand how public pages are used. Rejecting optional analytics does not affect
            sign-in or core features. Read our{" "}
            <Link to="/privacy" className="text-primary underline underline-offset-4">
              Privacy Policy
            </Link>
            .
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Button variant="outline" className="h-11" onClick={() => choose("rejected")}>
              Reject optional
            </Button>
            <Button className="h-11" onClick={() => choose("accepted")}>
              Accept analytics
            </Button>
          </div>
        </section>
      )}

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogTitle>Privacy settings</DialogTitle>
          <DialogDescription>
            Essential storage remains active because it supports authentication, security and your
            saved interface preferences. Optional analytics can be changed at any time.
          </DialogDescription>
          <p className="text-sm text-muted-foreground">
            Current optional analytics choice:{" "}
            <strong className="text-foreground">{consent ?? "Not selected"}</strong>
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="outline" className="h-11" onClick={() => choose("rejected")}>
              Reject optional
            </Button>
            <Button className="h-11" onClick={() => choose("accepted")}>
              Accept analytics
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
