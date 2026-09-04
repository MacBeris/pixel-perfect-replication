import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { message } from "./data";

export function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}
export function Busy() {
  return (
    <div className="flex items-center gap-3 p-8 text-muted-foreground" role="status">
      <Loader2 className="size-5 animate-spin" />
      Loading your dashboard…
    </div>
  );
}
export function Failure({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-destructive/30 bg-card p-5">
      <p>{message(error)}</p>
      <Button variant="outline" className="mt-3" onClick={retry}>
        Try again
      </Button>
    </div>
  );
}
export function Metrics({ items }: { items: { label: string; value: string | number }[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground">{item.label}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">
            {typeof item.value === "number" ? item.value.toLocaleString("en-US") : item.value}
          </p>
        </div>
      ))}
    </div>
  );
}
export const fieldClass = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
