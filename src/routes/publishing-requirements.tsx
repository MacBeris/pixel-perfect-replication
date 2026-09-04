import { createFileRoute, Link } from "@tanstack/react-router";
import { Panel } from "@/features/dashboard/ui";
import { Button } from "@/components/ui/button";
export const Route = createFileRoute("/publishing-requirements")({
  head: () => ({ meta: [{ title: "Publishing requirements — Extendly" }] }),
  component: () => (
    <div className="container-page max-w-3xl py-12">
      <Panel
        title="Prepare your first plugin"
        description="Publishing is coming soon. You can prepare your developer profile today."
      >
        <ul className="space-y-4 text-sm leading-relaxed text-muted-foreground">
          <li>
            Publish only extensions you own or have permission to distribute. Keep evidence of
            authorship and licensing available.
          </li>
          <li>
            Describe the supported platform, compatibility, requirements and what your extension
            does.
          </li>
          <li>Prepare a recognizable logo, screenshots and clear installation instructions.</li>
          <li>Provide version numbers, release notes and accurate licensing information.</li>
          <li>
            Keep downloads free of malicious code and disclose external services or data collection.
          </li>
          <li>
            New plugin submissions will require moderation before appearing in the public catalog.
            Payments and file uploads are not available yet.
          </li>
        </ul>
        <Button asChild className="mt-6">
          <Link to="/dashboard" search={{ tab: "developer" }}>
            Go to Developer
          </Link>
        </Button>
      </Panel>
    </div>
  ),
});
