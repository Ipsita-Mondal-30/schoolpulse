# SchoolPulse Multi-Class Architecture v2

> A senior architect's redesign. This document supersedes `MULTI_CLASS_ARCHITECTURE.md`.

---

## What the Previous Plan Got Wrong

Before diving in, let me be honest about the weaknesses in the v1 plan:

1. **Over-abstracted the data layer.** 6 files (`lib/dal/*`) to replace 1 file (`lib/data.ts`) is premature abstraction. The app loads JSON files -- that doesn't need a "provider pattern" or "schedule-loader" with "cache layers." It needs a function that takes a classId and returns data.

2. **4 nested React contexts is too many.** `UserProvider → ChildProvider → ScheduleProvider → UpdatesProvider` -- a parent and child provider doing separate things when they're really one concern (profile). And `ScheduleProvider` tries to own too much state (month selection, date selection, day data, week data) that different pages need at different times.

3. **Ignored the real operational problem.** The plan focused on app architecture but barely addressed the hardest ongoing cost: someone processing 10 PDFs per month into JSON. That's the bottleneck, not the React context tree.

4. **Treated onboarding as a separate route.** An `/onboarding` page with a redirect gate adds complexity. For a school app used by parents who get a link on WhatsApp, the simpler pattern is: class selector IS the landing page if you haven't picked yet.

5. **Invented features that weren't asked for.** Feature flags (`hasRhymes`, `hasShloka`), shared data directories, academic calendars -- complexity that doesn't solve the stated problem yet.

This v2 plan is ruthlessly minimal. Every decision is justified by what the app actually does today and what multi-class actually requires.

---

## Design Principles

1. **One moving part at a time.** Each phase changes exactly one layer of the stack. Data, then state, then UI. Never all three at once.

2. **Don't abstract before you need to.** If a function works with a `classId` parameter, that's enough. No interfaces, no provider patterns, no abstract base classes.

3. **Optimize for the monthly workflow.** The person adding data (you, processing PDFs) should be able to add a new month for a new class in under 2 minutes with zero code changes.

4. **Ship value at each phase.** Every phase produces a deployable improvement. No "infrastructure-only" phases that users can't see.

---

## Architecture Overview

```
                    ┌───────────────────────┐
                    │   PARENT'S BROWSER    │
                    │                       │
                    │   localStorage:       │
                    │   - activeClassId     │
                    │   - children[]        │
                    └──────────┬────────────┘
                               │
                    ┌──────────▼────────────┐
                    │    Next.js App        │
                    │                       │
                    │  ProfileProvider      │
                    │    └─ activeClassId   │
                    │    └─ children[]      │
                    │                       │
                    │  UpdatesProvider      │
                    │    └─ filtered by     │
                    │       activeClassId   │
                    │                       │
                    │  Pages call:          │
                    │    getMonthData(      │
                    │      classId, monthId │
                    │    )                  │
                    └──────────┬────────────┘
                               │
              ┌────────────────┼─────────────────┐
              │                │                  │
    ┌─────────▼──────┐ ┌──────▼───────┐ ┌───────▼────────┐
    │  data/pp3/     │ │ data/grade-1/│ │ Google Sheets  │
    │  jan-2026.json │ │ jan-2026.json│ │ (announcements │
    │  feb-2026.json │ │ feb-2026.json│ │  + homework)   │
    │  ...           │ │ ...          │ │                │
    └────────────────┘ └──────────────┘ └────────────────┘
```

**Two providers, not four.** `ProfileProvider` (who am I?) and `UpdatesProvider` (announcements). Data loading stays in pages -- they just pass `classId` to the data functions now.

---

## 1. Data Organization

### Directory structure

```
data/
  classes.json                    # Master registry (10 classes)
  pp3/
    months-index.json             # What months are available
    november-2025.json
    december-2025.json
    january-2026.json
    february-2026.json
  nursery/
    months-index.json
    february-2026.json
  lkg/
    months-index.json
    february-2026.json
  ...
  grade-7/
    months-index.json
    february-2026.json
```

### `data/classes.json`

Keep it simple. No feature flags yet -- derive them from the data itself:

