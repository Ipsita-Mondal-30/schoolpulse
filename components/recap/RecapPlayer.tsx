'use client';

import { useCallback, useMemo, useState } from 'react';
import { AnimatePresence, useReducedMotion } from 'framer-motion';
import type { MicroLessonForPlayer } from '@/lib/recap/today';
import type { MicroLessonScene } from '@/lib/recap/schema';
import RecapProgress from '@/components/recap/RecapProgress';
import IntroScene from '@/components/recap/scenes/IntroScene';
import TeachScene from '@/components/recap/scenes/TeachScene';
import ExamplesScene from '@/components/recap/scenes/ExamplesScene';
import ChoiceScene from '@/components/recap/scenes/ChoiceScene';
import MatchScene from '@/components/recap/scenes/MatchScene';
import QuizScene from '@/components/recap/scenes/QuizScene';
import CelebrationScene from '@/components/recap/scenes/CelebrationScene';

type Phase = 'scenes' | 'quiz' | 'done';

function playableScenes(scenes: MicroLessonScene[]): MicroLessonScene[] {
  return scenes.filter((s) => s.type !== 'celebration');
}

export default function RecapPlayer({ lesson }: { lesson: MicroLessonForPlayer }) {
  const reduceMotion = useReducedMotion();
  const scenes = useMemo(() => playableScenes(lesson.scenes), [lesson.scenes]);
  const celebrationFromScenes = lesson.scenes.find((s) => s.type === 'celebration');
  const celebrationMessage =
    lesson.celebrationMessage ||
    (celebrationFromScenes && celebrationFromScenes.type === 'celebration'
      ? celebrationFromScenes.message
      : 'Great learning today!');

  const [phase, setPhase] = useState<Phase>(scenes.length > 0 ? 'scenes' : 'quiz');
  const [sceneIndex, setSceneIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(lesson.quiz.length);
  const [saving, setSaving] = useState(false);

  const scene = scenes[sceneIndex];
  const question = lesson.quiz[questionIndex];

  const progressTotal = scenes.length + lesson.quiz.length;
  const progressCurrent =
    phase === 'scenes'
      ? sceneIndex + 1
      : phase === 'quiz'
        ? scenes.length + questionIndex + 1
        : progressTotal;

  const goNextScene = useCallback(() => {
    if (sceneIndex < scenes.length - 1) {
      setSceneIndex((i) => i + 1);
      return;
    }
    setPhase('quiz');
  }, [sceneIndex, scenes.length]);

  async function finishQuiz(nextAnswers: number[]) {
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
        setTotal(lesson.quiz.length);
      }
    } catch {
      setTotal(lesson.quiz.length);
    } finally {
      setSaving(false);
      setPhase('done');
    }
  }

  async function handleQuizAnswer(optionIndex: number): Promise<'correct' | 'incorrect'> {
    const res = await fetch(`/api/recap/${lesson.id}/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionIndex, answerIndex: optionIndex }),
    });
    const data = (await res.json()) as { ok?: boolean; correct?: boolean };
    const correct = Boolean(data.ok && data.correct);

    const nextAnswers = [...answers];
    nextAnswers[questionIndex] = optionIndex;
    setAnswers(nextAnswers);

    window.setTimeout(() => {
      if (questionIndex < lesson.quiz.length - 1) {
        setQuestionIndex((i) => i + 1);
        return;
      }
      void finishQuiz(nextAnswers);
    }, 1000);

    return correct ? 'correct' : 'incorrect';
  }

  if (lesson.schemaVersion === 1 || scenes.length === 0) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 text-center">
        <p className="text-lg font-semibold text-[var(--sp-ink)]">Getting your game ready…</p>
        <p className="mt-2 text-sm text-[var(--sp-muted)]">
          Refresh in a moment if this stays here.
        </p>
        <a href="/recap" className="mt-6 font-semibold text-[var(--sp-primary)]">
          Back to Recap
        </a>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[75vh] max-w-lg flex-col px-3 py-5 sm:px-4">
      <header className="mb-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--sp-subtle)]">
          Today&apos;s Recap
        </p>
        <h1 className="mt-1 text-lg font-bold text-[var(--sp-ink)]">{lesson.topic}</h1>
        <div className="mt-3">
          <RecapProgress current={progressCurrent} total={progressTotal} />
        </div>
      </header>

      <div className="relative flex flex-1 flex-col overflow-hidden rounded-[32px] bg-gradient-to-b from-amber-50 via-orange-50/80 to-rose-50 p-4 shadow-[0_1px_0_rgba(0,0,0,0.03)] sm:p-6">
        <AnimatePresence mode="wait">
          {phase === 'scenes' && scene?.type === 'intro' ? (
            <IntroScene key={`intro-${sceneIndex}`} scene={scene} onDone={goNextScene} />
          ) : null}
          {phase === 'scenes' && scene?.type === 'visual_teach' ? (
            <TeachScene key={`teach-${sceneIndex}`} scene={scene} onNext={goNextScene} />
          ) : null}
          {phase === 'scenes' && scene?.type === 'examples' ? (
            <ExamplesScene key={`ex-${sceneIndex}`} scene={scene} onNext={goNextScene} />
          ) : null}
          {phase === 'scenes' && (scene?.type === 'choice' || scene?.type === 'find') ? (
            <ChoiceScene key={`choice-${sceneIndex}`} scene={scene} onSolved={goNextScene} />
          ) : null}
          {phase === 'scenes' && scene?.type === 'match' ? (
            <MatchScene key={`match-${sceneIndex}`} scene={scene} onSolved={goNextScene} />
          ) : null}

          {phase === 'quiz' && question ? (
            <QuizScene
              key={`quiz-${questionIndex}`}
              question={question.question}
              options={question.options}
              optionHints={question.optionHints}
              questionIndex={questionIndex}
              total={lesson.quiz.length}
              onAnswer={handleQuizAnswer}
            />
          ) : null}

          {phase === 'done' ? (
            <CelebrationScene
              key="done"
              message={saving ? 'Saving your stars…' : celebrationMessage}
              score={score}
              total={total}
            />
          ) : null}
        </AnimatePresence>

        {reduceMotion ? (
          <span className="sr-only">Animations reduced for accessibility</span>
        ) : null}
      </div>
    </div>
  );
}
