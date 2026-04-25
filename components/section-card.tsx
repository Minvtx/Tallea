import type { ReactNode } from "react";

export function SectionCard({
  eyebrow,
  title,
  children,
  className = "",
}: {
  eyebrow?: string;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`bg-foreground/[0.012] border hairline rounded-md p-6 transition-colors hover:border-foreground/15 ${className}`}
    >
      {eyebrow ? <div className="eyebrow mb-3">{eyebrow}</div> : null}
      {title ? (
        <h3 className="font-display text-xl tracking-[-0.012em] mb-4">{title}</h3>
      ) : null}
      {children}
    </section>
  );
}

export function FieldRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 border-b last:border-0 hairline">
      <span className="eyebrow text-[10px]">{label}</span>
      <span className="text-[13px] text-foreground/85 text-right">{children}</span>
    </div>
  );
}