```json
{
  "school": "BGS National Public School",
  "academicYear": "2025-26",
  "classes": [
    { "id": "nursery",  "name": "Nursery",       "order": 1 },
    { "id": "lkg",      "name": "LKG",           "order": 2 },
    { "id": "ukg",      "name": "UKG",           "order": 3 },
    { "id": "pp3",      "name": "PP3",           "order": 4 },
    { "id": "grade-1",  "name": "1st Standard",  "order": 5 },
    { "id": "grade-2",  "name": "2nd Standard",  "order": 6 },
    { "id": "grade-3",  "name": "3rd Standard",  "order": 7 },
    { "id": "grade-4",  "name": "4th Standard",  "order": 8 },
    { "id": "grade-5",  "name": "5th Standard",  "order": 9 },
    { "id": "grade-6",  "name": "6th Standard",  "order": 10 },
    { "id": "grade-7",  "name": "7th Standard",  "order": 11 }
  ]
}
```

**Why no feature flags?** In v1 we had `hasRhymes`, `hasShloka`, `hasDictation`. That's speculative. We don't know yet whether Grade 3 will have rhymes. Instead: if `monthData.rhymes.length > 0`, show the rhymes section. The data tells you. No config needed.

### Per-class `months-index.json`

Same as current `data/months-index.json` but scoped:

```json
{
  "months": [
    { "id": "february-2026", "month": "February", "year": 2026, "file": "february-2026.json" }
  ],
  "currentMonth": "february-2026"
}
```

### Month data JSON stays exactly the same

Zero changes to the schema. The existing `MonthData` interface works perfectly. The `class` field inside each JSON (`"class": "PP3"`) already self-identifies.

### Adding a new month for a new class

1. Process the PDF → `data/grade-3/march-2026.json`
2. Add entry to `data/grade-3/months-index.json`
3. `git push`

No code changes. No imports to update. No maps to edit.

---

## 2. Data Layer: Minimal Changes to `lib/data.ts`

### What the v1 plan got wrong

It wanted to replace `lib/data.ts` (445 lines) with 6 new files. That's over-engineering. The real problems are:

1. **Static imports** (lines 3-7): Must edit code to add months
2. **Hardcoded monthDataMap** (lines 107-112): No class dimension
3. **Dead code** (lines 286-445): Unused `getExternalUpdates()` duplicate
4. **No classId parameter** on any function

### What v2 does instead

**One file: `lib/data.ts` refactored in place.** Keep the same file, same exports, same function names -- just make them class-aware.

#### Step 1: Delete dead code

Remove lines 286-445 (`getExternalUpdates` duplicate). That cuts the file to ~285 lines.

#### Step 2: Replace static imports with dynamic loading

```typescript
// BEFORE (lib/data.ts lines 1-7):
import monthsIndex from '@/data/months-index.json';
import november2025 from '@/data/november-2025.json';
import december2025 from '@/data/december-2025.json';
import january2026 from '@/data/january-2026.json';
import february2026 from '@/data/february-2026.json';

// AFTER:
import classesData from '@/data/classes.json';
// Everything else loaded dynamically
```

#### Step 3: Replace `monthDataMap` with async class-aware loader

```typescript
// BEFORE (lib/data.ts lines 107-112):
const monthDataMap: Record<string, MonthData> = {
  'november-2025': november2025 as MonthData,
  ...
};

// AFTER:
// Two-level cache: classId → monthId → MonthData
const cache: Record<string, Record<string, MonthData>> = {};
const indexCache: Record<string, MonthsIndex> = {};

async function loadMonthIndex(classId: string): Promise<MonthsIndex> {
  if (indexCache[classId]) return indexCache[classId];
  const mod = await import(`@/data/${classId}/months-index.json`);
  indexCache[classId] = mod.default || mod;
  return indexCache[classId];
}

async function loadMonthData(classId: string, monthId: string): Promise<MonthData> {
  if (!cache[classId]) cache[classId] = {};
  if (cache[classId][monthId]) return cache[classId][monthId];
  const mod = await import(`@/data/${classId}/${monthId}.json`);
  cache[classId][monthId] = mod.default || mod;
  return cache[classId][monthId];
}
```

#### Step 4: Add `classId` to every function

