import type { ReactNode } from "react";

export function LegalPage({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <main className="container-page py-10 sm:py-14 md:py-20">
      <article className="mx-auto max-w-3xl">
        <header className="border-b pb-8">
          <p className="text-sm font-medium text-primary">{eyebrow}</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-4 text-base leading-7 text-muted-foreground">{intro}</p>
          <p className="mt-4 text-sm text-muted-foreground">Last updated: September 10, 2026</p>
        </header>
        <div className="legal-content mt-9 space-y-9">{children}</div>
      </article>
    </main>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-7 text-muted-foreground">{children}</div>
    </section>
  );
}
