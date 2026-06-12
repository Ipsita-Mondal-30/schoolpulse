// Server component — fetches events + holidays on the server, passes as props
import { fetchEvents } from '@/app/actions';
import { getAllImportantDates } from '@/lib/data';
import EventsView from './EventsView';

export default async function EventsPage() {
  const today = new Date().toISOString().split('T')[0];

  const [events, allDates] = await Promise.all([
    fetchEvents(),
    Promise.resolve(getAllImportantDates()),
  ]);

  const holidays = allDates.filter(d => d.type === 'holiday');

  return <EventsView events={events} holidays={holidays} today={today} />;
}