```typescript
// BEFORE:
export function getMonthData(monthId?: string): MonthData { ... }
export function getDaySchedule(date: string, monthId?: string): DaySchedule | null { ... }
export function getAvailableMonths(): MonthInfo[] { ... }

// AFTER: (all async now)
export async function getMonthData(classId: string, monthId?: string): Promise<MonthData> {
  const id = monthId || await getCurrentMonthId(classId);
  return loadMonthData(classId, id);
}

export async function getDaySchedule(classId: string, date: string, monthId?: string): Promise<DaySchedule | null> {
  const data = await getMonthData(classId, monthId);
  for (const week of data.weeks) {
    const day = week.days.find(d => d.date === date);
    if (day) return day;
  }
  return null;
}

export async function getAvailableMonths(classId: string): Promise<MonthInfo[]> {
  const index = await loadMonthIndex(classId);
  return index.months;
}

// NEW: class registry
export function getAllClasses(): ClassEntry[] {
  return classesData.classes;
}

export function getSchoolName(): string {
  return classesData.school;
}
```

#### What stays the same

All utility functions (no class dependency):
- `formatDate()`, `formatShortDate()`, `getToday()`, `getSubjectColor()`, `toLocalDateString()`
- All interfaces (`ScheduleItem`, `DaySchedule`, `WeekData`, `MonthData`, etc.)

#### New interfaces added to `lib/data.ts`

```typescript
export interface ClassEntry {
  id: string;
  name: string;
  order: number;
}

export interface ChildProfile {
  id: string;
  name: string;
  classId: string;
  section?: string;
}

export interface UserProfile {
  children: ChildProfile[];
  activeChildId: string;
}
```

**Total change: ~80 lines modified in one file.** Not 6 new files.

---

## 3. Profile & Onboarding: One Provider, No Redirect

### What the v1 plan got wrong

It proposed separate `UserProvider` + `ChildProvider` + an `OnboardingGate` component + an `/onboarding` route. That's 4 pieces for something simple: "which class does this parent want to see?"

### What v2 does instead

**One `ProfileProvider`. No separate onboarding route.**

```typescript
// context/ProfileContext.tsx

interface ProfileContextType {
  // Profile data
  children: ChildProfile[];
  activeChild: ChildProfile | null;
  activeClassId: string | null;

  // Actions
  addChild: (name: string, classId: string, section?: string) => void;
  removeChild: (childId: string) => void;
  switchChild: (childId: string) => void;

  // Status
  isSetUp: boolean;  // true if at least one child exists
}
```

### How onboarding works (no redirect)

Instead of a gate + redirect to `/onboarding`, the home page itself handles it:

```typescript
// app/page.tsx (simplified)
function HomeContent() {
  const { isSetUp, activeClassId } = useProfile();

  // No profile yet? Show the setup form inline
  if (!isSetUp) {
    return <SetupForm />;
  }

  // Profile exists? Show the schedule
  const monthData = await getMonthData(activeClassId!, selectedMonthId);
  // ... render schedule ...
}
```

**Why this is better:**
- No route redirect (avoids flash of content, URL stays `/`)
- No `OnboardingGate` wrapper component
- Parent arrives via WhatsApp link → sees setup form → fills it → immediately sees schedule
- Same page, same URL, no navigation complexity

### The Setup Form

```
┌─────────────────────────────────────────┐
│                                         │
│  Welcome to SchoolPulse                 │
│  BGS National Public School             │
│                                         │
│  Your child's name                      │
│  ┌─────────────────────────────────┐    │
│  │ e.g. Aarav                      │    │
│  └─────────────────────────────────┘    │
│                                         │
│  Select class                           │
│  ┌─────────────────────────────────┐    │
│  │ ○ Nursery                       │    │
│  │ ○ LKG                           │    │
│  │ ○ UKG                           │    │
│  │ ● PP3                           │    │
│  │ ○ 1st Standard                  │    │
│  │ ○ 2nd Standard                  │    │
│  │ ○ ...                           │    │
│  │ ○ 7th Standard                  │    │
│  └─────────────────────────────────┘    │
│                                         │
│  Section (optional)                     │
│  ┌──────┐                               │
│  │ A    │                               │
│  └──────┘                               │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │     Start Using SchoolPulse →   │    │
│  └─────────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

After submission: profile saved to localStorage, page rerenders, schedule appears.

### Adding a second child

In settings (`/settings`), not during onboarding. Keep the first-time flow dead simple (one child, no "add another?" step).

```
/settings page:
┌─────────────────────────────────────┐
│ Your Children                       │
│                                     │
│  👦 Aarav - PP3 Section A     [✎] │
│                                     │
│  [+ Add Another Child]             │
│                                     │
│  [Reset Profile]                    │
└─────────────────────────────────────┘
```

### localStorage structure

```json
// key: "schoolpulse_profile"
{
  "children": [
    { "id": "abc123", "name": "Aarav", "classId": "pp3", "section": "A" },
    { "id": "def456", "name": "Ananya", "classId": "grade-3" }
  ],
  "activeChildId": "abc123"
}
```

That's it. No `UserProfile.id`, no `createdAt`, no `onboardingComplete` flag. If `children.length > 0`, setup is complete. If `activeChildId` exists, we know which class to load.

---

## 4. State Architecture: Two Providers, Not Four

### Why not a ScheduleProvider?

The v1 plan proposed a `ScheduleProvider` that holds month selection, date selection, day/week data -- everything. The problem:

- **Different pages need different state.** The Home page needs `selectedDate` + day navigation. The Month page needs a calendar grid. The Rhymes page only needs month selection. Stuffing all of this into one god-provider means every page re-renders when ANY state changes.

- **URL parameters conflict with context.** The Home page uses `?date=` URL params. The Week page uses `?month=` params. A central ScheduleProvider would fight with `useSearchParams`.

- **Pages become dumb.** When all logic is in the provider, pages lose their purpose. A 100-line page that just destructures from context is not simpler -- it's just indirection.

### The v2 approach: Two providers + smart pages

```
<ProfileProvider>          ← WHO: active child + classId
  <UpdatesProvider>        ← WHAT: announcements (filtered by classId)
    <Navigation />
    <Page />               ← HOW: each page manages its own month/date state
  </UpdatesProvider>                using classId from ProfileProvider
