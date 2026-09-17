'use client';

import type { VisualHint } from '@/lib/recap/schema';
import {
  BookOpen,
  Bug,
  Circle,
  Heart,
  Leaf,
  Moon,
  Pencil,
  Sparkles,
  Square,
  Star,
  Sun,
  Triangle,
  Type,
  Hand,
  Hash,
  Worm,
} from 'lucide-react';

const EMOJI: Partial<Record<VisualHint, string>> = {
  star: '⭐',
  letter: 'अ',
  book: '📚',
  pencil: '✏️',
  shape_circle: '🔵',
  shape_square: '🟦',
  shape_triangle: '🔺',
  bug: '🐛',
  caterpillar: '🐛',
  sun: '☀️',
  moon: '🌙',
  heart: '💖',
  hand: '👋',
  abc: '🔤',
  number: '🔢',
  leaf: '🍃',
  sparkle: '✨',
};

export default function RecapVisual({
  hint = 'star',
  size = 'lg',
  label,
}: {
  hint?: VisualHint;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  label?: string;
}) {
  const box =
    size === 'xl'
      ? 'h-28 w-28 text-5xl'
      : size === 'lg'
        ? 'h-20 w-20 text-4xl'
        : size === 'md'
          ? 'h-14 w-14 text-2xl'
          : 'h-10 w-10 text-xl';

  const iconClass =
    size === 'xl' ? 'h-14 w-14' : size === 'lg' ? 'h-10 w-10' : size === 'md' ? 'h-7 w-7' : 'h-5 w-5';

  const Icon =
    hint === 'book'
      ? BookOpen
      : hint === 'bug'
        ? Bug
        : hint === 'caterpillar'
          ? Worm
          : hint === 'pencil'
            ? Pencil
            : hint === 'shape_circle'
              ? Circle
              : hint === 'shape_square'
                ? Square
              : hint === 'shape_triangle'
                ? Triangle
                : hint === 'sun'
                  ? Sun
                  : hint === 'moon'
                    ? Moon
                    : hint === 'heart'
                      ? Heart
                      : hint === 'hand'
                        ? Hand
                        : hint === 'leaf'
                          ? Leaf
                          : hint === 'number'
                            ? Hash
                            : hint === 'abc' || hint === 'letter'
                              ? Type
                              : hint === 'sparkle'
                                ? Sparkles
                                : Star;

  return (
    <div
      className={`mx-auto flex ${box} items-center justify-center rounded-[28%] bg-gradient-to-br from-amber-100 via-orange-50 to-rose-100 text-[var(--sp-ink)] shadow-inner`}
      aria-hidden={!label}
      aria-label={label}
    >
      <span className="relative flex items-center justify-center">
        <span className="absolute text-[1.15em] opacity-90">{EMOJI[hint] ?? '⭐'}</span>
        <Icon className={`${iconClass} opacity-0`} aria-hidden />
      </span>
    </div>
  );
}
