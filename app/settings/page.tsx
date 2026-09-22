'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';

const PINNED_SECTION_KEY = 'schoolpulse_pinned_section';
const ALL_SECTIONS = [
  'I-A', 'I-B', 'I-C', 'I-D', 'I-E', 'I-F', 'I-G', 'I-H', 'I-I', 'I-J', 'I-K',
];

export default function SettingsPage() {
  const [section, setSection] = useState('I-A');

  useEffect(() => {
    const saved = localStorage.getItem(PINNED_SECTION_KEY);
    if (saved && ALL_SECTIONS.includes(saved)) setSection(saved);
  }, []);

  return (
    <div className="sp-page">
      <PageHeader title="Settings" subtitle="How SchoolPulse shows your child’s class" />

      <label className="block max-w-xs">
        <span className="sp-section mb-1.5 block">Pinned section</span>
        <select
          value={section}
          onChange={(e) => {
            setSection(e.target.value);
            localStorage.setItem(PINNED_SECTION_KEY, e.target.value);
          }}
          className="min-h-10 w-full rounded-xl border border-[var(--sp-border)] bg-white px-3 text-sm font-semibold text-[var(--sp-ink)] shadow-sm sp-focus"
        >
          {ALL_SECTIONS.map((sec) => (
            <option key={sec} value={sec}>
              Class 1 · Section {sec.split('-')[1]}
            </option>
          ))}
        </select>
      </label>

      <p className="sp-meta mt-6">
        Acknowledgements mean you have seen an item. They do not mean homework is complete.
      </p>

      <Link
        href="/profile"
        className="mt-6 inline-block text-sm font-semibold text-[var(--sp-primary)] hover:underline"
      >
        Profile and sign out
      </Link>
    </div>
  );
}
