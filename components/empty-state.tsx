export function EmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="border hairline rounded-md p-12 text-center">
      <p className="font-display text-lg tracking-[-0.012em] text-foreground/85">
        {title}
      </p>
      {description ? (
        <p className="text-[13px] text-muted mt-2 max-w-md mx-auto leading-relaxed">
          {description}
        </p>
      ) : null}
    </div>
  );
}