</ProfileProvider>
```

**ProfileProvider** owns: `children`, `activeChild`, `activeClassId`, `isSetUp`
**UpdatesProvider** owns: `updates` (filtered by `activeClassId`), `homeworkCount`
**Pages** own: their own `selectedMonthId`, `selectedDate`, loaded data

### How pages change

Each page already has its own month/date state. The ONLY change is passing `classId` to data functions:

```typescript
// BEFORE (app/page.tsx line 93):
const data = getMonthData(selectedMonthId);

// AFTER:
const { activeClassId } = useProfile();
const data = await getMonthData(activeClassId!, selectedMonthId);
```

That's a 1-line change per data call, not a full rewrite to `useSchedule()`.

**But wait -- the duplicated useEffect pattern across 5 pages?**

Yes, it's still duplicated. And that's OK for now. Here's why:

1. The duplication is ~15 lines of month-init + date-selection per page. Not 100 lines.
2. Each page's logic is slightly different (Home has URL date params, Month builds a calendar grid, Rhymes loads rhymes/shloka/story separately).
3. Extracting to a shared hook is a valid future improvement but NOT a prerequisite for multi-class.
4. Premature DRY is worse than a little repetition.

**If we later want to DRY it up**, a `useMonthSelection(classId)` custom hook is ~20 lines:

```typescript
// lib/hooks/useMonthSelection.ts (FUTURE, not Phase 1)
export function useMonthSelection(classId: string) {
  const [availableMonths, setAvailableMonths] = useState<MonthInfo[]>([]);
  const [selectedMonthId, setSelectedMonthId] = useState('');

  useEffect(() => {
    getAvailableMonths(classId).then(months => {
      setAvailableMonths(months);
      getCurrentMonthId(classId).then(setSelectedMonthId);
    });
  }, [classId]);

  return { availableMonths, selectedMonthId, setSelectedMonthId };
}
```

Pages use this to eliminate ~10 lines each. But it's an optimization, not a blocker.

---

## 5. Routing: No Route Groups, No Page Moves

### What the v1 plan got wrong

It wanted to reorganize every page into `app/(app)/page.tsx`, `app/(app)/week/page.tsx`, etc. with a new layout. That's a lot of file moves for zero user benefit.

### What v2 does instead

**Pages stay exactly where they are.** No `(app)` route group. No file moves.

```
app/
  layout.tsx          # Modified: ProfileProvider + UpdatesProvider
  page.tsx            # Modified: reads classId, shows setup if needed
  week/page.tsx       # Modified: reads classId
  month/page.tsx      # Modified: reads classId
  homework/page.tsx   # Modified: already uses UpdatesProvider (filtered)
  dates/page.tsx      # Modified: reads classId
  rhymes/page.tsx     # Modified: reads classId
  nof/page.tsx        # Unchanged (hardcoded NOF data, not class-specific)
  admin/page.tsx      # Modified: env var password, class selector
  settings/
    page.tsx          # NEW: manage children
