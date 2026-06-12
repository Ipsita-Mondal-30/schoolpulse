"use client";

import React, { useState, useRef, useEffect } from "react";

interface HomeworkScannerProps {
  onHomeworkScanned: (newHw: { subject: string; chapter: string; content: string; submissionDate: string }) => void;
}

export default function HomeworkScanner({ onHomeworkScanned }: HomeworkScannerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [subject, setSubject] = useState("MATHEMATICS");
  const [chapter, setChapter] = useState("");
  const [notes, setNotes] = useState("");
  const [statusText, setStatusText] = useState("");
  const [dailyUploads, setDailyUploads] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const todayKey = `hw_uploads_${new Date().toISOString().split("T")[0]}`;
      const saved = localStorage.getItem(todayKey);
      if (saved) setDailyUploads(JSON.parse(saved));
    }
  }, []);

  const saveUploadToLocal = (base64Image: string) => {
    const todayKey = `hw_uploads_${new Date().toISOString().split("T")[0]}`;
    const updated = [...dailyUploads, base64Image];
    setDailyUploads(updated);
    localStorage.setItem(todayKey, JSON.stringify(updated));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (dailyUploads.length >= 5) {
      setStatusText("⚠️ Daily limit reached! Maximum 5 photo uploads allowed per day to save space.");
      return;
    }

    const file = e.target.files?.[0];
    if (!file) return;

    setStatusText("Processing image upload...");
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      saveUploadToLocal(base64);
      setStatusText("✅ Photo uploaded successfully! Image added below.");
      
      // Auto-append placeholder item so it shows on the page
      onHomeworkScanned({
        subject: "GENERAL WORK",
        chapter: `Worksheet Photo #${dailyUploads.length + 1}`,
        content: `Uploaded Worksheet Homework Photo. View details below.`,
        submissionDate: "2026-06-15"
      });

      setTimeout(() => setStatusText(""), 3000);
    };
    reader.readAsDataURL(file);
  };

  const handleManualAdd = () => {
    if (!notes.trim()) {
      setStatusText("⚠️ Notes details cannot be empty.");
      return;
    }

    onHomeworkScanned({
      subject,
      chapter: chapter || "General Assignment",
      content: notes,
      submissionDate: "2026-06-15"
    });

    setStatusText("✅ Homework added successfully!");
    setChapter("");
    setNotes("");
    setTimeout(() => {
      setStatusText("");
      setIsOpen(false);
    }, 2000);
  };

  return (
    <div className="mb-6">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-orange-500/10 to-rose-500/10 border border-orange-200 hover:border-orange-300 rounded-2xl text-left transition-all"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">📸</span>
          <div>
            <h3 className="font-bold text-gray-800 text-sm md:text-base">
              Add Homework Photo / Notes
            </h3>
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
              Upload photos (Max 5/day) or write down homework entries manually.
            </p>
          </div>
        </div>
        <span className="text-orange-600 font-bold text-sm bg-white shadow-sm border border-orange-200 px-3 py-1 rounded-xl">
          {isOpen ? "Close" : "Open ⚡"}
        </span>
      </button>

      {isOpen && (
        <div className="mt-3 p-5 bg-white rounded-3xl border border-gray-150 shadow-sm space-y-5">
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
                Photo Uploader (Camera / Gallery)
              </label>
              <span className="text-[10px] text-gray-400 font-bold">
                {dailyUploads.length}/5 Uploaded Today
              </span>
            </div>
            
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileUpload}
              ref={fileInputRef}
              className="hidden"
              disabled={dailyUploads.length >= 5}
            />
            
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={dailyUploads.length >= 5}
              className={`w-full py-4 border-2 border-dashed rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                dailyUploads.length >= 5
                  ? "bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed"
                  : "border-gray-300 hover:border-orange-400 text-gray-600 hover:bg-slate-50"
              }`}
            >
              <span>📷</span> Tap to Capture Worksheet / Upload Image
            </button>

            {dailyUploads.length > 0 && (
              <div className="mt-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Scanned Worksheets today:</p>
                <div className="grid grid-cols-5 gap-2">
                  {dailyUploads.map((src, i) => (
                    <div key={i} className="relative aspect-square rounded-lg border border-gray-200 overflow-hidden bg-slate-50">
                      <img src={src} alt={`Worksheet ${i + 1}`} className="w-full h-full object-cover" />
                      <span className="absolute bottom-0.5 right-0.5 bg-black/60 text-white text-[8px] font-bold px-1 rounded">
                        #{i + 1}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-gray-150"></div>
            <span className="flex-shrink mx-4 text-xs font-black text-gray-300 uppercase">OR</span>
            <div className="flex-grow border-t border-gray-150"></div>
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
              Add Homework Notes Manually
            </label>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 mb-1">Subject</label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl p-2.5 focus:outline-none"
                >
                  <option value="MATHEMATICS">Mathematics</option>
                  <option value="ENVIRONMENTAL SCIENCE">EVS</option>
                  <option value="ENGLISH">English</option>
                  <option value="KANNADA">Kannada</option>
                  <option value="GENERAL">General</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 mb-1">Chapter/Topic</label>
                <input
                  type="text"
                  placeholder="e.g. Chapter 2. My Body"
                  value={chapter}
                  onChange={(e) => setChapter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl p-2 focus:outline-none focus:ring-1 focus:ring-orange-350"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-400 mb-1">Assignment Details</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Write homework assignment details here..."
                rows={3}
                className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl p-2.5 focus:outline-none focus:ring-1 focus:ring-orange-350"
              />
            </div>

            <button
              onClick={handleManualAdd}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold py-2.5 rounded-xl transition-all shadow-sm"
            >
              🚀 Save Assignment Notes
            </button>
          </div>

          {statusText && (
            <div className="text-center text-xs font-semibold text-orange-600 animate-pulse mt-2">
              {statusText}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
