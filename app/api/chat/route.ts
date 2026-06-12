import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { getDaySchedule, getWeekForDate, getToday, getUpcomingEvents, getSchoolContactInfo } from '@/lib/data';
import { fetchHomework, fetchExternalUpdates, fetchEvents } from '@/app/actions';
import generalInfoData from '@/data/info/general.json';
import busesData from '@/data/info/buses.json';

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages } = await req.json();

  const today = getToday();
  const schedule = getDaySchedule(today);
  const weekInfo = getWeekForDate(today);
  const events = getUpcomingEvents(14);
  const contactInfo = getSchoolContactInfo();
  
  // Fetch async data
  const homework = await fetchHomework().catch(() => []);
  const updates = await fetchExternalUpdates().catch(() => []);
  const schoolEvents = await fetchEvents().catch(() => []);

  const systemMessage = `
You are the "SchoolPulse AI Assistant", a friendly, helpful, and highly accurate AI chatbot for parents of Class 1 at BGS National Public School. 
You answer questions quickly, warmly, and beautifully formatting your responses using emojis, bullet points, and markdown.

**CRITICAL RULES:**
- You must ONLY use the provided context to answer questions. If you don't know the answer based on the context, politely inform the parent that you don't have that information.
- Always be supportive and polite.
- When summarizing schedules or homework, make it easy to read on a mobile phone.

**CONTEXT:**

[TODAY'S DATE]: ${today}

[TODAY'S SCHEDULE]: 
${JSON.stringify(schedule, null, 2)}

[THIS WEEK'S DICTATION & INFO]:
${JSON.stringify(weekInfo, null, 2)}

[UPCOMING CALENDAR EVENTS (Next 14 Days from timetable)]:
${JSON.stringify(events, null, 2)}

[SCHOOL COMPETITIONS & ACTIVITIES (from live sheet — Music Mania, Scouts, Science Quest, Super Dancers, Hindi Olympiad, Brush Stroke, etc.)]:
${JSON.stringify(schoolEvents, null, 2)}

[PENDING HOMEWORK]:
${JSON.stringify(homework, null, 2)}

[SCHOOL NOTICES/UPDATES]:
${JSON.stringify(updates, null, 2)}

[SCHOOL CONTACT INFO]:
${JSON.stringify(contactInfo, null, 2)}

[GENERAL INFORMATION (Vendors, Contacts, Teachers, Houses, Uniforms)]:
${JSON.stringify(generalInfoData, null, 2)}

[SCHOOL BUS TRACKING DATA (Route, Vehicle, Driver, Phone, GPRS Link)]:
${JSON.stringify(busesData, null, 2)}

Answer the parent's message using the above information.
`;

  const result = await streamText({
    // @ts-ignore: version mismatch between ai core and provider
    model: openai('gpt-4o-mini'),
    system: systemMessage,
    messages,
  });

  return result.toDataStreamResponse();
}
