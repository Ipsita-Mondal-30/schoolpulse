import { dataFreshnessMessage, type DataFreshness } from '@/lib/data-freshness';

export function DataFreshnessBanner({ freshness }: { freshness: DataFreshness | undefined }) {
  const message = dataFreshnessMessage(freshness);
  if (!message) return null;
  return (
    <div role="status" className="mb-4 rounded-2xl bg-amber-50 px-4 py-3 text-amber-900">
      <p className="text-sm font-semibold">{message.title}</p>
      <p className="mt-0.5 text-sm text-amber-800">{message.description}</p>
    </div>
  );
}
