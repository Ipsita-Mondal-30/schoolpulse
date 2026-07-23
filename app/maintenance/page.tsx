import Link from 'next/link';

export const metadata = {
  title: 'Taking a short break — SchoolPulse',
  description: 'SchoolPulse is temporarily unavailable. Info and Events are still available.',
};

export default function MaintenancePage() {
  return (
    <div className="max-w-lg mx-auto px-6 py-16 sm:py-24 text-center">
      <div className="text-6xl mb-6">💤</div>

      <p className="text-xl font-semibold text-gray-800">
        This app is temporarily unavailable.
      </p>

      <p className="mt-6 text-sm text-gray-500">
        In the meantime, these are still available:
      </p>

      <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          href="/info"
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-orange-500 text-white font-semibold shadow-sm hover:bg-orange-600 transition-colors"
        >
          <span className="text-lg">ℹ️</span> General Info
        </Link>
        <Link
          href="/dates"
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white text-orange-600 font-semibold border border-orange-200 shadow-sm hover:bg-orange-50 transition-colors"
        >
          <span className="text-lg">🔔</span> Events &amp; Holidays
        </Link>
      </div>
    </div>
  );
}
