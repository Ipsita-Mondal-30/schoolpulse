# SchoolPulse: Extension & Core Refactoring Plan

## Current Architecture Analysis

### Architecture Diagram

```
+------------------------------------------------------------------+
|                        BROWSER (PWA)                              |
|                                                                   |
|  +------------------+    +-----------------------------------+    |
|  | Navigation.tsx   |    |  UpdatesProvider (Context API)     |    |
|  | HomeworkDuePopup |    |  - updates: Announcement[]         |    |
|  | InstallPrompt    |    |  - homeworkCount                   |    |
|  +------------------+    |  - refreshUpdates()                |    |
|                          +---------|-------------------------+    |
|                                    |                              |
|  +------+  +------+  +--------+  +--------+  +------+  +-----+  |
|  | Home |  | Week |  |Homework|  | Month  |  |Rhymes|  |Dates|  |
|  | page |  | page |  |  page  |  |  page  |  | page | | page|  |
|  +--+---+  +--+---+  +---+----+  +---+----+  +--+---+  +--+--+  |
|     |         |           |           |          |         |      |
+-----|---------|-----------|-----------|----------|---------|------+
      |         |           |           |          |         |
      v         v           v           v          v         v
+------------------------------------------------------------------+
|                    lib/data.ts                                    |
|  Static imports of JSON:                                          |
|    november-2025.json  december-2025.json                         |
|    january-2026.json   february-2026.json                         |
|  monthDataMap: Record<string, MonthData>                          |
|  getExternalUpdates() -> fetch(Google Sheets CSV)                 |
+------------------------------------------------------------------+
      |                                     |
      v                                     v
+-------------------+           +-----------------------+
| data/*.json       |           | Google Sheets (CSV)   |
| (static, bundled) |           | (live announcements   |
|                   |           |  + homework)           |
+-------------------+           +-----------------------+
```

### Key Weaknesses

1. **Data coupling**: `lib/data.ts` uses static `import` for JSON files. Every month must be manually added as an import and registered in `monthDataMap`. This does not scale.

2. **Duplicated state initialization**: Every page (`/`, `/week`, `/month`, `/rhymes`, `/dates`) independently runs the same `useEffect` pattern to load months, select the current month, and fetch data. This is copy-paste code across 5 files.

3. **Duplicated CSV parsing**: The CSV parser is written twice -- once in `lib/data.ts` (dead code) and once in `app/actions.ts` (active).

4. **No user model**: Everything is anonymous. The admin page has a hardcoded password and uses `sessionStorage`/`localStorage`.

5. **No server components**: Despite using Next.js 16 with App Router, every page is `'use client'`.

6. **Single-class assumption**: The data model assumes PP3 at a single school, baked into JSON structure and footer text.

7. **No error boundaries**: A malformed JSON file or failed fetch crashes the entire app.

8. **Large component files**: `RecentUpdates.tsx` (257 lines), `app/page.tsx` (299 lines) -- these mix data logic, business logic, and presentation.

---

## Part 1: Proposed Extensions

### 1.1 Progress Tracking & Learning Analytics (`/progress`)

A dashboard showing subject coverage over time, revision completion, and dictation word mastery.

- Subject coverage heatmap (calendar-style)
- Weekly revision completion tracker (checkboxes)
- Dictation words mastery tracker (known/needs-practice)
- Time-series chart of daily activities by subject

```typescript
interface ProgressEntry {
  childId: string;
  date: string;
  type: 'dictation' | 'revision' | 'homework' | 'rhyme' | 'shloka';
  itemId: string;
  status: 'not_started' | 'in_progress' | 'mastered';
  updatedAt: string;
}
```

### 1.2 Parent-Teacher Communication (`/messages`)

A read-only message feed from school/teacher via Google Sheets, with category filters and bookmarking.

### 1.3 Multi-Child / Multi-Class Support

```typescript
interface ChildProfile {
  id: string;
  name: string;
  nickname?: string;
  class: string;           // "PP3", "Grade 1"
  section?: string;
  school: string;
  academicYear: string;
  avatar?: string;
  dataSourceId: string;    // maps to a schedule dataset
}

interface UserProfile {
  children: ChildProfile[];
  activeChildId: string;
  preferences: UserPreferences;
}
```

UX: A child-switcher pill in the navigation bar. All data-fetching receives a `childId` parameter.

