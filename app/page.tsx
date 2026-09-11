'use client';

import { Suspense } from 'react';
import DailyBrief from '@/components/DailyBrief';
import { LoadingState } from '@/components/ui/LoadingState';

function HomeContent() {
  return <DailyBrief />;
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="sp-page">
          <LoadingState rows={5} />
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
