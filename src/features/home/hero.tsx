import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { t } from "@/lib/i18n";

export function Hero() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  return (
    <section className="relative overflow-hidden border-b border-border">
      <div className="absolute inset-0 grid-backdrop opacity-60" aria-hidden="true" />
      <div className="container-page relative py-20 text-center md:py-28">
        <span className="inline-flex items-center rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted-foreground">
          10 platforms · one marketplace
        </span>
        <h1 className="mx-auto mt-6 max-w-3xl text-balance-tight text-4xl font-semibold md:text-6xl">
          {t("hero.title")}
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground md:text-lg">{t("hero.subtitle")}</p>

        <form
          className="mx-auto mt-9 flex max-w-2xl flex-col gap-3 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            navigate({ to: "/plugins", search: query ? { q: query } : {} });
          }}
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("search.placeholder")}
              className="h-12 pl-11 text-base"
              aria-label={t("search.placeholder")}
            />
          </div>
          <Button type="submit" size="lg" className="h-12">
            {t("nav.explore")}
          </Button>
        </form>

        <div className="mt-6 flex items-center justify-center gap-4 text-sm">
          <Link to="/plugins" className="text-muted-foreground hover:text-foreground">
            Browse the catalog
          </Link>
          <span className="text-border-strong">/</span>
          <Link to="/auth" className="text-primary hover:underline">
            {t("nav.sell")}
          </Link>
        </div>
      </div>
    </section>
  );
}
