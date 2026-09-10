import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  LibraryBig,
  Heart,
  LogOut,
  Menu,
  Search,
  ShieldCheck,
  User2,
  LayoutDashboard,
  Code2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Wordmark } from "@/components/layout/wordmark";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { t } from "@/lib/i18n";

const navLinks = [{ to: "/plugins", label: t("nav.explore") }];
const mobileNavLinks = [
  { to: "/plugins", label: t("nav.explore") },
  { to: "/about", label: "About" },
  { to: "/for-developers", label: "For developers" },
] as const;

export function SiteHeader() {
  const [query, setQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user, session } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const userId = session?.user.id;

  useEffect(() => {
    let active = true;
    if (!userId) {
      setIsAdmin(false);
      return;
    }
    supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => {
        if (active) setIsAdmin(Boolean(data));
      });
    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => setMobileOpen(false), [location.pathname]);

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    navigate({ to: "/plugins", search: query ? { q: query } : {} });
    setMobileOpen(false);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="container-page flex h-16 min-w-0 items-center gap-2 sm:gap-4">
        <Wordmark />

        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <form onSubmit={submitSearch} className="ml-auto hidden max-w-sm flex-1 lg:block">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("search.placeholder")}
              className="h-9 pl-9"
              aria-label={t("search.placeholder")}
            />
          </div>
        </form>

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2 lg:ml-0">
          <Link
            to="/dashboard"
            search={{ tab: "developer" }}
            className="hidden text-sm text-muted-foreground hover:text-foreground sm:block"
          >
            {t("nav.sell")}
          </Link>
          <div className="hidden sm:block">
            <ThemeToggle />
          </div>

          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-11 sm:size-9"
                  aria-label={t("nav.account")}
                >
                  <User2 className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5 text-xs text-muted-foreground">{user?.email}</div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/dashboard" search={{ tab: "overview" }} className="gap-2">
                    <LayoutDashboard className="size-4" />
                    Dashboard
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/dashboard" search={{ tab: "developer" }} className="gap-2">
                    <Code2 className="size-4" />
                    Developer
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/dashboard" search={{ tab: "library" }} className="gap-2">
                    <LibraryBig className="size-4" /> {t("nav.library")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/dashboard" search={{ tab: "favorites" }} className="gap-2">
                    <Heart className="size-4" /> {t("nav.favorites")}
                  </Link>
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem asChild>
                    <Link to="/admin" className="gap-2">
                      <ShieldCheck className="size-4" /> Admin
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="gap-2"
                  onSelect={async () => {
                    await supabase.auth.signOut();
                  }}
                >
                  <LogOut className="size-4" /> {t("nav.signOut")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild size="sm">
              <Link to="/auth">{t("nav.signIn")}</Link>
            </Button>
          )}

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-11 md:hidden"
                aria-label="Open menu"
              >
                <Menu className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right">
              <SheetTitle className="font-display">ExtendShare</SheetTitle>
              <form onSubmit={submitSearch} className="mt-6 flex gap-2">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={t("search.placeholder")}
                    className="h-11 pl-9"
                  />
                </div>
                <Button type="submit" size="icon" className="size-11" aria-label="Search">
                  <Search className="size-4" />
                </Button>
              </form>
              <nav className="mt-6 flex flex-col gap-1">
                {mobileNavLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setMobileOpen(false)}
                    className="flex min-h-11 items-center rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                ))}
                {isAuthenticated && (
                  <Link
                    to="/dashboard"
                    search={{ tab: "overview" }}
                    onClick={() => setMobileOpen(false)}
                    className="flex min-h-11 items-center rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
                  >
                    Dashboard
                  </Link>
                )}
              </nav>
              <div className="mt-6 border-t pt-5 sm:hidden">
                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Appearance
                </p>
                <ThemeToggle />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
