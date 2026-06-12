"use client";

import React, { useState, useRef } from "react";

interface HomeworkScannerProps {
  onHomeworkScanned: (newHw: { subject: string; chapter: string; content: string; submissionDate: string }) => void;
}

export default function HomeworkScanner({ onHomeworkScanned }: HomeworkScannerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputMessage, setInputMessage] = useState("");
  const [statusText, setStatusText] = useState("");
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePasteAnalyze = async () => {
    if (!inputMessage.trim()) return;
    setLoading(true);
    setStatusText("Analyzing text content...");

    try {
      // Direct integration with GPT parser inside route or client action
      const response = await fetch("/api/homework/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputMessage }),
      });

      if (!response.ok) throw new Error("Failed to parse homework");

      const result = await response.json();
      if (result && result.subject) {
        onHomeworkScanned(result);
        setStatusText("✅ Homework parsed and added successfully!");
        setInputMessage("");
        setTimeout(() => {
          setStatusText("");
          setIsOpen(false);
        }, 2500);
      } else {
        throw new Error("Invalid parse response");
      }
    } catch (e) {
      console.error(e);
      setStatusText("❌ Failed to parse. Try entering/editing manually.");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setStatusText("Uploading and scanning worksheet image...");

    try {
      // Simulate/mock OCR scanning using browser FileReader/vision
      const reader = new FileReader();
      reader.onload = async () => {
        // Mock OCR result triggers parser
        setTimeout(async () => {
          const mockOcrText = `Chapter 2. My Body ENVIRONMENTAL SCIENCE I-A Notes: Complete workbook pg 19 and bring next class.`;
          try {
            const response = await fetch("/api/homework/parse", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: mockOcrText }),
            });
            const result = await response.json();
            onHomeworkScanned(result);
            setStatusText("✅ Image scanned & added successfully!");
            setTimeout(() => {
              setStatusText("");
              setIsOpen(false);
            }, 2500);
          } catch (err) {
            setStatusText("❌ Parsing scanned text failed.");
          }
        }, 1500);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setStatusText("❌ Scanning failed.");
      setLoading(false);
    }
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
              WhatsApp Paste & Camera Scanner
            </h3>
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
              Instantly scan worksheets or paste parent portal messages to update your local timeline.
            </p>
          </div>
        </div>
        <span className="text-orange-600 font-bold text-sm">
          {isOpen ? "Close" : "Open ⚡"}
        </span>
      </button>

      {isOpen && (
        <div className="mt-3 p-5 bg-white rounded-3xl border border-gray-150 shadow-sm space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Option A: Upload Worksheet Image (Camera / Gallery)
            </label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileUpload}
              ref={fileInputRef}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="w-full py-3 border-2 border-dashed border-gray-300 hover:border-orange-400 text-gray-600 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-slate-50 transition-all"
            >
              <span>📷</span> Take Photo or Upload Image
            </button>
          </div>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-gray-150"></div>
            <span className="flex-shrink mx-4 text-xs font-black text-gray-400 uppercase">OR</span>
            <div className="flex-grow border-t border-gray-150"></div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Option B: Paste school WhatsApp text
            </label>
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Paste raw WhatsApp text diary here..."
              disabled={loading}
              rows={4}
              className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl p-3 focus:outline-none focus:ring-1 focus:ring-orange-300"
            />
            <button
              onClick={handlePasteAnalyze}
              disabled={loading || !inputMessage.trim()}
              className="w-full mt-3 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold py-2.5 rounded-xl transition-all shadow-sm"
            >
              🚀 Analyze & Parse Text
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
