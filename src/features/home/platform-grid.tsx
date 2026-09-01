import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchPlatforms } from "@/services/catalog";
import { t } from "@/lib/i18n";

export function PlatformGrid() {
  const { data, isLoading } = useQuery({ queryKey: ["platforms"], queryFn: fetchPlatforms });

  return (
    <section className="container-page py-14">
      <h2 className="text-xl font-semibold md:text-2xl">{t("section.browseByPlatform")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Pick the tool you work in and see what the community built for it.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {isLoading
          ? Array.from({ length: 10 }).map((_, index) => <Skeleton key={index} className="h-20 rounded-xl" />)
          : (data ?? []).map((platform) => (
              <Link
                key={platform.id}
                to="/platform/$slug"
                params={{ slug: platform.slug }}
                className="group flex h-20 flex-col justify-center rounded-xl border border-border bg-card px-4 transition-colors hover:border-border-strong hover:bg-surface"
              >
                <span className="text-sm font-semibold text-foreground">{platform.name}</span>
                <span className="mt-1 line-clamp-1 text-xs text-muted-foreground">{platform.description}</span>
              </Link>
            ))}
      </div>
    </section>
  );
}