### 1.4 Enhanced Notifications (`/settings/notifications`)

Push notifications via Web Push API with configurable preferences:
- Morning reminder with today's first class
- Homework due reminder (evening before)
- New announcement alerts
- Weekly revision reminder (Friday evening)

### 1.5 Study Material Resources (`/resources`)

Curated library of supplementary materials organized by subject:
- YouTube video links for rhymes
- Printable worksheets (PDF)
- Practice activities grouped by subject
- Deep links from daily schedule items to related resources

### 1.6 Assessment / Quiz Features (`/quiz`)

Interactive quizzes derived from existing schedule data:
- Dictation word spelling quiz
- Math flash cards from Numeracy topics
- General awareness Q&A from `aiSuggestedRecap` questions
- Results stored locally, surfaced on `/progress` page

### 1.7 Photo Gallery (`/gallery`)

Shared gallery of school event photos:
- Grid layout with lazy-loaded images
- Filter by event/date
- Lightbox viewer
- Download/share capability

### 1.8 Report Card Integration (`/reports`)

Term-end assessment summaries (initially manual via admin, later integrated):

```typescript
interface ReportCard {
  childId: string;
  term: string;
  academicYear: string;
  subjects: { name: string; grade: string; remarks?: string; }[];
  teacherRemarks?: string;
  attendance: { totalDays: number; present: number; };
}
```

### 1.9 Attendance Tracking (`/attendance`)

Calendar view for marking daily attendance with monthly summaries. Extends the month calendar component.

---

## Part 2: Core Application Refactor

### 2.1 Data Layer Refactoring

**New directory structure:**

```
lib/
  dal/
    index.ts              # Public API re-exports
    types.ts              # All TypeScript interfaces (extracted from lib/data.ts)
    schedule-provider.ts  # Abstract interface for data sources
    static-provider.ts    # Current JSON-based implementation (dynamic imports)
    api-provider.ts       # Future: fetches from API endpoints
    announcements.ts      # Google Sheets CSV fetching (consolidated)
    cache.ts              # Client-side caching utilities
    utils.ts              # Date formatting, color mapping (extracted)
```

**Provider abstraction:**

```typescript
interface ScheduleProvider {
  getAvailableMonths(): Promise<MonthInfo[]>;
  getMonthData(monthId: string): Promise<MonthData>;
  getDaySchedule(date: string, monthId?: string): Promise<DaySchedule | null>;
  getWeekForDate(date: string, monthId?: string): Promise<WeekData | null>;
  getAllDates(monthId?: string): Promise<string[]>;
  getImportantDates(monthId?: string): Promise<ImportantDate[]>;
}
```

**Static provider with dynamic loading:** Replace static imports with `dynamic import()` via a registry. New months require only a JSON file + `months-index.json` entry (no code changes).

### 2.2 State Management Evolution

**New context structure:**

```
context/
  providers/
    index.tsx                # AppProviders: composes all providers
    ScheduleProvider.tsx     # Month selection, date selection, data loading
    UpdatesProvider.tsx      # Announcements (refactored from UpdatesContext)
    ChildProvider.tsx        # Active child profile, child switcher
    ProgressProvider.tsx     # Learning progress state
    PreferencesProvider.tsx  # User settings, notification prefs
  hooks/
    useSchedule.ts
    useUpdates.ts
    useChild.ts
    useProgress.ts
    usePreferences.ts
```

**ScheduleProvider** eliminates the duplicated `useEffect` chains from 5 page files:

```typescript
interface ScheduleContextType {
  availableMonths: MonthInfo[];
  selectedMonthId: string;
  setSelectedMonthId: (id: string) => void;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  dayData: DaySchedule | null;
  weekData: WeekData | null;
  monthData: MonthData | null;
  availableDates: string[];
  loading: boolean;
}
```

### 2.3 Component Architecture

**Reorganized component structure:**