```

**Why?**
- Moving files creates merge conflicts with any parallel work
- Route groups add cognitive overhead ("is this page in `(app)` or `(public)`?")
- The onboarding "gate" is handled by `page.tsx` itself, not a layout wrapper
- One new route (`/settings`) is all we need

### URL structure

```
/                    → Home (setup form if not configured, schedule if configured)
/week                → Weekly view
/month               → Monthly calendar
/homework            → Homework tracker
/dates               → Important dates
/rhymes              → Rhymes & Shloka
/nof                 → NOF Olympiad
/settings            → Manage children profiles
/admin               → Admin panel
```

URLs don't change. Bookmarks don't break. Parents don't notice the refactor.

---

## 6. Layout Changes

### `app/layout.tsx`

```typescript
// BEFORE:
<UpdatesProvider>
  <Navigation />
  <HomeworkDuePopup />
  <main>{children}</main>
  <footer>
    <div>BGS National Public School</div>
    <div>Currently showing PP3 planner only</div>
  </footer>
</UpdatesProvider>

// AFTER:
<ProfileProvider>
  <UpdatesProvider>
    <Navigation />
    <HomeworkDuePopup />
    <main>{children}</main>
    <DynamicFooter />
  </UpdatesProvider>
</ProfileProvider>
```

### `DynamicFooter` component

```typescript
function DynamicFooter() {
  const { activeChild, isSetUp } = useProfile();
  return (
    <footer className="bg-white border-t border-gray-200 py-4">
      <div className="max-w-4xl mx-auto px-4 text-center text-sm text-gray-500">
        <div className="font-semibold text-orange-600">SchoolPulse</div>
        <div>{getSchoolName()}</div>
        {isSetUp && activeChild && (
          <div className="text-xs text-gray-400 mt-1">
            Showing schedule for {activeChild.name} ({getClassName(activeChild.classId)})
          </div>
        )}
      </div>
    </footer>
  );
}
```

---

## 7. Navigation Changes

### Current Navigation

```
📖 Today | 7️⃣ Week | 📚 Homework | 🗓️ Month | 🔔 Events | 🎵 Rhymes
```

### Updated Navigation

```
┌────────────────────────────────────────────────────────────┐
│ 💓 SchoolPuls  [👦 Aarav · PP3 ▾]  📖 7️⃣ 📚 🗓️ 🔔 🎵 ⚙️  │
└────────────────────────────────────────────────────────────┘
```

Changes:
1. **Child/class indicator** between logo and nav links
2. **Dropdown** (if 2+ children) to switch active child
3. **Settings gear** icon linking to `/settings`
4. **Rhymes link conditional**: only show if current month data has rhymes

```typescript
// In Navigation.tsx
const { activeChild, children } = useProfile();
const [monthData, setMonthData] = useState<MonthData | null>(null);

// Conditionally show Rhymes based on data, not config
const showRhymes = monthData && monthData.rhymes && monthData.rhymes.length > 0;

const links = [
  { href: '/', label: 'Today', icon: '📖' },
  { href: '/week', label: 'Week', icon: '7️⃣' },
  { href: '/homework', label: 'Homework', icon: '📚' },
  { href: '/month', label: 'Month', icon: '🗓️' },
  { href: '/dates', label: 'Events', icon: '🔔' },
  ...(showRhymes ? [{ href: '/rhymes', label: 'Rhymes', icon: '🎵' }] : []),
];
```

### Child Switcher

If parent has 2+ children:

```
Clicking "Aarav · PP3 ▾" opens:

┌──────────────────────────┐
│  ✓ 👦 Aarav · PP3        │
│    👧 Ananya · 3rd Std   │
│  ─────────────────────── │
│  ⚙️ Manage Children       │
└──────────────────────────┘
```

Switching triggers `switchChild(childId)` → ProfileProvider updates `activeChildId` → `activeClassId` changes → page re-renders with new class data.

---

## 8. Announcement & Homework Filtering

### Google Sheets: Add `Target Class` column

```
| Status | Category | Title           | ... | Target Class |
|--------|----------|-----------------|-----|--------------|
| Active | Homework | Math worksheet  | ... | pp3          |
| Active | Holiday  | Republic Day    | ... |              |  ← all classes
| Active | School   | PP3 Graduation  | ... | pp3          |
| Active | Homework | Essay writing   | ... | grade-5      |
```

### CSV parser change (in `app/actions.ts`)

Add one field to `headerMap`:

```typescript
const headerMap = {
  ...existing,
  targetClass: row0.indexOf('target class'),  // NEW
};

