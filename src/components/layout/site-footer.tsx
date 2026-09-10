import { Link } from "@tanstack/react-router";
import { Wordmark } from "@/components/layout/wordmark";
import { openPrivacySettingsEvent } from "@/features/privacy/consent";

const columns = [
  {
    title: "Marketplace",
    links: [
      { label: "Explore plugins", to: "/plugins" },
      { label: "About", to: "/about" },
    ],
  },
  {
    title: "Developers",
    links: [
      { label: "For developers", to: "/for-developers" },
      { label: "Developer dashboard", to: "/dashboard" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", to: "/privacy" },
      { label: "Terms of Service", to: "/terms" },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="container-page grid gap-8 py-10 sm:grid-cols-2 sm:py-14 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <Wordmark />
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            Discover and compare plugins, extensions and add-ons from official sources.
          </p>
        </div>
        {columns.map((column) => (
          <div key={column.title}>
            <h3 className="text-sm font-semibold text-foreground">{column.title}</h3>
            <ul className="mt-3 space-y-2">
              {column.links.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.to}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border">
        <div className="container-page flex flex-col gap-2 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} ExtendShare</span>
          <button
            type="button"
            className="w-fit underline-offset-4 hover:text-foreground hover:underline"
            onClick={() => window.dispatchEvent(new Event(openPrivacySettingsEvent))}
          >
            Privacy settings
          </button>
        </div>
      </div>
    </footer>
  );
}
