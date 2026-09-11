export function EmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--sp-border)] bg-white/60 px-5 py-8 text-center">
      <p className="text-base font-semibold text-[var(--sp-ink)]">{title}</p>
      {description ? (
        <p className="text-sm text-[var(--sp-muted)] mt-1.5 leading-relaxed">{description}</p>
      ) : null}
    </div>
  );
}
