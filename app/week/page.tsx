"use client";

import { useState, useEffect } from "react";
import { getDaySchedule, getToday, getMonthlyPlanner, getMonthData, WeekData } from "@/lib/data";
import { fetchHomework, Homework } from "../actions";

export default function KidsQuestPage() {
  const [todayDateStr, setTodayDateStr] = useState("2026-06-12");
  const [schedule, setSchedule] = useState<any>(null);
  const [planner, setPlanner] = useState<any[]>([]);
  const [homework, setHomework] = useState<Homework[]>([]);
  const [loading, setLoading] = useState(true);

  // Gamified morning prep state saved in localStorage
  const [prepStates, setPrepStates] = useState<Record<string, boolean>>({
    bag: false,
    uniform: false,
    homework: false,
    water: false,
  });

  // Streak counter saved in localStorage
  const [streak, setStreak] = useState(0);
  const [streakClaimedToday, setStreakClaimedToday] = useState(false);

  // Quiz active question tracker
  const [quizScore, setQuizScore] = useState(0);
  const [answeredSubjects, setAnsweredSubjects] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Load local storage states
    if (typeof window !== "undefined") {
      const savedPrep = localStorage.getItem("kids_prep_states");
      if (savedPrep) setPrepStates(JSON.parse(savedPrep));

      const savedStreak = localStorage.getItem("kids_streak_count");
      if (savedStreak) setStreak(Number(savedStreak));

      const savedClaimed = localStorage.getItem("kids_streak_claimed_today");
      if (savedClaimed === "true") setStreakClaimedToday(true);
    }

    const loadData = async () => {
      setLoading(true);
      try {
        const todayStr = getToday();
        setTodayDateStr(todayStr);

        const currentSchedule = getDaySchedule(todayStr);
        setSchedule(currentSchedule);

        const currentPlanner = getMonthlyPlanner();
        setPlanner(currentPlanner);

        const hwList = await fetchHomework();
        // filter homework belonging to today or recently active
        const todaysHw = hwList.filter(h => {
          let hDate = h.createdAt || "";
          if (h.notes && h.notes.includes("assigned")) {
            try {
              const meta = JSON.parse(h.notes);
              hDate = meta.assigned || "";
            } catch (e) {}
          }
          return hDate === todayStr || h.submissionDate === "2026-06-15";
        });
        setHomework(todaysHw);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handlePrepToggle = (key: string) => {
    const nextStates = { ...prepStates, [key]: !prepStates[key] };
    setPrepStates(nextStates);
    localStorage.setItem("kids_prep_states", JSON.stringify(nextStates));

    // Check if all states are checked
    const allChecked = Object.values(nextStates).every(v => v === true);
    if (allChecked && !streakClaimedToday) {
      const newStreak = streak + 1;
      setStreak(newStreak);
      setStreakClaimedToday(true);
      localStorage.setItem("kids_streak_count", String(newStreak));
      localStorage.setItem("kids_streak_claimed_today", "true");
    }
  };

  const resetStreak = () => {
    setStreak(0);
    setStreakClaimedToday(false);
    const cleared = { bag: false, uniform: false, homework: false, water: false };
    setPrepStates(cleared);
    localStorage.setItem("kids_prep_states", JSON.stringify(cleared));
    localStorage.setItem("kids_streak_count", "0");
    localStorage.setItem("kids_streak_claimed_today", "false");
  };

  // Generate dinner table conversation questions dynamically from portions and homework
  const getDinnerQuestions = () => {
    const questions: { subject: string; icon: string; question: string; answerHint: string }[] = [];

    // Let's create English quiz based on spelling words from homework if any
    const englishHw = homework.find(h => h.subject.toUpperCase().includes("ENGLISH"));
    if (englishHw) {
      questions.push({
        subject: "English Spelling",
        icon: "📖",
        question: "Can you spell the word 'Hands' and 'Blink' without looking?",
        answerHint: "These are Unit 1 dictation words: Hands, Blink."
      });
    } else {
      questions.push({
        subject: "English Literature",
        icon: "📖",
        question: "In the poem 'If You Are Happy', what body parts do you clap and pat?",
        answerHint: "Clap your hands and pat your knees!"
      });
    }

    // Maths question
    const mathHw = homework.find(h => h.subject.toUpperCase().includes("MATH"));
    if (mathHw && mathHw.content.toLowerCase().includes("collage")) {
      questions.push({
        subject: "Maths Collage",
        icon: "🔢",
        question: "What items did you choose for your Pre-Number collage sheet?",
        answerHint: "Collage of items to learn pre-number size/quantity concepts."
      });
    } else {
      questions.push({
        subject: "Mathematics",
        icon: "🔢",
        question: "What is the difference between a 'big' object and a 'small' object? Can you show me?",
        answerHint: "Pre-number concepts (Big/Small, Long/Short)."
      });
    }

    // EVS question
    const evsHw = homework.find(h => h.subject.toUpperCase().includes("ENVIRONMENTAL"));
    if (evsHw) {
      questions.push({
        subject: "Environmental Science",
        icon: "🌿",
        question: "Can you name 3 body parts that come in pairs of two?",
        answerHint: "Eyes, Ears, Hands, Legs, Knees (from 'My Body' chapter)."
      });
    } else {
      questions.push({
        subject: "Environmental Science",
        icon: "🌿",
        question: "What is the largest organ of our body that protects us?",
        answerHint: "Skin!"
      });
    }

    // Kannada question
    const kanHw = homework.find(h => h.subject.toUpperCase().includes("KANNADA"));
    if (kanHw) {
      questions.push({
        subject: "Kannada Workbook",
        icon: "🏛️",
        question: "How do you write the number 30 in Kannada script?",
        answerHint: "It is written as ೩೦."
      });
    } else {
      questions.push({
        subject: "Kannada Letters",
        icon: "🏛️",
        question: "Can you name the first Kannada vowel letter?",
        answerHint: "ಅ (a)"
      });
    }

    return questions;
  };

  const handleQuizAnswer = (subject: string, correct: boolean) => {
    if (answeredSubjects[subject]) return; // already answered
    setAnsweredSubjects(prev => ({ ...prev, [subject]: true }));
    if (correct) {
      setQuizScore(prev => prev + 1);
    }
  };

  const dinnerQuestions = getDinnerQuestions();

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 pb-24">
      {/* Kids Quest Hero Header */}
      <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-3xl p-6 md:p-8 text-white shadow-xl mb-8 relative overflow-hidden">
        <div className="absolute right-0 bottom-0 opacity-15 transform translate-x-4 translate-y-4">
          <span className="text-9xl">🎮</span>
        </div>
        <div className="relative z-10">
          <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-semibold tracking-wider uppercase">
            Active Learning
          </span>
          <h1 className="text-3xl md:text-4xl font-extrabold mt-3 tracking-tight">
            Kids' Quest
          </h1>
          <p className="text-white/85 text-sm md:text-base mt-2 max-w-xl">
            A interactive, gamified checkpoint for children and parents to review prep goals and study progress.
          </p>

          {/* Gamified Streak Counter */}
          <div className="mt-6 flex items-center justify-between bg-white/10 backdrop-blur-md rounded-2xl px-5 py-4 border border-white/10">
            <div className="flex items-center gap-3">
              <span className="text-3xl animate-bounce">🔥</span>
              <div>
                <div className="text-xs text-indigo-200 font-bold uppercase tracking-wider">Morning Prep Streak</div>
                <div className="text-2xl font-black">{streak} Days Ready</div>
              </div>
            </div>
            {streak > 0 && (
              <button 
                onClick={resetStreak}
                className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg font-medium transition-all"
              >
                Reset Streak
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Morning Prep Section */}
        <div className="bg-white rounded-3xl p-6 border border-gray-150 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <span>☀️</span> School Prep Check
              </h2>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 bg-orange-100 text-orange-700 rounded-md">
                Daily Game
              </span>
            </div>
            <p className="text-xs text-gray-500 mb-5 leading-relaxed">
              Complete the checklist with your child in the morning or night before. Check all 4 items to grow your streak!
            </p>

            <div className="space-y-3">
              <button
                onClick={() => handlePrepToggle("bag")}
                className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all text-left ${
                  prepStates.bag 
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
                    : "bg-gray-50 border-gray-100 text-gray-700 hover:border-indigo-200"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">🎒</span>
                  <span className="font-bold text-sm">Bag Packed (Books inside)</span>
                </div>
                <span className="text-lg">{prepStates.bag ? "🟢" : "⚪"}</span>
              </button>

              <button
                onClick={() => handlePrepToggle("uniform")}
                className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all text-left ${
                  prepStates.uniform 
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
                    : "bg-gray-50 border-gray-100 text-gray-700 hover:border-indigo-200"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">👕</span>
                  <span className="font-bold text-sm">Uniform & Shoes Cleaned</span>
                </div>
                <span className="text-lg">{prepStates.uniform ? "🟢" : "⚪"}</span>
              </button>

              <button
                onClick={() => handlePrepToggle("homework")}
                className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all text-left ${
                  prepStates.homework 
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
                    : "bg-gray-50 border-gray-100 text-gray-700 hover:border-indigo-200"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">📝</span>
                  <span className="font-bold text-sm">Homework Submitted/Kept</span>
                </div>
                <span className="text-lg">{prepStates.homework ? "🟢" : "⚪"}</span>
              </button>

              <button
                onClick={() => handlePrepToggle("water")}
                className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all text-left ${
                  prepStates.water 
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
                    : "bg-gray-50 border-gray-100 text-gray-700 hover:border-indigo-200"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">💧</span>
                  <span className="font-bold text-sm">Water Bottle & Snack Packed</span>
                </div>
                <span className="text-lg">{prepStates.water ? "🟢" : "⚪"}</span>
              </button>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span>Status:</span>
            <span className="font-bold text-indigo-600">
              {streakClaimedToday ? "🎉 Saved streak for today!" : "Check all tasks to save streak"}
            </span>
          </div>
        </div>

        {/* Dinner Table Quiz Section */}
        <div className="bg-white rounded-3xl p-6 border border-gray-150 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <span>🌙</span> Dinner Table Talk
              </h2>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-md">
                Quiz Score: {quizScore}/{dinnerQuestions.length}
              </span>
            </div>
            <p className="text-xs text-gray-500 mb-5 leading-relaxed">
              Dynamic conversation quizzes extracted from today's active syllabus planner & homework context. Let your kid answer!
            </p>

            <div className="space-y-4 max-h-[360px] overflow-y-auto pr-1">
              {dinnerQuestions.map((q, index) => {
                const isAnswered = answeredSubjects[q.subject];
                return (
                  <div key={index} className="p-4 bg-slate-50 rounded-2xl border border-slate-100/80">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span>{q.icon}</span>
                      <span className="text-xs font-black text-indigo-600 tracking-wide uppercase">{q.subject}</span>
                    </div>
                    <p className="text-sm font-bold text-gray-800 leading-snug">
                      {q.question}
                    </p>
                    <p className="text-xs text-gray-400 mt-2 bg-white/80 p-2 rounded-lg italic border border-gray-50">
                      💡 Hint: {q.answerHint}
                    </p>

                    <div className="mt-3 flex items-center gap-2">
                      <button
                        onClick={() => handleQuizAnswer(q.subject, true)}
                        disabled={isAnswered}
                        className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all ${
                          isAnswered
                            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                            : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-100"
                        }`}
                      >
                        Correct Answer! 🌟
                      </button>
                      <button
                        onClick={() => handleQuizAnswer(q.subject, false)}
                        disabled={isAnswered}
                        className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all ${
                          isAnswered
                            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                            : "bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-100"
                        }`}
                      >
                        Try Again
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-100 text-center text-xs text-gray-400 italic">
            Questions update daily based on active homework.
          </div>
        </div>
      </div>
    </div>
  );
}
