export function DataDelayedNote({ show }: { show: boolean | undefined }) {
  if (!show) return null;
  return (
    <p className="mb-4 rounded-2xl bg-amber-50 px-4 py-2 text-sm text-amber-800">
      School updates may be delayed. Please check the school app for the very latest.
    </p>
  );
}
