'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { getMonthData, Rhyme, getAvailableMonths, getCurrentMonthId, MonthInfo } from '@/lib/data';
import MonthSelector from '@/components/MonthSelector';

function RhymesContent() {
  const searchParams = useSearchParams();
  const urlMonth = searchParams.get('month');

  const [selectedMonthId, setSelectedMonthId] = useState<string>('');
  const [rhymes, setRhymes] = useState<Rhyme[]>([]);
  const [shloka, setShloka] = useState<{
    sanskrit: string;
    transliteration: string;
    meaning: string;
  } | null>(null);
  const [story, setStory] = useState<{ title: string; content?: string; moral: string; image?: string } | null>(null);
  const [monthInfo, setMonthInfo] = useState<{ month: string; year: number } | null>(null);
  const [availableMonths, setAvailableMonths] = useState<MonthInfo[]>([]);

  // Initialize months
  useEffect(() => {
    const months = getAvailableMonths();
    setAvailableMonths(months);
    const defaultMonth = urlMonth || getCurrentMonthId();
    setSelectedMonthId(defaultMonth);
  }, []);

  // Handle URL month parameter changes
  useEffect(() => {
    if (urlMonth && availableMonths.length > 0) {
      setSelectedMonthId(urlMonth);
    }
  }, [urlMonth, availableMonths]);

  // Update data when month changes
  useEffect(() => {
    if (!selectedMonthId) return;

    const data = getMonthData(selectedMonthId);
    setRhymes(data.rhymes ?? []);
    setShloka(data.shloka ?? null);
    setStory(data.story ?? null);
    setMonthInfo({ month: data.month, year: data.year });
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
        <div className="flex items-center justify-between mb-4">
          <MonthSelector
            months={availableMonths}
            selectedMonthId={selectedMonthId}
            onMonthChange={setSelectedMonthId}
          />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">Rhymes & Shloka</h1>
        <p className="text-sm text-gray-500 mb-4">Practice these at home with your child</p>

        {/* Quick Navigation / Table of Contents */}
        <div className="flex flex-wrap gap-2">
          {shloka && (
            <button
              onClick={() => document.getElementById('shloka-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-semibold hover:bg-amber-100 transition-colors"
            >
              <span>🙏</span> Shloka
            </button>
          )}
          {rhymes.length > 0 && (
            <button
              onClick={() => document.getElementById('rhymes-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs font-semibold hover:bg-blue-100 transition-colors"
            >
              <span>🎵</span> Rhymes
            </button>
          )}
          {story && (
            <button
              onClick={() => document.getElementById('story-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full text-xs font-semibold hover:bg-indigo-100 transition-colors"
            >
              <span>📖</span> Story
            </button>
          )}
        </div>
      </div>

      {/* Newsletter pending banner */}
      {!shloka && rhymes.length === 0 && !story && (
        <div className="mb-6 flex items-center gap-4 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-200 p-5">
          <span className="text-4xl">📬</span>
          <div>
            <p className="font-bold text-amber-800">Newsletter on its way!</p>
            <p className="text-sm text-amber-700 mt-0.5">
              Rhymes, shloka and story for {monthInfo?.month} will appear here once the newsletter arrives from school.
            </p>
          </div>
        </div>
      )}

      {/* Shloka */}
      {shloka && (
        <div id="shloka-section" className="mb-8 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200 p-6 scroll-mt-20">
          <h2 className="text-lg font-semibold text-amber-800 mb-4 flex items-center gap-2">
            <span>🙏</span> Shloka of the Month
          </h2>
          <div className="space-y-3">
            <p className="text-lg font-medium text-amber-900 leading-relaxed whitespace-pre-wrap">
              {shloka.sanskrit}
            </p>
            {shloka.transliteration && shloka.transliteration !== shloka.sanskrit && (
              <p className="text-amber-700 italic whitespace-pre-wrap">
                {shloka.transliteration}
              </p>
            )}
            <div className="pt-2 border-t border-amber-200">
              <p className="text-sm font-medium text-amber-800">Meaning:</p>
              <p className="text-amber-700">{shloka.meaning}</p>
            </div>
          </div>
        </div>
      )}

      {/* Rhymes */}
      <div id="rhymes-section" className="mb-8 scroll-mt-20">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <span>🎵</span> Rhymes for the Month
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rhymes.map((rhyme, index) => (
            <div
              key={index}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-blue-50 to-transparent rounded-bl-full -mr-8 -mt-8 opacity-50 group-hover:opacity-100 transition-opacity"></div>

              <h3 className="font-bold text-gray-800 mb-3 pb-2 border-b border-gray-50 flex items-center justify-between">
                <span>{rhyme.title}</span>
                <span className="text-xs font-normal text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">#{index + 1}</span>
              </h3>

              <div className="text-gray-600 whitespace-pre-wrap font-sans text-sm leading-7 tracking-wide pl-1">
                {rhyme.content}
              </div>
            </div>
          ))}
        </div>
      </div>



      {/* Story */}
      {story && (
        <div id="story-section" className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-200 p-6 scroll-mt-20">
          <h2 className="text-lg font-semibold text-indigo-800 mb-3 flex items-center gap-2">
            <span>📖</span> Story of the Month
          </h2>
          <p className="text-xl font-medium text-indigo-900 mb-4">{story.title}</p>

          {story.image && (
            <div className="mb-6 rounded-lg overflow-hidden shadow-md">
              <img
                src={story.image}
                alt={story.title}
                className="w-full h-auto object-cover"
              />
            </div>
          )}

          {story.content && (
            <div className="text-indigo-900/80 whitespace-pre-line font-sans text-sm leading-7 mb-4 pl-1">
              {story.content}
            </div>
          )}
          <div className="bg-white/50 rounded-lg p-3 mt-3">
            <p className="text-sm font-medium text-indigo-700">Moral:</p>
            <p className="text-indigo-800">{story.moral}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RhymesPage() {
  return (
    <Suspense fallback={
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    }>
      <RhymesContent />
    </Suspense>
  );
}