// In the mapping:
return {
  ...existing,
  targetClass: row[headerMap.targetClass]?.trim().toLowerCase() || '',
};
```

### `Announcement` interface gets one field

```typescript
export interface Announcement {
  // ... all existing fields stay ...
  targetClass?: string;  // NEW: "pp3", "grade-1", or "" for all
}
```

### `UpdatesProvider` filtering

```typescript
// context/UpdatesContext.tsx (modified)
export function UpdatesProvider({ children }: { children: ReactNode }) {
  const { activeClassId } = useProfile();
  const [allUpdates, setAllUpdates] = useState<Announcement[]>([]);

  // ... existing fetch logic ...

  // Filter for active class
  const updates = useMemo(() => {
    if (!activeClassId) return allUpdates;
    return allUpdates.filter(u =>
      !u.targetClass || u.targetClass === activeClassId
    );
  }, [allUpdates, activeClassId]);

  // ... rest stays the same ...
}
```

**The homework page needs zero changes.** It already filters from `updates` context, which is now class-filtered upstream.

---

## 9. Page-by-Page Changes

### `app/page.tsx` (Home)

**Changes:** Add setup gate + pass classId to data functions.

```typescript
function HomeContent() {
  const { isSetUp, activeClassId } = useProfile();

  // Not set up? Show setup form
  if (!isSetUp) return <SetupForm />;

  // Everything else stays the same, just async + classId:
  useEffect(() => {
    if (!activeClassId) return;
    getAvailableMonths(activeClassId).then(setAvailableMonths);
    getCurrentMonthId(activeClassId).then(setSelectedMonthId);
  }, [activeClassId]);

  useEffect(() => {
    if (!selectedMonthId || !activeClassId) return;
    getMonthData(activeClassId, selectedMonthId).then(data => {
      setMonthData({ month: data.month, year: data.year, class: data.class });
      // ... same as before ...
    });
  }, [selectedMonthId, activeClassId]);

  // ... render stays identical ...
}
```

### `app/week/page.tsx`

**Changes:** The hardest-coupled page. Currently calls `getMonthData()` with NO args.

```typescript
// BEFORE (line 15):
const data = getMonthData();

// AFTER:
const { activeClassId } = useProfile();
useEffect(() => {
  if (!activeClassId) return;
  getMonthData(activeClassId).then(data => {
    setWeeks(data.weeks);
    setMonthInfo({ month: data.month, year: data.year });
    // ... same week-finding logic ...
  });
}, [activeClassId]);
```

### `app/month/page.tsx`, `app/dates/page.tsx`, `app/rhymes/page.tsx`

Same pattern: add `const { activeClassId } = useProfile()` and pass it to data functions. ~5 lines changed per file.

### `app/homework/page.tsx`

**Zero changes needed.** It reads from `useUpdates()` which is now class-filtered by `UpdatesProvider`.

### `app/nof/page.tsx`

**Zero changes.** NOF data is hardcoded in the page (not from JSON).

### `app/admin/page.tsx`

**Changes:**
1. Password from env: `const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'change-me';`
2. Add class selector dropdown to announcement form
3. Store `targetClass` on created announcements

---

## 10. PDF Processing Pipeline

### The real bottleneck

Currently: you get 1 PDF per month, process it into JSON. With 10 classes: 10 PDFs per month.

### Script changes

```bash
# BEFORE:
python process-newsletter.py newslet.pdf february 2026

# AFTER:
python process-newsletter.py newslet.pdf february 2026 pp3
python process-newsletter.py newslet.pdf february 2026 grade-3
```

Changes to `scripts/process-newsletter.py`:

```python
# Add class argument
if len(sys.argv) < 5:
    print("Usage: python process-newsletter.py <pdf_path> <month> <year> <class_id>")
    sys.exit(1)

class_id = sys.argv[4]

# Output path changes:
output_file = f"../data/{class_id}/{month.lower()}-{year}.json"

# Template JSON uses class_id:
def create_template_json(month, year, class_id):
    class_names = {
        'nursery': 'Nursery', 'lkg': 'LKG', 'ukg': 'UKG', 'pp3': 'PP3',
        'grade-1': '1st Standard', ...
    }
    return {
        "month": month.capitalize(),
        "year": int(year),
        "class": class_names.get(class_id, class_id),
        "school": "BGS National Public School",
        ...
    }