```
components/
  ui/                          # Pure UI primitives (no business logic)
    Card.tsx
    Badge.tsx
    Modal.tsx                  # Extracted from RecentUpdates
    LoadingSkeleton.tsx        # Extracted from 5+ pages
    EmptyState.tsx
    ErrorBoundary.tsx
    SubjectTag.tsx
    DateBadge.tsx

  schedule/                    # Schedule-related
    DaySchedule.tsx
    WeekSelector.tsx           # Extracted from week/page.tsx
    DayNavigator.tsx           # Extracted from app/page.tsx
    MonthCalendar.tsx          # Extracted from month/page.tsx
    MonthSelector.tsx

  content/                     # Content display
    DictationWords.tsx
    WeekendRevision.tsx
    AISuggestedRecap.tsx
    RhymeCard.tsx              # Extracted from rhymes/page.tsx
    StoryCard.tsx
    ShlokaCard.tsx

  notifications/               # Notification-related
    RecentUpdates.tsx          # Refactored, split
    NotificationBanner.tsx
    HomeworkDuePopup.tsx
    UpdatesModal.tsx
    UpdateCard.tsx

  navigation/
    Navigation.tsx             # Enhanced with child switcher
    ChildSwitcher.tsx
    QuickLinks.tsx             # Extracted from home page
    InstallPrompt.tsx

  sharing/
    ShareButton.tsx
```

### 2.4 Authentication (Phased)

**Phase 1 - Local profiles:** `localStorage`-based `UserProfile` with `ChildProfile[]`. No login required.

**Phase 2 - Optional auth:** Auth.js v5 with Google OAuth. Profile sync to database on sign-in. Graceful degradation for unauthenticated users.

**Phase 3 - Role-based access:** Parent (view), Teacher (post), Admin (manage) roles. Replace hardcoded admin password.

### 2.5 API Layer

```
app/api/
  schedule/route.ts            # GET /api/schedule?monthId=...
  schedule/[date]/route.ts     # GET /api/schedule/2026-02-03
  announcements/route.ts       # GET /api/announcements
  homework/route.ts            # GET /api/homework
  progress/route.ts            # GET, POST /api/progress
  children/route.ts            # GET, POST /api/children
  resources/route.ts           # GET /api/resources?subject=...
  quiz/route.ts                # GET /api/quiz?type=dictation&weekId=...
  gallery/route.ts             # GET /api/gallery?event=...
  messages/route.ts            # GET, POST /api/messages
```

### 2.6 Routing Reorganization

```
app/
  (public)/                    # Unauthenticated pages
    login/page.tsx
    about/page.tsx

  (app)/                       # Main application (profiled)
    layout.tsx                 # AppProviders, Navigation, ChildSwitcher
    page.tsx                   # Home / Today
    week/page.tsx
    month/page.tsx
    homework/page.tsx
    dates/page.tsx
    rhymes/page.tsx
    nof/page.tsx
    progress/page.tsx          # New
    quiz/page.tsx              # New
    resources/page.tsx         # New
    messages/page.tsx          # New
    gallery/page.tsx           # New
    reports/page.tsx           # New
    attendance/page.tsx        # New
    settings/
      page.tsx
      notifications/page.tsx
      children/page.tsx

  (admin)/                     # Protected admin section
    layout.tsx                 # Auth middleware
    admin/page.tsx
    admin/announcements/page.tsx
    admin/resources/page.tsx
```

### 2.7 Feature Module Convention

```
features/
  progress/
    components/              # Feature-specific components
    hooks/                   # Feature-specific hooks
    lib/                     # Feature-specific utilities
    types.ts
    index.ts                 # Public API

  quiz/
    components/
    hooks/
    lib/quiz-generator.ts    # Generate quiz from schedule data
    types.ts
    index.ts

  gallery/
    components/
    hooks/
    types.ts
    index.ts
  ...
```

Pages become thin orchestrators:
```typescript
// app/(app)/progress/page.tsx
import { ProgressDashboard } from '@/features/progress';
export default function ProgressPage() {
  return <ProgressDashboard />;
}
```

### 2.8 Server Components Migration

Priority pages for migration (mostly static display):
1. `/rhymes` - static content
2. `/dates` - static content
3. `/month` - computation-heavy render, interactive on click
4. `/` - partial (fetch server-side, hydrate client-side)

---

## Part 3: Implementation Phases

### Phase 0: Foundation Cleanup

- **0.1**: Extract types to `lib/dal/types.ts` (move interfaces from `lib/data.ts` lines 9-104)
- **0.2**: Extract utilities to `lib/dal/utils.ts` (formatDate, getSubjectColor, etc.)
- **0.3**: Consolidate CSV parsing into `lib/dal/announcements.ts`, remove dead code from `lib/data.ts`
- **0.4**: Extract UI primitives (LoadingSkeleton, EmptyState, Modal, ErrorBoundary)
- **0.5**: Add error boundaries (`app/(app)/error.tsx`, `app/(app)/not-found.tsx`)

