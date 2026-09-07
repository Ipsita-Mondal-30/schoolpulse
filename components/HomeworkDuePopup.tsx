'use client';

import { useState, useEffect } from 'react';
import { useUpdates } from '@/context/UpdatesContext';
import { getToday } from '@/lib/data';
import Link from 'next/link';

export default function HomeworkDuePopup() {
    const { updates } = useUpdates();
    const [showPopup, setShowPopup] = useState(false);
    const [dueHomeworks, setDueHomeworks] = useState<typeof updates>([]);

    useEffect(() => {
        // 1. Check time: Only show before 9:00 AM
        const now = new Date();
        const hour = now.getHours();
        if (hour >= 9) return;

        // 2. Filter homework due TODAY
        const todayStr = getToday(); // "YYYY-MM-DD" in local time

        const dueToday = updates.filter(u => {
            const isHomework = u.category?.toLowerCase().includes('homework') || u.type === 'homework';
            if (!isHomework) return false;

            // Check if expiresAt matches today
            // Note: expiresAt from google sheet is usually 'YYYY-MM-DD'
            // We need to be careful with formatting match
            return u.expiresAt === todayStr;
        });

        if (dueToday.length > 0) {
            setDueHomeworks(dueToday);

            // 3. Check session storage to not annoy user on every refresh
            const hasSeen = sessionStorage.getItem(`seen_homework_popup_${todayStr}`);
            if (!hasSeen) {
                setShowPopup(true);
            }
        }
    }, [updates]);

    const handleDismiss = () => {
        setShowPopup(false);
        const todayStr = getToday();
        sessionStorage.setItem(`seen_homework_popup_${todayStr}`, 'true');
    };

    if (!showPopup) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="bg-orange-500 px-6 py-4 flex items-center gap-3">
                    <div className="bg-white/20 p-2 rounded-full">
                        <span className="text-2xl">🎒</span>
                    </div>
                    <div>
                        <h3 className="text-white font-bold text-lg leading-tight">Pack Your Bags!</h3>
                        <p className="text-orange-100 text-xs font-medium">Homework Due Today</p>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6">
                    <p className="text-gray-600 text-sm mb-4">
                        Please ensure the completed notebooks for the following subjects are packed:
                    </p>

                    <div className="space-y-3 mb-6">
                        {dueHomeworks.map((hw) => (
                            <div key={hw.id} className="flex items-start gap-3 bg-orange-50 p-3 rounded-lg border border-orange-100">
                                <div className="mt-0.5 text-orange-500">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <div>
                                    <h4 className="font-bold text-gray-800 text-sm">
                                        {(hw.title || 'Homework').replace(/^home\s*work\s*-\s*/i, '').trim()}
                                    </h4>
                                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{hw.message}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                        <button
                            onClick={handleDismiss}
                            className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors text-sm"
                        >
                            Later
                        </button>
                        <Link
                            href="/homework"
                            onClick={handleDismiss}
                            className="flex-1 px-4 py-2.5 bg-orange-500 text-white font-bold rounded-xl hover:bg-orange-600 transition-colors text-sm text-center shadow-md shadow-orange-200"
                        >
                            View Details
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
