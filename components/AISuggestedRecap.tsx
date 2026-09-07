'use client';

import React from 'react';
import { AISuggestedRecap as AISuggestedRecapType } from '@/lib/data';

interface AISuggestedRecapProps {
    content: AISuggestedRecapType;
}

export default function AISuggestedRecap({ content }: AISuggestedRecapProps) {
    return (
        <div className="relative overflow-hidden bg-white rounded-2xl border-2 border-purple-100 shadow-xl p-3 sm:p-4 transition-all duration-500">
            {/* Innovative Mission Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {content.activities.map((item, index) => (
                    <div
                        key={index}
                        className="group relative bg-gray-50/50 rounded-xl p-3 sm:p-4 border border-gray-100 hover:border-purple-200 hover:bg-white transition-all duration-300 hover:shadow-md overflow-hidden"
                    >
                        {/* Subject Tag */}
                        <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                            <span className="w-1 h-1 rounded-full bg-purple-400 group-hover:animate-ping" />
                            {item.subject}
                        </div>

                        {/* Action Section */}
                        <div className="mb-2">
                            <div className="text-[8px] font-bold text-blue-500 uppercase mb-0.5">Step 1: Action</div>
                            <p className="text-xs font-bold text-gray-800 leading-tight">
                                {item.action}
                            </p>
                        </div>

                        {/* Question Section */}
                        {item.question && (
                            <div className="mb-2 pl-3 border-l-2 border-purple-100 group-hover:border-purple-300 transition-colors">
                                <div className="text-[8px] font-bold text-purple-400 uppercase mb-0.5">Step 2: Ask</div>
                                <p className="text-xs text-gray-600 italic leading-snug">
                                    "{item.question}"
                                </p>
                            </div>
                        )}

                        {/* Goal Badge */}
                        <div className="mt-1 flex justify-between items-end">
                            <div className="inline-flex items-center gap-1 bg-green-50 px-2 py-0.5 rounded-md border border-green-100">
                                <span className="text-[8px] font-black text-green-700 uppercase tracking-tighter">
                                    {item.goal}
                                </span>
                            </div>
                            {/* Subtle decorative number */}
                            <div className="text-3xl font-black text-gray-100 group-hover:text-purple-50/30 transition-colors pointer-events-none select-none -mb-1">
                                0{index + 1}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Premium Parent Tip Footer */}
            <div className="mt-4 border-t border-gray-100 pt-3">
                <div className="relative group bg-gradient-to-br from-indigo-600 to-purple-700 rounded-xl p-3 shadow-lg shadow-purple-100 overflow-hidden">
                    <div className="relative flex items-center gap-3">
                        <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center text-lg backdrop-blur-sm shadow-inner">
                            ⭐
                        </div>
                        <div>
                            <h4 className="text-[10px] font-black text-white uppercase tracking-widest mb-0.5">
                                Pro Parent Tip
                            </h4>
                            <p className="text-[11px] text-purple-50 leading-tight font-medium">
                                {content.parentTip}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