```

### Validate before deploy

New script `scripts/validate-data.sh`:

```bash
#!/bin/bash
# Validate all class data directories
for CLASS_DIR in data/*/; do
  CLASS=$(basename "$CLASS_DIR")
  [ "$CLASS" = "shared" ] && continue

  INDEX="$CLASS_DIR/months-index.json"
  if [ ! -f "$INDEX" ]; then
    echo "WARN: $CLASS has no months-index.json"
    continue
  fi

  # Check each month file referenced in index exists
  for FILE in $(python3 -c "import json; d=json.load(open('$INDEX')); [print(m['file']) for m in d['months']]"); do
    if [ ! -f "$CLASS_DIR/$FILE" ]; then
      echo "ERROR: $CLASS_DIR/$FILE referenced in index but missing!"
    fi
  done
done
echo "Validation complete."
```

### Auto-update months-index.json

New script `scripts/update-index.sh`:

```bash
#!/bin/bash
# Auto-generate months-index.json for a class from its JSON files
CLASS_ID=$1
CLASS_DIR="data/$CLASS_ID"

python3 -c "
import json, os, glob

files = sorted(glob.glob('$CLASS_DIR/*.json'))
files = [f for f in files if 'months-index' not in f]

months = []
for f in files:
    data = json.load(open(f))
    basename = os.path.basename(f)
    month_id = basename.replace('.json', '')
    months.append({
        'id': month_id,
        'month': data['month'],
        'year': data['year'],
        'file': basename
    })

# Sort by year then month
months.sort(key=lambda m: f\"{m['year']}-{m['id']}\")

index = {
    'months': months,
    'currentMonth': months[-1]['id'] if months else ''
}

with open('$CLASS_DIR/months-index.json', 'w') as f:
    json.dump(index, f, indent=2)
print(f'Updated $CLASS_DIR/months-index.json with {len(months)} months')
"
```

Usage: `./scripts/update-index.sh pp3`

**This means the monthly workflow is:**

```bash
# 1. Process the PDF
python scripts/process-newsletter.py newsletter.pdf march 2026 pp3

# 2. Auto-update the index (or do it manually)
./scripts/update-index.sh pp3

# 3. Deploy
git add data/pp3/ && git commit -m "Add March 2026 PP3 data" && git push
```

---

## 11. Migration Plan

### Phase 1: Data Move (no code changes, no user impact)

1. Create `data/classes.json`
2. Create `data/pp3/` directory
3. **Copy** existing JSON files to `data/pp3/`
4. Create `data/pp3/months-index.json`
5. Keep original files (backward compat)

```bash
mkdir -p data/pp3
cp data/november-2025.json data/pp3/
cp data/december-2025.json data/pp3/
cp data/january-2026.json data/pp3/
cp data/february-2026.json data/pp3/
# Create data/pp3/months-index.json
# Create data/classes.json
```

**Deploy.** App still works from old paths. New paths ready for Phase 2.

### Phase 2: Data Layer (async + classId)

1. Refactor `lib/data.ts`:
   - Delete dead code (lines 286-445)
   - Replace static imports with dynamic `import()`
   - Add `classId` parameter to all data functions
   - Make them async (returns Promises)
   - Add `getAllClasses()` and `getSchoolName()`
2. Update all 5 pages to:
   - Use `await` / `.then()` on data calls
   - Pass `classId` (hardcoded to `'pp3'` for now)
3. Delete old flat `data/*.json` files and `data/months-index.json`

**Deploy.** App works exactly as before. All users see PP3. But data layer is now class-ready.

### Phase 3: Profile + Multi-class (the user-facing change)

1. Create `context/ProfileContext.tsx` (ProfileProvider + useProfile hook)
2. Create `components/SetupForm.tsx`
3. Update `app/layout.tsx` to wrap with ProfileProvider
4. Update `app/page.tsx` to show SetupForm if `!isSetUp`, else show schedule
5. Update all pages to use `useProfile().activeClassId` instead of hardcoded `'pp3'`
6. Update `components/Navigation.tsx` with child indicator + settings link
7. Create `app/settings/page.tsx` for child management

**Deploy.** First time users see setup form. Existing PP3 users who clear localStorage will too. This is the big visible change.

### Phase 4: Child Switching + Announcements

1. Add child switcher dropdown to Navigation
2. Add `targetClass` column to Google Sheet
3. Update `app/actions.ts` to parse `targetClass`
4. Update `UpdatesProvider` to filter by `activeClassId`
5. Update admin page with class selector + env var password

**Deploy.** Parents with multiple children can switch. Announcements are class-scoped.

### Phase 5: Data Population

1. Update `scripts/process-newsletter.py` with `class_id` parameter
2. Create `scripts/update-index.sh` and `scripts/validate-data.sh`
3. Create class directories for each class being added
4. Process available PDFs for those classes
5. Create `app/settings/page.tsx` with "add another child" functionality

**Deploy.** Multi-class is live with real data.

---

## 12. What This Architecture Intentionally Defers

| Feature | Why defer | When to add |
|---------|-----------|-------------|
| Feature flags (`hasRhymes` etc.) | Derive from data. If `rhymes.length > 0`, show. | When you have 3+ classes and see clear patterns |
| `data/shared/` directory | Holidays are already in each month's JSON. Duplication is fine. | When you have a backend that canonically owns holidays |
| Route groups `(app)/` | No value without auth. Pages work fine at current paths. | When you add real authentication |
| Server components | All pages are `'use client'` and that's fine for a PWA | When you need SEO or have large static content |
| Database (Postgres, KV) | localStorage works. Data doesn't need to sync yet. | When school admin backend is built |
| Auth (Auth.js, Google OAuth) | Parents don't want to log in. | When you need cross-device sync or teacher role |
| `ScheduleProvider` | Pages manage their own state fine. Little duplication is OK. | When you have 10+ pages sharing identical state |
| Push notifications | Requires service worker and backend push server | When you have a backend |
| `lib/dal/` directory split | One file refactored in place is simpler | When `lib/data.ts` exceeds 500 lines |

---

## 13. File Change Summary

### New files (8 files)

```
data/classes.json                          # Class registry
data/pp3/months-index.json                 # PP3 month index
data/pp3/*.json                            # Copied from data/ (4 files)
context/ProfileContext.tsx                  # Profile provider
components/SetupForm.tsx                   # First-time setup
app/settings/page.tsx                      # Child management
scripts/update-index.sh                    # Auto-generate months-index
scripts/validate-data.sh                   # Validate data integrity
```

### Modified files (9 files)

```
lib/data.ts                                # Async + classId + delete dead code
app/layout.tsx                             # Add ProfileProvider, dynamic footer
app/page.tsx                               # Setup gate + classId
app/week/page.tsx                          # classId
app/month/page.tsx                         # classId
app/dates/page.tsx                         # classId
app/rhymes/page.tsx                        # classId
components/Navigation.tsx                  # Child indicator + settings link
context/UpdatesContext.tsx                 # Class filtering
app/actions.ts                             # Parse targetClass column
app/admin/page.tsx                         # Env var password + class selector
scripts/process-newsletter.py              # Accept class parameter
```

### Deleted files (after migration)

```
data/november-2025.json                    # Moved to data/pp3/
data/december-2025.json                    # Moved to data/pp3/
data/january-2026.json                     # Moved to data/pp3/
data/february-2026.json                    # Moved to data/pp3/
data/months-index.json                     # Replaced by per-class indexes
```

### Unchanged files (12 files)

```
components/DaySchedule.tsx
components/DictationWords.tsx
components/WeekendRevision.tsx
components/AISuggestedRecap.tsx
components/MonthSelector.tsx
components/ImportantDates.tsx
components/ShareButton.tsx
components/NotificationBanner.tsx
components/HomeworkDuePopup.tsx
components/InstallPrompt.tsx
components/RecentUpdates.tsx
app/nof/page.tsx
```

---

## 14. Success Metrics

After all phases are complete:

- [ ] New user visits `/` → sees class selection → picks PP3 → sees today's schedule
- [ ] Parent adds 2nd child (Grade 3) → child switcher appears in nav
- [ ] Switching children reloads all pages with correct class data
- [ ] Adding a new month = 1 JSON file + `update-index.sh` + deploy
- [ ] Adding a new class = 1 directory + `classes.json` entry
- [ ] Class-specific homework only shows for that class
- [ ] School-wide announcements show for all classes
- [ ] Existing PP3 URLs (`/?date=2026-02-03`) still work
- [ ] No increase in bundle size for single-class usage (dynamic imports)
- [ ] Total new code: ~300 lines. Total deleted code: ~200 lines (dead CSV parser + old imports)
