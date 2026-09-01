import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchCategories } from "@/services/catalog";
import { t } from "@/lib/i18n";

export function CategoryGrid() {
  const { data, isLoading } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const categories = (data ?? []).slice(0, 12);

  return (
    <section className="container-page py-14">
      <h2 className="text-xl font-semibold md:text-2xl">{t("section.featuredCategories")}</h2>
      <div className="mt-6 flex flex-wrap gap-2">
        {isLoading
          ? Array.from({ length: 10 }).map((_, index) => <Skeleton key={index} className="h-9 w-28 rounded-full" />)
          : categories.map((category) => (
              <Link
                key={category.id}
                to="/category/$slug"
                params={{ slug: category.slug }}
                className="rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
              >
                {category.name}
              </Link>
            ))}
      </div>
    </section>
  );
}