**Verification**: Existing Playwright tests pass. All functionality identical.

### Phase 1: Data Layer & State Management

- **1.1**: Create `ScheduleProvider` interface in `lib/dal/schedule-provider.ts`
- **1.2**: Implement `lib/dal/static-provider.ts` with dynamic imports and caching
- **1.3**: Create `context/providers/ScheduleProvider.tsx` centralizing month/date selection
- **1.4**: Refactor all 5 pages to use `useSchedule()` hook (reduce `page.tsx` from ~300 to ~100 lines)
- **1.5**: Create `context/providers/index.tsx` composition root, update `app/layout.tsx`

**Verification**: Pages render identically. Month switching, date navigation, deep links all work.

### Phase 2: Multi-Child Support & Local Profiles

- **2.1**: Create `ChildProvider.tsx` managing profiles in localStorage
- **2.2**: Create `ChildSwitcher.tsx` component in navigation
- **2.3**: Create settings page for child profile management
- **2.4**: Thread `childId` through the data layer
- **2.5**: Create `PreferencesProvider.tsx` for user settings

**Verification**: Multiple child profiles. Switching updates the app. Persists across refreshes.

### Phase 3: Progress Tracking

- **3.1**: Create `features/progress/` module (types, hooks, components)
- **3.2**: Create `ProgressProvider.tsx` managing progress in localStorage per child
- **3.3**: Create `/progress` page with dashboard, heatmap, dictation tracker
- **3.4**: Integrate with existing pages ("Mark as practiced" buttons, progress indicators)

### Phase 4: Quiz & Assessment

- **4.1**: Create `features/quiz/` module (DictationQuiz, MathFlashCards, RecapQuiz)
- **4.2**: Create `/quiz` page and sub-routes
- **4.3**: Integrate quiz results with progress tracking

### Phase 5: API Layer & Server Components

- **5.1**: Create API route handlers for schedule and announcements
- **5.2**: Migrate `/rhymes` and `/dates` to server components
- **5.3**: Create API routes for progress data sync

### Phase 6: Authentication

- **6.1**: Add Auth.js v5 with Google provider
- **6.2**: Add database (Vercel KV or Postgres/Drizzle)
- **6.3**: Replace hardcoded admin password with role-based auth
- **6.4**: Create login page with "continue without account" option

### Phase 7: Remaining Extensions

- **7.1**: Messages feature (Google Sheets tab)
- **7.2**: Gallery feature (photo grid, lightbox)
- **7.3**: Resources feature (study material library)
- **7.4**: Attendance tracking (calendar overlay)
- **7.5**: Report card view
- **7.6**: Push notifications (service worker, Web Push API)

### Phase 8: Polish & Performance

- **8.1**: Navigation reorganization (bottom tabs mobile, sidebar desktop)
- **8.2**: PWA enhancements (offline support, background sync)
- **8.3**: Performance optimization (code splitting, image optimization, Lighthouse)
- **8.4**: Testing expansion (Playwright for new features, unit tests for data layer)

---

## Target Directory Structure

