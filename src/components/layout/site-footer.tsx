import { Link } from "@tanstack/react-router";
import { Wordmark } from "@/components/layout/wordmark";

const columns = [
  {
    title: "Marketplace",
    links: [
      { label: "Explore plugins", to: "/plugins" },
      { label: "Sign in", to: "/auth" },
    ],
  },
  {
    title: "Developers",
    links: [
      { label: "Developer dashboard", to: "/developer/dashboard" },
      { label: "My Library", to: "/library" },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="container-page grid gap-10 py-14 md:grid-cols-4">
        <div className="md:col-span-2">
          <Wordmark />
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            A marketplace for plugins, extensions and add-ons across the tools you build with.
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
          <span>© {new Date().getFullYear()} Extendly</span>
          <span>Built for creators of plugins, extensions and add-ons.</span>
        </div>
      </div>
    </footer>
  );
}
