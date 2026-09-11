const TONE = {
  default: 'bg-[var(--sp-bg)] text-[var(--sp-muted)] border-[var(--sp-border)]',
  success: 'bg-[var(--sp-success-soft)] text-[var(--sp-success)] border-emerald-100',
  warn: 'bg-[var(--sp-warn-soft)] text-[var(--sp-warn)] border-amber-100',
  error: 'bg-[var(--sp-error-soft)] text-[var(--sp-error)] border-red-100',
  primary: 'bg-[var(--sp-primary-soft)] text-[var(--sp-primary)] border-orange-100',
} as const;

export function StatusBadge({
  children,
  tone = 'default',
}: {
  children: React.ReactNode;
  tone?: keyof typeof TONE;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-semibold ${TONE[tone]}`}
    >
      {children}
    </span>
  );
}
