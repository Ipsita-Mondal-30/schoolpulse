'use client';

import { useState, useEffect } from 'react';
import ImportantDates from '@/components/ImportantDates';
import MonthSelector from '@/components/MonthSelector';
import {
  getMonthData,
  getAvailableMonths,
  getCurrentMonthId,
  getImportantDates,
  getAllImportantDates,
  MonthInfo,
  ImportantDate,
} from '@/lib/data';

export default function DatesPage() {
  const [selectedMonthId, setSelectedMonthId] = useState<string>('');
  const [availableMonths, setAvailableMonths] = useState<MonthInfo[]>([]);
  const [importantDates, setImportantDates] = useState<ImportantDate[]>([]);
  const [monthInfo, setMonthInfo] = useState<{ month: string; year: string | number } | null>(null);

  useEffect(() => {
    const months = getAvailableMonths();
    // Add "All Months" to the front
    const allMonthsOption: MonthInfo = { id: 'all', month: 'All', year: 'Months' as any, file: '' };
    setAvailableMonths([allMonthsOption, ...months]);
    setSelectedMonthId('all'); // default to all
  }, []);

  useEffect(() => {
    if (!selectedMonthId) return;
    
    if (selectedMonthId === 'all') {
      setMonthInfo({ month: 'All', year: 'Months' });
      setImportantDates(getAllImportantDates());
    } else {
      const data = getMonthData(selectedMonthId);
      setMonthInfo({ month: data.month, year: data.year });
      
      const monthIndex = new Date(`${data.month} 1, ${data.year}`).getMonth() + 1;
      const prefix = `${data.year}-${String(monthIndex).padStart(2, '0')}`;
      
      const filteredDates = getAllImportantDates().filter(d => d.date.startsWith(prefix));
      setImportantDates(filteredDates);
    }
  }, [selectedMonthId]);

  if (!monthInfo) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-2 sm:px-4 py-4 sm:py-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-1">
          <MonthSelector
            months={availableMonths}
            selectedMonthId={selectedMonthId}
            onMonthChange={setSelectedMonthId}
          />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Important Dates & Events</h1>
        <p className="text-sm text-gray-500">Tentative dates from school newsletter</p>
      </div>

      {/* Important Dates */}
      {importantDates.length > 0 ? (
        <ImportantDates dates={importantDates} title="All Important Dates" showAll />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div className="text-4xl mb-4">📅</div>
          <p className="text-gray-500">No important dates listed for this month</p>
        </div>
      )}

      {/* Note */}
      <div className="mt-6 bg-amber-50 rounded-xl border border-amber-200 p-4">
        <p className="text-sm text-amber-800">
          <strong>Note:</strong> These dates are tentative and subject to change.
          Please check with the school for any updates.
        </p>
      </div>
    </div>
  );
}
