"use client";

import { useState } from "react";
import revisionData from "@/data/info/jol-revision-games.json";

// ── Read-aloud helper (Web Speech API) ──────────────────────────────
function speak(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.85;
  u.pitch = 1.15;
  u.lang = "en-IN";
  window.speechSynthesis.speak(u);
}

function SpeakerButton({ text }: { text: string }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        speak(text);
      }}
      className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/70 hover:bg-white text-indigo-500 text-sm shadow-sm border border-indigo-100 flex-shrink-0"
      aria-label={`Hear "${text}"`}
      title="Hear it"
    >
      🔊
    </button>
  );
}

// ── Rhyme game (multiple choice) ────────────────────────────────────
function RhymeGame({ activity }: { activity: any }) {
  const [picked, setPicked] = useState<Record<number, string>>({});

  return (
    <div className="space-y-3">
      {activity.items.map((item: any, i: number) => {
        const chosen = picked[i];
        const solved = chosen === item.answer;
        return (
          <div
            key={i}
            className="bg-white rounded-2xl border-2 border-purple-100 p-3.5"
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-3xl">{item.emoji}</span>
              <span className="font-black text-lg text-gray-800">
                {item.word}
              </span>
              <SpeakerButton text={item.word} />
              <span className="text-gray-400 text-sm ml-auto">rhymes with…</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {item.options.map((opt: any) => {
                const isChosen = chosen === opt.label;
                const isRight = opt.label === item.answer;
                let cls =
                  "bg-purple-50 border-purple-200 text-gray-700 hover:bg-purple-100";
                if (isChosen && isRight)
                  cls = "bg-green-100 border-green-400 text-green-800";
                else if (isChosen && !isRight)
                  cls = "bg-red-50 border-red-300 text-red-700 animate-pulse";
                else if (solved && isRight)
                  cls = "bg-green-100 border-green-400 text-green-800";
                return (
                  <button
                    key={opt.label}
                    disabled={solved}
                    onClick={() => {
                      setPicked((p) => ({ ...p, [i]: opt.label }));
                      speak(
                        opt.label === item.answer
                          ? `${item.word}, ${opt.label}. Yes!`
                          : opt.label
                      );
                    }}
                    className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border-2 font-bold text-xs transition-all ${cls} ${
                      solved && !isRight ? "opacity-40" : ""
                    }`}
                  >
                    <span className="text-2xl">{opt.emoji}</span>
                    {opt.label}
                  </button>
                );
              })}
            </div>
            {solved && (
              <p className="text-center text-green-600 font-bold text-sm mt-2 animate-pulse">
                🌟 {item.word} — {item.answer}! Great job!
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Match game (tap-tap) ────────────────────────────────────────────
function MatchGame({ activity }: { activity: any }) {
  const pairs = activity.pairs;
  const [sel, setSel] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [wrong, setWrong] = useState<string | null>(null);

  // Stable shuffle based on ids so it doesn't reshuffle on every render
  const rightCol = [...pairs].sort((a, b) =>
    a.match.localeCompare(b.match)
  );

  const pickLeft = (id: string) => {
    if (done[id]) return;
    setSel(id);
    speak(pairs.find((p: any) => p.id === id).item);
  };
  const pickRight = (id: string) => {
    if (!sel || done[id]) return;
    if (sel === id) {
      setDone((d) => ({ ...d, [id]: true }));
      speak(pairs.find((p: any) => p.id === id).match + "! Yes!");
      setSel(null);
    } else {
      setWrong(id);
      setTimeout(() => setWrong(null), 400);
    }
  };

  const allDone = Object.keys(done).length === pairs.length;

  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          {pairs.map((p: any) => (
            <button
              key={p.id}
              onClick={() => pickLeft(p.id)}
              disabled={done[p.id]}
              className={`w-full flex items-center gap-2 py-2.5 px-3 rounded-xl border-2 font-bold text-sm transition-all ${
                done[p.id]
                  ? "bg-green-100 border-green-400 text-green-800 opacity-70"
                  : sel === p.id
                  ? "bg-amber-100 border-amber-400 text-amber-900 ring-2 ring-amber-300"
                  : "bg-blue-50 border-blue-200 text-gray-700 hover:bg-blue-100"
              }`}
            >
              <span className="text-2xl">{p.itemEmoji}</span>
              {p.item}
              {done[p.id] && <span className="ml-auto">✓</span>}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {rightCol.map((p: any) => (
            <button
              key={p.id}
              onClick={() => pickRight(p.id)}
              disabled={done[p.id]}
              className={`w-full flex items-center gap-2 py-2.5 px-3 rounded-xl border-2 font-bold text-sm transition-all ${
                done[p.id]
                  ? "bg-green-100 border-green-400 text-green-800 opacity-70"
                  : wrong === p.id
                  ? "bg-red-50 border-red-300 text-red-700 animate-pulse"
                  : "bg-pink-50 border-pink-200 text-gray-700 hover:bg-pink-100"
              }`}
            >
              <span className="text-2xl">{p.matchEmoji}</span>
              {p.match}
            </button>
          ))}
        </div>
      </div>
      {allDone && (
        <p className="text-center text-green-600 font-black text-base mt-3 animate-pulse">
          🎉 All matched! Well done! 🎉
        </p>
      )}
    </div>
  );
}

// ── Fill in the blank ───────────────────────────────────────────────
function FillGame({ activity }: { activity: any }) {
  const [picked, setPicked] = useState<Record<number, string>>({});

  return (
    <div className="space-y-3">
      {activity.items.map((item: any, i: number) => {
        const chosen = picked[i];
        const solved = chosen === item.answer;
        return (
          <div
            key={i}
            className="bg-white rounded-2xl border-2 border-blue-100 p-3.5"
          >
            <div className="flex items-center gap-2 flex-wrap text-sm font-bold text-gray-800 mb-3">
              <span className="text-2xl">{item.emoji}</span>
              <span>{item.before}</span>
              <span
                className={`inline-block min-w-[54px] text-center px-2 py-0.5 rounded-lg border-2 border-dashed ${
                  solved
                    ? "border-green-400 bg-green-50 text-green-700"
                    : "border-gray-300 text-gray-400"
                }`}
              >
                {solved ? item.answer : "___"}
              </span>
              <span>{item.after}</span>
            </div>
            <div className="flex gap-2">
              {item.options.map((opt: string) => {
                const isChosen = chosen === opt;
                const isRight = opt === item.answer;
                let cls =
                  "bg-blue-50 border-blue-200 text-gray-700 hover:bg-blue-100";
                if (isChosen && isRight)
                  cls = "bg-green-100 border-green-400 text-green-800";
                else if (isChosen && !isRight)
                  cls = "bg-red-50 border-red-300 text-red-700 animate-pulse";
                return (
                  <button
                    key={opt}
                    disabled={solved}
                    onClick={() => {
                      setPicked((p) => ({ ...p, [i]: opt }));
                      speak(opt);
                    }}
                    className={`flex-1 py-2 rounded-xl border-2 font-bold text-sm transition-all ${cls} ${
                      solved && !isRight ? "opacity-40" : ""
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
            {solved && (
              <p className="text-center text-green-600 font-bold text-sm mt-2">
                🌟 Correct!
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Speak / discuss (reveal) ────────────────────────────────────────
function SpeakGame({ activity }: { activity: any }) {
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});

  return (
    <div className="space-y-3">
      {activity.items.map((item: any, i: number) => {
        const show = revealed[i];
        return (
          <div
            key={i}
            className="bg-white rounded-2xl border-2 border-amber-100 p-3.5"
          >
            <div className="flex items-start gap-2">
              <span className="text-3xl">{item.emoji}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-sm text-gray-800 leading-snug">
                    {item.q}
                  </p>
                  <SpeakerButton text={item.q} />
                </div>
                {show ? (
                  <div className="mt-2 flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
                    <span className="text-green-700 font-bold text-sm">
                      💚 {item.a}
                    </span>
                    <SpeakerButton text={item.a} />
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setRevealed((r) => ({ ...r, [i]: true }));
                      speak(item.a);
                    }}
                    className="mt-2 text-xs font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-full transition-colors"
                  >
                    👀 Show a good answer
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ActivityBlock({ activity }: { activity: any }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-xl">{activity.emoji}</span>
        <h5 className="font-black text-gray-800 text-sm">{activity.title}</h5>
      </div>
      <p className="text-xs text-gray-500 mb-3 leading-relaxed">
        {activity.instruction}
      </p>
      {activity.type === "rhyme" && <RhymeGame activity={activity} />}
      {activity.type === "match" && <MatchGame activity={activity} />}
      {activity.type === "fill" && <FillGame activity={activity} />}
      {activity.type === "speak" && <SpeakGame activity={activity} />}
    </div>
  );
}

function PaperCard({ paper }: { paper: any }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={`rounded-2xl border overflow-hidden transition-all ${
        open
          ? "border-purple-200 shadow-md bg-white"
          : "border-gray-100 bg-white hover:border-purple-200 hover:shadow-sm"
      }`}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
      >
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${
            open ? "bg-purple-100" : "bg-gray-50"
          }`}
        >
          {paper.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-extrabold text-gray-900 text-sm">
            {paper.subject} · {paper.title}
          </div>
          <div className="text-[11px] text-gray-400 font-medium mt-0.5 truncate">
            {paper.chapter}
          </div>
        </div>
        <span
          className={`text-gray-400 transition-transform duration-200 text-sm flex-shrink-0 ${
            open ? "rotate-180" : ""
          }`}
        >
          ▼
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-5 border-t border-gray-100 pt-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-xs text-amber-900 leading-relaxed">
              <span className="font-black">👩‍🏫 For you: </span>
              {paper.howToHelp}
            </p>
          </div>
          {paper.activities.map((activity: any, i: number) => (
            <ActivityBlock key={i} activity={activity} />
          ))}
          <p className="text-center text-[11px] text-gray-400 italic pt-1">
            🎈 Play again anytime — repetition is how little learners remember!
          </p>
        </div>
      )}
    </div>
  );
}

export default function RevisionGames() {
  return (
    <div className="mt-6">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-pink-500 via-rose-500 to-orange-500 p-5 mb-4 shadow-lg shadow-rose-200">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -top-4 -right-4 w-28 h-28 rounded-full bg-white" />
          <div className="absolute bottom-0 left-6 w-16 h-16 rounded-full bg-white" />
        </div>
        <div className="relative z-10">
          <p className="text-rose-100 text-[10px] font-black uppercase tracking-widest mb-1">
            🎮 Play &amp; Learn
          </p>
          <h3 className="text-white text-lg font-black leading-tight">
            {revisionData.title}
          </h3>
          <p className="text-rose-100 text-xs font-medium mt-1 leading-relaxed">
            {revisionData.subtitle} Tap 🔊 to hear words read aloud.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {revisionData.papers.map((paper) => (
          <PaperCard key={paper.id} paper={paper} />
        ))}
      </div>
    </div>
  );
}
