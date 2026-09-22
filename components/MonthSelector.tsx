'use client';

import { MonthInfo } from '@/lib/data';

interface MonthSelectorProps {
  months: MonthInfo[];
  selectedMonthId: string;
  onMonthChange: (monthId: string) => void;
}

export default function MonthSelector({
  months,
  selectedMonthId,
  onMonthChange,
}: MonthSelectorProps) {
  if (months.length <= 1) {
    // Don't show selector if only one month available
    const month = months[0];
    return (
      <div className="text-sm text-gray-500">
        {month?.month} {month?.year}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <label className="text-sm text-gray-500">Month:</label>
      <select
        value={selectedMonthId}
        onChange={(e) => onMonthChange(e.target.value)}
        className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-1 text-sm font-medium text-orange-800 focus:outline-none focus:ring-2 focus:ring-orange-300"
      >
        {months.map((month) => (
          <option key={month.id} value={month.id}>
            {month.month} {month.year}
          </option>
        ))}
      </select>
    </div>
  );
}
