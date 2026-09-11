'use client';

export function FilterTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: T; label: string; count?: number }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div
      className="inline-flex max-w-full gap-0.5 overflow-x-auto rounded-xl border border-[var(--sp-border)] bg-white p-1 scrollbar-none"
      role="tablist"
    >
      {tabs.map((tab) => {
        const active = tab.id === value;
        const showCount = typeof tab.count === 'number' && tab.id !== 'all';
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors sp-focus sm:text-sm ${
              active
                ? 'bg-[var(--sp-primary)] text-white shadow-sm'
                : 'bg-transparent text-[var(--sp-muted)] hover:bg-[var(--sp-bg)] hover:text-[var(--sp-ink)]'
            }`}
          >
            {tab.label}
            {showCount ? (
              <span
                className={`inline-flex min-w-[1.15rem] items-center justify-center rounded-md px-1 text-[10px] font-bold tabular-nums ${
                  active
                    ? 'bg-white/20 text-white'
                    : 'bg-[var(--sp-bg)] text-[var(--sp-subtle)]'
                }`}
              >
                {tab.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
