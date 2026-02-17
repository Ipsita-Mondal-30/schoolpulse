'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useUpdates } from '@/context/UpdatesContext';

function NOFContent() {
    const { updates } = useUpdates();

    // Filter updates related to NOF/Olympiad, but exclude the self-referential promo (ID 8000)
    const nofUpdates = updates.filter(u =>
        (u.title?.toUpperCase().includes('NOF') ||
            u.title?.toUpperCase().includes('OLYMPIAD') ||
            u.message?.toUpperCase().includes('NOF') ||
            u.category?.toUpperCase().includes('NOF')) &&
        u.id !== 8000 &&
        !u.title?.toUpperCase().includes('CORNER') && // Exclude redundant "Corner" announcements
        u.link !== '/nof' // Exclude self-links
    );

    const schedule = [
        { class: "Nursery to 2", subject: "Phonics", day: "Monday", date: "09-Feb-26" },
        { class: "1 to 5", subject: "Cyber", day: "Monday", date: "09-Feb-26" },
        { class: "1 to 10", subject: "Critical Thinking", day: "Tuesday", date: "10-Feb-26" },
        { class: "Nursery to 10", subject: "Hindi", day: "Tuesday", date: "10-Feb-26" },
        { class: "5 to 10", subject: "French", day: "Wednesday", date: "11-Feb-26" },
        { class: "1 to 10", subject: "GK", day: "Thursday", date: "12-Feb-26" },
        { class: "Nursery to 10", subject: "English", day: "Friday", date: "13-Feb-26" },
        { class: "Nursery to 10", subject: "Science", day: "Saturday", date: "14-Feb-26" },
        { class: "Nursery to 10", subject: "Math", day: "Sunday", date: "15-Feb-26" }
    ];

    return (
        <div className="max-w-4xl mx-auto px-4 py-8 pb-24">
            {/* Header */}
            <div className="text-center mb-10">
                <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 mb-3">
                    Olympiad Exam Schedule
                </h1>
                <p className="text-gray-500 font-medium text-lg italic">
                    (Completed - Dates Done)
                </p>
            </div>

            {/* Important Updates Section */}
            {nofUpdates.length > 0 && (
                <div className="mb-10">
                    <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <span className="text-2xl">📢</span> Latest Announcements
                    </h2>
                    <div className="grid gap-4">
                        {nofUpdates.map((update) => (
                            <div key={update.id} className="bg-white rounded-xl p-5 border border-blue-100 shadow-sm hover:shadow-md transition-all relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-20 h-20 bg-blue-50 rounded-full -mr-10 -mt-10 opacity-50 blur-xl"></div>
                                <div className="relative">
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-bold text-gray-800 text-lg">{update.title}</h3>
                                        {update.createdAt && <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-full">{update.createdAt}</span>}
                                    </div>
                                    <p className="text-gray-600 mb-3 leading-relaxed">{update.message}</p>
                                    {update.link && (
                                        update.link.startsWith('/') ? (
                                            <Link
                                                href={update.link}
                                                className="inline-flex items-center gap-2 text-blue-600 font-semibold text-sm hover:underline bg-blue-50 px-3 py-1.5 rounded-lg transition-colors"
                                            >
                                                {update.linkText || "View Details"} ↗
                                            </Link>
                                        ) : (
                                            <a
                                                href={update.link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-2 text-blue-600 font-semibold text-sm hover:underline bg-blue-50 px-3 py-1.5 rounded-lg transition-colors"
                                            >
                                                {update.linkText || "View Details"} ↗
                                            </a>
                                        )
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Schedule Section */}
            <div className="bg-white rounded-2xl shadow-xl shadow-blue-50 overflow-hidden border border-blue-100">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-4 py-5 text-white relative overflow-hidden text-center">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
                    <h2 className="text-xl sm:text-2xl font-bold relative z-10">🏆 Exam Schedule</h2>
                    <p className="text-blue-100 text-xs sm:text-sm mt-1 font-medium relative z-10">09:00 AM to 08:00 PM (IST)</p>
                </div>

                <div className="divide-y divide-gray-100">
                    <div className="bg-gray-50 flex text-[10px] uppercase tracking-wider text-gray-500 font-bold py-2 px-3">
                        <div className="w-20">Date</div>
                        <div className="flex-1">Subject</div>
                        <div className="w-24 text-right">Eligible Class</div>
                    </div>

                    {schedule.map((item, idx) => (
                        <div key={idx} className="flex items-center py-3 px-3 hover:bg-blue-50/30 transition-colors gap-2">
                            {/* Date Group */}
                            <div className="w-20 flex flex-col justify-center">
                                <span className="font-bold text-gray-800 text-sm leading-none">{item.date.split('-')[0]}-{item.date.split('-')[1]}</span>
                                <span className="text-[10px] text-blue-500 font-medium mt-0.5 uppercase">{item.day.slice(0, 3)}</span>
                            </div>

                            {/* Subject */}
                            <div className="flex-1">
                                <span className="inline-block px-2 py-1 rounded-md text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                                    {item.subject}
                                </span>
                            </div>

                            {/* Class */}
                            <div className="w-24 text-right text-xs text-gray-600 font-medium leading-tight">
                                {item.class}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="mt-8 text-center">
                <Link href="/" className="inline-flex items-center gap-2 text-gray-400 hover:text-gray-600 transition-colors text-sm font-medium">
                    ← Back to Dashboard
                </Link>
            </div>
        </div>
    );
}

export default function NOFPage() {
    return (
        <Suspense fallback={<div className="p-10 text-center text-gray-400">Loading Olympiad Schedule...</div>}>
            <NOFContent />
        </Suspense>
    );
}
