import Link from 'next/link';

export const metadata = {
  title: 'Taking a short break — SchoolPulse',
  description: 'SchoolPulse is temporarily unavailable. Info and Events are still available.',
};

export default function MaintenancePage() {
  return (
    <div className="max-w-lg mx-auto px-6 py-16 sm:py-24 text-center">
      <div className="text-6xl mb-6">💤</div>

      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
        SchoolPulse is taking a short break
      </h1>

      <p className="mt-4 text-gray-600 leading-relaxed">
        We&apos;re doing a bit of housekeeping and this app is temporarily
        unavailable. Thanks for your patience — we&apos;ll be back soon! 🙏
      </p>

      <p className="mt-4 text-sm text-gray-500">
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

      <div className="mt-10 text-[11px] text-gray-400 uppercase tracking-wider font-semibold">
        SchoolPulse · BGS National Public School
      </div>
    </div>
  );
}