```
schoolpulse/
  app/
    layout.tsx                         # Minimal: HTML shell, fonts, analytics
    globals.css
    (public)/
      layout.tsx
      login/page.tsx
      about/page.tsx
    (app)/
      layout.tsx                       # AppProviders, Navigation, ChildSwitcher
      page.tsx                         # Home (thin orchestrator)
      error.tsx
      not-found.tsx
      week/page.tsx
      month/page.tsx
      homework/page.tsx
      dates/page.tsx
      rhymes/page.tsx
      nof/page.tsx
      progress/page.tsx
      progress/[subject]/page.tsx
      quiz/page.tsx
      quiz/[type]/page.tsx
      resources/page.tsx
      resources/[id]/page.tsx
      messages/page.tsx
      gallery/page.tsx
      gallery/[eventId]/page.tsx
      reports/page.tsx
      attendance/page.tsx
      settings/page.tsx
      settings/notifications/page.tsx
      settings/children/page.tsx
    (admin)/
      layout.tsx
      admin/page.tsx
      admin/announcements/page.tsx
      admin/resources/page.tsx
      admin/data/page.tsx
    api/
      auth/[...nextauth]/route.ts
      schedule/route.ts
      schedule/[date]/route.ts
      announcements/route.ts
      homework/route.ts
      progress/route.ts
      children/route.ts
      resources/route.ts
      quiz/route.ts
      gallery/route.ts
      messages/route.ts
    actions.ts

  lib/
    dal/
      index.ts
      types.ts
      schedule-provider.ts
      static-provider.ts
      api-provider.ts
      announcements.ts
      cache.ts
      utils.ts

  context/
    providers/
      index.tsx
      ScheduleProvider.tsx
      UpdatesProvider.tsx
      ChildProvider.tsx
      ProgressProvider.tsx
      PreferencesProvider.tsx
    hooks/
      useSchedule.ts
      useUpdates.ts
      useChild.ts
      useProgress.ts
      usePreferences.ts

  features/
    progress/
      components/
      hooks/
      lib/
      types.ts
      index.ts
    quiz/
      components/
      hooks/
      lib/
      types.ts
      index.ts
    gallery/
      components/
      hooks/
      types.ts
      index.ts
    messages/
      components/
      hooks/
      types.ts
      index.ts
    resources/
      components/
      hooks/
      types.ts
      index.ts
    attendance/
      components/
      hooks/
      types.ts
      index.ts
    reports/
      components/
      types.ts
      index.ts

  components/
    ui/
      Card.tsx
      Badge.tsx
      Modal.tsx
      LoadingSkeleton.tsx
      DateBadge.tsx
      SubjectTag.tsx
      EmptyState.tsx
      ErrorBoundary.tsx
    schedule/
      DaySchedule.tsx
      WeekSelector.tsx
      DayNavigator.tsx
      MonthCalendar.tsx
      MonthSelector.tsx
    content/
      DictationWords.tsx
      WeekendRevision.tsx
      AISuggestedRecap.tsx
      RhymeCard.tsx
      StoryCard.tsx
      ShlokaCard.tsx
    notifications/
      RecentUpdates.tsx
      NotificationBanner.tsx
      HomeworkDuePopup.tsx
      UpdatesModal.tsx
      UpdateCard.tsx
    navigation/
      Navigation.tsx
      ChildSwitcher.tsx
      QuickLinks.tsx
      InstallPrompt.tsx
    sharing/
      ShareButton.tsx

  data/
    months-index.json
    november-2025.json
    december-2025.json
    january-2026.json
    february-2026.json
    resources/
      resources-index.json

  tests/
    smoke.spec.ts
    schedule.spec.ts
    progress.spec.ts
    quiz.spec.ts

  public/
    manifest.json
    sw.js
    icons/
    images/
```

## Key Technical Decisions

| Decision | Choice | Rationale |
|---|---|---|
| State management | Modular Context API | Read-heavy app; React 19 contexts perform well; no new deps |
| Data layer | Provider pattern + dynamic imports | Decouples from static JSON; enables future DB migration |
| Authentication | Auth.js v5 + Google OAuth | Parents already use Google; zero-friction sign-in |
| Database | Vercel KV (progress), Postgres/Drizzle (structured) | KV for key-value, Postgres for relational data |
| Feature organization | Feature modules in `features/` | Self-contained, testable, toggleable |
| Server components | Gradual migration, static pages first | `/rhymes`, `/dates` benefit most |
| API layer | Next.js Route Handlers | Already in framework; no separate backend |
| CSS | Keep Tailwind CSS 4 | Existing investment; rapid UI development |

---

## Critical Files for Phase 0

| File | Why | Action |
|---|---|---|
| `lib/data.ts` | Contains all types, data imports, and utilities coupled together | Decompose into `lib/dal/types.ts`, `lib/dal/static-provider.ts`, `lib/dal/utils.ts` |
| `app/layout.tsx` | Root layout must support route groups and AppProviders | Restructure for composition root |
| `context/UpdatesContext.tsx` | Template for all new providers | Refactor into `context/providers/UpdatesProvider.tsx` |
| `app/page.tsx` | 299 lines with duplicated state logic | Primary target for ScheduleProvider extraction |
| `app/actions.ts` | CSV parser and homework fetcher | Refactor to delegate to `lib/dal/announcements.ts` |
