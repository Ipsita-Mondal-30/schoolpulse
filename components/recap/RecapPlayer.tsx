'use client';

import { useCallback, useEffect, useState } from 'react';
import type { MicroLessonForPlayer } from '@/lib/recap/today';

type Phase = 'slides' | 'quiz' | 'done';

export default function RecapPlayer({ lesson }: { lesson: MicroLessonForPlayer }) {
  const [phase, setPhase] = useState<Phase>('slides');
  const [slideIndex, setSlideIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [locked, setLocked] = useState(false);
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(lesson.quiz.length);
  const [saving, setSaving] = useState(false);

  const slides = lesson.slides;
  const slide = slides[slideIndex];
  const question = lesson.quiz[questionIndex];

  const goNextSlide = useCallback(() => {
    if (slideIndex < slides.length - 1) {
      setSlideIndex((i) => i + 1);
      return;
    }
    setPhase('quiz');
  }, [slideIndex, slides.length]);

  useEffect(() => {
    if (phase !== 'slides') return;
    const t = setTimeout(() => goNextSlide(), 4000);
    return () => clearTimeout(t);
  }, [phase, slideIndex, goNextSlide]);

  async function onPickOption(optionIndex: number) {
    if (locked || feedback) return;
    setLocked(true);

    const res = await fetch(`/api/recap/${lesson.id}/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionIndex, answerIndex: optionIndex }),
    });
    const data = (await res.json()) as { ok?: boolean; correct?: boolean };
    const correct = Boolean(data.ok && data.correct);
    setFeedback(correct ? 'correct' : 'incorrect');

    const nextAnswers = [...answers];
    nextAnswers[questionIndex] = optionIndex;
    setAnswers(nextAnswers);

    setTimeout(async () => {
      setFeedback(null);
      setLocked(false);
      if (questionIndex < lesson.quiz.length - 1) {
        setQuestionIndex((i) => i + 1);
        return;
      }
      setSaving(true);
      try {
        const attemptRes = await fetch(`/api/recap/${lesson.id}/attempt`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answers: nextAnswers }),
        });
        const attemptData = (await attemptRes.json()) as {
          ok?: boolean;
          score?: number;
          total?: number;
        };
        if (attemptData.ok) {
          setScore(attemptData.score ?? 0);
          setTotal(attemptData.total ?? lesson.quiz.length);
        } else {
          setScore(nextAnswers.filter((a, i) => a === i).length);
          setTotal(lesson.quiz.length);
        }
      } catch {
        setTotal(lesson.quiz.length);
      } finally {
        setSaving(false);
        setPhase('done');
      }
    }, 1100);
  }

  const progressTotal = phase === 'slides' ? slides.length + lesson.quiz.length : slides.length + lesson.quiz.length;
  const progressCurrent =
    phase === 'slides'
      ? slideIndex + 1
      : phase === 'quiz'
        ? slides.length + questionIndex + 1
        : progressTotal;
  const progressPct = Math.round((progressCurrent / Math.max(progressTotal, 1)) * 100);

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col px-4 py-6">
      <header className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--sp-subtle)]">
          Today&apos;s Recap
        </p>
        <h1 className="mt-1 text-xl font-semibold text-[var(--sp-ink)]">{lesson.title}</h1>
        <p className="mt-0.5 text-sm text-[var(--sp-muted)]">
          {lesson.subject} · {lesson.topic}
        </p>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-100">
          <div
            className="h-full rounded-full bg-[var(--sp-primary)] transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </header>

      {phase === 'slides' && slide ? (
        <section className="flex flex-1 flex-col items-center justify-center rounded-[28px] bg-white px-6 py-10 text-center shadow-[0_1px_0_rgba(0,0,0,0.03)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--sp-subtle)]">
            {slide.type}
          </p>
          <h2 className="mt-4 text-2xl font-semibold leading-snug text-[var(--sp-ink)] sm:text-3xl">
            {slide.title}
          </h2>
          {slide.word || slide.opposite ? (
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-3xl font-bold text-[var(--sp-ink)]">
              {slide.word ? <span>{slide.word}</span> : null}
              {slide.word && slide.opposite ? (
                <span className="text-[var(--sp-muted)]">→</span>
              ) : null}
              {slide.opposite ? <span>{slide.opposite}</span> : null}
            </div>
          ) : null}
          <p className="mt-6 max-w-sm text-base leading-relaxed text-[var(--sp-muted)]">
            {slide.text}
          </p>
          <button
            type="button"
            onClick={goNextSlide}
            className="mt-10 rounded-2xl bg-[var(--sp-primary)] px-8 py-3 text-base font-semibold text-white hover:bg-orange-600 sp-focus"
          >
            {slideIndex < slides.length - 1 ? 'Next' : 'Start quiz'}
          </button>
        </section>
      ) : null}

      {phase === 'quiz' && question ? (
        <section className="flex flex-1 flex-col rounded-[28px] bg-white px-5 py-8 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--sp-subtle)]">
            Question {questionIndex + 1} of {lesson.quiz.length}
          </p>
          <h2 className="mt-3 text-xl font-semibold leading-snug text-[var(--sp-ink)]">
            {question.question}
          </h2>
          <div className="mt-6 grid gap-3">
            {question.options.map((option, idx) => (
              <button
                key={`${questionIndex}-${idx}`}
                type="button"
                disabled={locked}
                onClick={() => void onPickOption(idx)}
                className="rounded-2xl border border-[var(--sp-border)] bg-[var(--sp-bg)] px-4 py-4 text-left text-base font-semibold text-[var(--sp-ink)] hover:border-orange-200 hover:bg-[var(--sp-primary-soft)] disabled:opacity-60 sp-focus"
              >
                {option}
              </button>
            ))}
          </div>
          {feedback === 'correct' ? (
            <p className="mt-5 text-center text-base font-semibold text-emerald-600">
              Great job!
            </p>
          ) : null}
          {feedback === 'incorrect' ? (
            <p className="mt-5 text-center text-base font-semibold text-amber-600">
              Almost! Let&apos;s think again.
            </p>
          ) : null}
        </section>
      ) : null}

      {phase === 'done' ? (
        <section className="flex flex-1 flex-col items-center justify-center rounded-[28px] bg-white px-6 py-12 text-center shadow-[0_1px_0_rgba(0,0,0,0.03)]">
          <h2 className="text-3xl font-semibold text-[var(--sp-ink)]">Nice work!</h2>
          <p className="mt-4 text-lg text-[var(--sp-muted)]">
            {saving ? 'Saving…' : `${score} / ${total} correct`}
          </p>
          <p className="mt-2 text-sm text-[var(--sp-subtle)]">Recap completed</p>
          <a
            href="/"
            className="mt-8 rounded-2xl bg-[var(--sp-primary)] px-8 py-3 text-base font-semibold text-white hover:bg-orange-600 sp-focus"
          >
            Back to Home
          </a>
        </section>
      ) : null}
    </div>
  );
}
