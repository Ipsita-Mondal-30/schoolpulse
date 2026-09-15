import { notFound } from 'next/navigation';
import { getMicroLessonForUi } from '@/app/actions/recap';
import RecapPlayer from '@/components/recap/RecapPlayer';

type PageProps = { params: Promise<{ lessonId: string }> };

export default async function RecapLessonPage({ params }: PageProps) {
  const { lessonId } = await params;
  const lesson = await getMicroLessonForUi(lessonId);
  if (!lesson) notFound();

  return (
    <main className="sp-page max-w-3xl">
      <RecapPlayer lesson={lesson} />
    </main>
  );
}
