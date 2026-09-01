import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function Wordmark({ className }: { className?: string }) {
  return (
    <Link
      to="/"
      className={cn(
        "font-display text-lg font-semibold tracking-tight text-foreground transition-opacity hover:opacity-80",
        className,
      )}
      aria-label="Extendly home"
    >
      Extend<span className="text-primary">ly</span>
    </Link>
  );
}
