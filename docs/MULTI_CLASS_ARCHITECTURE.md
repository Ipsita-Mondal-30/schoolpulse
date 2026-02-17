# SchoolPulse: Multi-Class Architecture Plan

> Transform SchoolPulse from a single-class PP3 app into a school-wide platform
> supporting Nursery through 7th Standard (~10 classes).

---

## Table of Contents

1. [The Problem](#1-the-problem)
2. [Data Organization Strategy](#2-data-organization-strategy)
3. [Registration & Onboarding Flow](#3-registration--onboarding-flow)
4. [Class-Aware Data Layer](#4-class-aware-data-layer)
5. [Context & State Architecture](#5-context--state-architecture)
6. [Routing Strategy](#6-routing-strategy)
7. [Component Changes](#7-component-changes)
8. [Announcement & Homework Filtering](#8-announcement--homework-filtering)
9. [Admin Panel Evolution](#9-admin-panel-evolution)
10. [PDF Processing Script Changes](#10-pdf-processing-script-changes)
11. [Migration Strategy](#11-migration-strategy)
12. [Complete File Map](#12-complete-file-map)

---

## 1. The Problem

### What exists today

Every piece of the app assumes ONE class (PP3) at ONE school:

| Where | What's hardcoded | File:Line |
|-------|-----------------|-----------|
| Data files | `"class": "PP3"` in every JSON | `data/*.json:4` |
| Data layer | Static imports of 4 month files | `lib/data.ts:3-7` |
| Data map | Hardcoded `monthDataMap` with 4 entries | `lib/data.ts:107-112` |
| Month index | No class dimension at all | `data/months-index.json` |
| Footer | "Currently showing PP3 planner only" | `app/layout.tsx:64` |
| Footer | "BGS National Public School" | `app/layout.tsx:63` |
| Navigation | No class indicator, no user profile | `components/Navigation.tsx` |
| Week page | `getMonthData()` with NO args (global) | `app/week/page.tsx:15` |
| All 5 pages | Same duplicated month-loading useEffect | `app/page.tsx`, `week/`, `month/`, `rhymes/`, `dates/` |
| Admin | Hardcoded password `sreeavyu` | `app/admin/page.tsx:7` |
| Announcements | No class filtering at all | `context/UpdatesContext.tsx` |
| PDF script | `"class": "PP3"` hardcoded in output | `scripts/process-newsletter.py:88` |

### What we need

- **10 classes**: Nursery, LKG, UKG, PP3, 1st through 7th Standard
- **Per-class monthly data**: Each class gets its own PDF → JSON per month
- **User registration**: Parent picks their child's class on first visit
- **Multiple children**: Parent with kids in PP3 + 3rd Standard sees both
- **Class-filtered content**: Announcements, homework, schedule all scoped by class
- **Future-ready**: Architecture allows a school admin backend later

---

## 2. Data Organization Strategy

### 2.1 Directory Structure

Currently all months live flat in `data/`. With 10 classes × 12 months = 120 files/year, we need class-based directories:

```
data/
  school.json                          # School metadata (NEW)
  classes.json                         # Class registry (NEW)

  pp3/                                 # One directory per class
    months-index.json                  # Months available for PP3
    november-2025.json                 # Existing files MOVE here
    december-2025.json
    january-2026.json
    february-2026.json

  nursery/
    months-index.json
    february-2026.json

  lkg/
    months-index.json
    february-2026.json

  ukg/
    months-index.json
    february-2026.json

  grade-1/
    months-index.json
    february-2026.json

  grade-2/
    months-index.json
    ...

  grade-3/ ... grade-7/
    months-index.json
    ...

  shared/                              # School-wide data (NEW)
    holidays-2025-26.json              # Common holidays across classes
    academic-calendar.json             # Academic year schedule
```

### 2.2 New: `data/school.json`

```json
{
  "name": "BGS National Public School",
  "shortName": "BGS NPS",
  "academicYear": "2025-26",
  "location": "Bangalore",
  "logo": "/icons/school-logo.png"
}
```

### 2.3 New: `data/classes.json`

This is the master registry of all supported classes:

```json
{
  "classes": [
    {
      "id": "nursery",
      "name": "Nursery",
      "shortName": "NUR",
      "grade": 0,
      "category": "pre-primary",
      "dataDir": "nursery",
      "hasSchedule": true,
      "hasRhymes": true,
      "hasShloka": true,
      "hasDictation": false
    },
    {
      "id": "lkg",
      "name": "LKG",
      "shortName": "LKG",
      "grade": 0,
      "category": "pre-primary",
      "dataDir": "lkg",
      "hasSchedule": true,
      "hasRhymes": true,
      "hasShloka": true,
      "hasDictation": false
    },
    {
      "id": "ukg",
      "name": "UKG",
      "shortName": "UKG",
      "grade": 0,
      "category": "pre-primary",
      "dataDir": "ukg",
      "hasSchedule": true,
      "hasRhymes": true,
      "hasShloka": true,
      "hasDictation": true
    },
    {
      "id": "pp3",
      "name": "PP3",
      "shortName": "PP3",
      "grade": 0,
      "category": "pre-primary",
      "dataDir": "pp3",
      "hasSchedule": true,
      "hasRhymes": true,
      "hasShloka": true,
      "hasDictation": true
    },
    {
      "id": "grade-1",
      "name": "1st Standard",
      "shortName": "1st",
      "grade": 1,
      "category": "primary",
      "dataDir": "grade-1",
      "hasSchedule": true,
      "hasRhymes": false,
      "hasShloka": true,
      "hasDictation": true
    },
    {
      "id": "grade-2",
      "name": "2nd Standard",
      "shortName": "2nd",
      "grade": 2,
      "category": "primary",
      "dataDir": "grade-2",
      "hasSchedule": true,
      "hasRhymes": false,
      "hasShloka": true,
      "hasDictation": true
    },
    {
      "id": "grade-3",
      "name": "3rd Standard",
      "shortName": "3rd",
      "grade": 3,
      "category": "primary",
      "dataDir": "grade-3",
      "hasSchedule": true,
      "hasRhymes": false,
      "hasShloka": true,
      "hasDictation": true
    },
    {
      "id": "grade-4",
      "name": "4th Standard",
      "shortName": "4th",
      "grade": 4,
      "category": "middle",
      "dataDir": "grade-4",
      "hasSchedule": true,
      "hasRhymes": false,
      "hasShloka": false,
      "hasDictation": true
    },
    {
      "id": "grade-5",
      "name": "5th Standard",
      "shortName": "5th",
      "grade": 5,
      "category": "middle",
      "dataDir": "grade-5",
      "hasSchedule": true,
      "hasRhymes": false,
      "hasShloka": false,
      "hasDictation": true
    },
    {
      "id": "grade-6",
      "name": "6th Standard",
      "shortName": "6th",
      "grade": 6,
      "category": "middle",
      "dataDir": "grade-6",
      "hasSchedule": true,
      "hasRhymes": false,
      "hasShloka": false,
      "hasDictation": true
    },
    {
      "id": "grade-7",
      "name": "7th Standard",
      "shortName": "7th",
      "grade": 7,
      "category": "middle",
      "dataDir": "grade-7",
      "hasSchedule": true,
      "hasRhymes": false,
      "hasShloka": false,
      "hasDictation": true
    }
  ]
}
```

**Why `hasRhymes`, `hasShloka`, `hasDictation` flags?** Different classes have different features. PP3 has rhymes; 7th Standard doesn't. Navigation adjusts dynamically per class.

### 2.4 Per-Class `months-index.json`

Each class directory gets its own index. Example for `data/pp3/months-index.json`:

```json
{
  "classId": "pp3",
  "months": [
    { "id": "november-2025", "month": "November", "year": 2025, "file": "november-2025.json" },
    { "id": "december-2025", "month": "December", "year": 2025, "file": "december-2025.json" },
    { "id": "january-2026", "month": "January", "year": 2026, "file": "january-2026.json" },
    { "id": "february-2026", "month": "February", "year": 2026, "file": "february-2026.json" }
  ],
  "currentMonth": "february-2026"
}
```

### 2.5 MonthData JSON Changes

The existing `MonthData` JSON structure stays the same. The `class` field inside each JSON already identifies the class. No changes needed to the JSON content format itself -- only where files are stored.

### 2.6 Backward Compatibility

Existing `data/november-2025.json` etc. will be **moved** to `data/pp3/` during migration. The old `data/months-index.json` is replaced by per-class indexes.

---

## 3. Registration & Onboarding Flow

### 3.1 User Flow

```
┌─────────────────────────────────────────────┐
│             FIRST VISIT                     │
│                                             │
│    Welcome to SchoolPulse!                  │
│    BGS National Public School               │
│                                             │
│    Let's set up your child's profile        │
│                                             │
│    Child's Name: [___________]              │
│                                             │
│    Class:  ┌──────────────────────┐         │
│            │ Nursery              │         │
│            │ LKG                  │         │
│            │ UKG                  │         │
│            │ PP3           ← ✓   │         │
│            │ 1st Standard        │         │
│            │ 2nd Standard        │         │
│            │ ...                 │         │
│            │ 7th Standard        │         │
│            └──────────────────────┘         │
│                                             │
│    Section (optional): [A / B / C]          │
│                                             │
│          [ Get Started → ]                  │
│                                             │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│         ADD ANOTHER CHILD?                  │
│                                             │
│    ✓ Aarav - PP3                            │
│                                             │
│    Do you have another child at             │
│    this school?                             │
│                                             │
│    [ + Add Another Child ]                  │
│    [ Skip, Go to App → ]                   │
│                                             │
└─────────────────────────────────────────────┘
                    │
                    ▼
              HOME PAGE
         (showing PP3 schedule)
```

### 3.2 Data Model

```typescript
// lib/dal/types.ts

interface ChildProfile {
  id: string;           // UUID generated at creation
  name: string;         // "Aarav"
  classId: string;      // "pp3" - maps to classes.json
  section?: string;     // "A" (optional)
  avatar: string;       // Emoji: "👦" "👧" "🧒" etc.
  createdAt: string;    // ISO date
}

interface UserProfile {
  id: string;           // UUID
  children: ChildProfile[];
  activeChildId: string;   // Currently selected child
  onboardingComplete: boolean;
  createdAt: string;
}
```

### 3.3 Storage

```typescript
// localStorage keys
'schoolpulse_user'      → JSON string of UserProfile
'schoolpulse_version'   → '2' (for future migrations)
```

### 3.4 Gate Logic

In `app/layout.tsx` (or a wrapper component), check:

```
if (!localStorage.schoolpulse_user || !user.onboardingComplete) {
  → redirect to /onboarding
} else {
  → render the app with active child's class loaded
}
```

### 3.5 Why localStorage (not a backend)?

- **Zero friction**: No email/password, no OAuth, instant setup
- **Privacy**: Parent data never leaves their device
- **Offline**: Works without internet after first load (PWA)
- **Future migration**: When we add a backend, we sync localStorage → database
- **Limitation acknowledged**: Data doesn't sync across devices. Acceptable for Phase 1.

---

## 4. Class-Aware Data Layer

### 4.1 Current `lib/data.ts` Problems

```typescript
// PROBLEM 1: Static imports - must edit code to add months
import november2025 from '@/data/november-2025.json';
import december2025 from '@/data/december-2025.json';
// ...

// PROBLEM 2: Hardcoded map - no class dimension
const monthDataMap: Record<string, MonthData> = {
  'november-2025': november2025 as MonthData,
  // ...
};

// PROBLEM 3: Functions assume single class
export function getMonthData(monthId?: string): MonthData { ... }
```

### 4.2 New Data Layer Architecture

Replace `lib/data.ts` with a modular `lib/dal/` directory:

```
lib/
  dal/
    index.ts              # Public API
    types.ts              # All interfaces
    class-registry.ts     # Load and query classes.json
    schedule-loader.ts    # Load schedule data by class + month
    announcements.ts      # Google Sheets fetching (consolidated)
    utils.ts              # formatDate, getSubjectColor, etc.
```

### 4.3 `lib/dal/types.ts` -- All Interfaces

Extract all interfaces from current `lib/data.ts` lines 9-104, plus new ones:

```typescript
// === EXISTING (move from lib/data.ts) ===
export interface ScheduleItem { time: string; subject: string; activity: string; }
export interface WeekendRevisionContent { ... }
export interface AISuggestedRecap { ... }
export interface DaySchedule { ... }
export interface WeekData { ... }
export interface Rhyme { ... }
export interface ImportantDate { ... }
export interface MonthData { ... }  // stays the same
export interface MonthInfo { ... }
export interface Announcement { ... }

// === NEW: Multi-class types ===
export interface ClassInfo {
  id: string;           // "pp3", "grade-1"
  name: string;         // "PP3", "1st Standard"
  shortName: string;    // "PP3", "1st"
  grade: number;        // 0 for pre-primary, 1-7 for standards
  category: 'pre-primary' | 'primary' | 'middle';
  dataDir: string;      // directory name under data/
  hasSchedule: boolean;
  hasRhymes: boolean;
  hasShloka: boolean;
  hasDictation: boolean;
}

export interface SchoolInfo {
  name: string;
  shortName: string;
  academicYear: string;
  location: string;
  logo?: string;
}

export interface ChildProfile {
  id: string;
  name: string;
  classId: string;
  section?: string;
  avatar: string;
  createdAt: string;
}

export interface UserProfile {
  id: string;
  children: ChildProfile[];
  activeChildId: string;
  onboardingComplete: boolean;
  createdAt: string;
}

export interface ClassMonthIndex {
  classId: string;
  months: MonthInfo[];
  currentMonth: string;
}
```

### 4.4 `lib/dal/class-registry.ts` -- Class Management

```typescript
import classesData from '@/data/classes.json';
import schoolData from '@/data/school.json';
import { ClassInfo, SchoolInfo } from './types';

export function getSchoolInfo(): SchoolInfo {
  return schoolData as SchoolInfo;
}

export function getAllClasses(): ClassInfo[] {
  return classesData.classes as ClassInfo[];
}

export function getClassById(classId: string): ClassInfo | null {
  return getAllClasses().find(c => c.id === classId) || null;
}

export function getClassesByCategory(category: string): ClassInfo[] {
  return getAllClasses().filter(c => c.category === category);
}
```

### 4.5 `lib/dal/schedule-loader.ts` -- Dynamic Data Loading

This is the critical change. Instead of static imports, we use dynamic `import()`:

```typescript
import { MonthData, MonthInfo, ClassMonthIndex, DaySchedule, WeekData, ImportantDate } from './types';

// Cache: classId -> monthId -> MonthData
const dataCache = new Map<string, Map<string, MonthData>>();

// Cache: classId -> ClassMonthIndex
const indexCache = new Map<string, ClassMonthIndex>();

/**
 * Load the months-index.json for a given class.
 * Uses dynamic import so no class data is bundled unless requested.
 */
export async function getClassMonthIndex(classId: string): Promise<ClassMonthIndex> {
  if (indexCache.has(classId)) {
    return indexCache.get(classId)!;
  }

  // Dynamic import from the class directory
  const index = await import(`@/data/${classId}/months-index.json`);
  const result: ClassMonthIndex = {
    classId,
    months: index.months || [],
    currentMonth: index.currentMonth || '',
  };
  indexCache.set(classId, result);
  return result;
}

/**
 * Load month data for a specific class and month.
 */
export async function getMonthData(classId: string, monthId: string): Promise<MonthData> {
  // Check cache
  if (dataCache.has(classId) && dataCache.get(classId)!.has(monthId)) {
    return dataCache.get(classId)!.get(monthId)!;
  }

  // Dynamic import
  const data = await import(`@/data/${classId}/${monthId}.json`);

  // Cache it
  if (!dataCache.has(classId)) {
    dataCache.set(classId, new Map());
  }
  dataCache.get(classId)!.set(monthId, data.default || data);

  return data.default || data;
}

/**
 * Get available months for a class.
 */
export async function getAvailableMonths(classId: string): Promise<MonthInfo[]> {
  const index = await getClassMonthIndex(classId);
  return index.months;
}

/**
 * Get current month ID for a class.
 */
export async function getCurrentMonthId(classId: string): Promise<string> {
  const index = await getClassMonthIndex(classId);
  // Try to find month containing today
  const today = toLocalDateString(new Date());
  for (const month of index.months) {
    try {
      const data = await getMonthData(classId, month.id);
      for (const week of data.weeks) {
        if (week.days.some(d => d.date === today)) {
          return month.id;
        }
      }
    } catch { /* month data may not exist yet */ }
  }
  return index.currentMonth;
}

/**
 * Get day schedule for a class + date.
 */
export async function getDaySchedule(
  classId: string,
  date: string,
  monthId?: string
): Promise<DaySchedule | null> {
  const mId = monthId || await getCurrentMonthId(classId);
  const data = await getMonthData(classId, mId);
  for (const week of data.weeks) {
    const day = week.days.find(d => d.date === date);
    if (day) return day;
  }
  return null;
}

/**
 * Get week data for a class + date.
 */
export async function getWeekForDate(
  classId: string,
  date: string,
  monthId?: string
): Promise<WeekData | null> {
  const mId = monthId || await getCurrentMonthId(classId);
  const data = await getMonthData(classId, mId);
  const targetDate = new Date(date);
  for (const week of data.weeks) {
    const weekStart = new Date(week.weekStart);
    const weekEnd = new Date(week.weekEnd);
    if (targetDate >= weekStart && targetDate <= weekEnd) return week;
  }
  return null;
}

/**
 * Get all dates for a class + month.
 */
export async function getAllDates(classId: string, monthId?: string): Promise<string[]> {
  const mId = monthId || await getCurrentMonthId(classId);
  const data = await getMonthData(classId, mId);
  const dates: string[] = [];
  for (const week of data.weeks) {
    for (const day of week.days) {
      dates.push(day.date);
    }
  }
  return dates.sort();
}

/**
 * Get important dates for a class + month.
 */
export async function getImportantDates(classId: string, monthId?: string): Promise<ImportantDate[]> {
  const mId = monthId || await getCurrentMonthId(classId);
  const data = await getMonthData(classId, mId);
  return data.importantDates || [];
}

// --- Helper ---
function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
```

**Key difference from current `lib/data.ts`**: Every function now takes `classId` as the first parameter. No more global single-class assumption.

### 4.6 `lib/dal/utils.ts` -- Moved Utilities

Move from current `lib/data.ts`:
- `formatDate()` (line 184)
- `formatShortDate()` (line 194)
- `getToday()` (line 202)
- `getSubjectColor()` (line 260)
- `toLocalDateString()` (line 134)

These have no class dependency and stay unchanged.

### 4.7 `lib/dal/announcements.ts` -- Consolidated CSV

Move from `app/actions.ts` (lines 43-69, the CSV parser) into here. Delete the dead duplicate in `lib/data.ts` (lines 286-445).

Add a `targetClass` column to the Google Sheet for class filtering (see Section 8).

### 4.8 `lib/dal/index.ts` -- Public API

```typescript
export * from './types';
export * from './class-registry';
export * from './schedule-loader';
export * from './utils';
export * from './announcements';
```

---

## 5. Context & State Architecture

### 5.1 New Provider Stack

```
<UserProvider>              ← manages user profile + child profiles (localStorage)
  <ChildProvider>           ← manages active child selection
    <ScheduleProvider>      ← loads data for active child's class
      <UpdatesProvider>     ← announcements filtered by active child's class
        <App />
      </UpdatesProvider>
    </ScheduleProvider>
  </ChildProvider>
</UserProvider>
```

### 5.2 `context/UserProvider.tsx`

Manages the UserProfile in localStorage:

```typescript
interface UserContextType {
  user: UserProfile | null;
  isOnboarded: boolean;
  addChild: (child: Omit<ChildProfile, 'id' | 'createdAt'>) => void;
  removeChild: (childId: string) => void;
  updateChild: (childId: string, updates: Partial<ChildProfile>) => void;
  completeOnboarding: () => void;
  resetProfile: () => void;
}
```

### 5.3 `context/ChildProvider.tsx`

Manages which child is currently active:

```typescript
interface ChildContextType {
  activeChild: ChildProfile | null;
  activeClass: ClassInfo | null;    // resolved from activeChild.classId
  switchChild: (childId: string) => void;
  children: ChildProfile[];
}
```

### 5.4 `context/ScheduleProvider.tsx` -- Eliminates Duplication

This is the biggest win. The duplicated `useEffect` pattern from 5 pages consolidates here:

```typescript
interface ScheduleContextType {
  // Month management
  availableMonths: MonthInfo[];
  selectedMonthId: string;
  setSelectedMonthId: (id: string) => void;

  // Date management
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  availableDates: string[];

  // Loaded data
  monthData: MonthData | null;
  dayData: DaySchedule | null;
  weekData: WeekData | null;
  importantDates: ImportantDate[];

  // State
  loading: boolean;

  // Navigation helpers
  navigateDay: (direction: number) => void;
  hasPrev: boolean;
  hasNext: boolean;
}
```

**What this replaces**: The identical 8-state-variable + 3-useEffect pattern currently in:
- `app/page.tsx` (lines 34-104)
- `app/month/page.tsx` (similar pattern)
- `app/rhymes/page.tsx` (similar pattern)
- `app/dates/page.tsx` (similar pattern)

The ScheduleProvider reads `activeChild.classId` from ChildProvider and calls the new `schedule-loader.ts` functions with that classId.

### 5.5 Updated `context/UpdatesProvider.tsx`

The existing `UpdatesContext.tsx` is refactored to filter by class:

```typescript
interface UpdatesContextType {
  updates: Announcement[];          // Filtered for active child's class
  allUpdates: Announcement[];       // School-wide (unfiltered)
  homeworkCount: number;
  loading: boolean;
  refreshUpdates: () => Promise<void>;
}
```

Filtering logic: Show announcements where `targetClass` is empty (school-wide) OR matches `activeChild.classId`.

### 5.6 Composition Root

```typescript
// context/AppProviders.tsx
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <UserProvider>
      <ChildProvider>
        <ScheduleProvider>
          <UpdatesProvider>
            {children}
          </UpdatesProvider>
        </ScheduleProvider>
      </ChildProvider>
    </UserProvider>
  );
}
```

Replaces the bare `<UpdatesProvider>` in current `app/layout.tsx:53`.

### 5.7 Custom Hooks

```
context/
  hooks/
    useUser.ts          → returns UserContextType
    useChild.ts         → returns ChildContextType
    useSchedule.ts      → returns ScheduleContextType
    useUpdates.ts       → returns UpdatesContextType (renamed from existing)
```

---

## 6. Routing Strategy

### 6.1 Decision: Class NOT in URL

**Why not** put class in URL (like `/pp3/week` or `/class/pp3/week`)?

- Parents bookmark `/` — they don't want to remember `/pp3/`
- Class is a user property, not a page property
- Switching children should keep you on the same page
- Simpler deep links: `/?date=2026-02-03` still works

**Instead**: Class comes from the `ChildProvider` context. URL stays clean.

### 6.2 New Route Structure

```
app/
  layout.tsx                 # Root HTML shell (minimal)

  onboarding/                # NEW: registration flow
    page.tsx                 # Welcome + add first child
    layout.tsx               # Onboarding layout (no nav bar)

  (app)/                     # Main app (requires profile)
    layout.tsx               # AppProviders + Navigation + onboarding gate
    page.tsx                 # Home / Today
    week/page.tsx
    month/page.tsx
    homework/page.tsx
    dates/page.tsx
    rhymes/page.tsx          # Only renders if class.hasRhymes
    nof/page.tsx

    settings/                # NEW: manage profile
      page.tsx               # Children list, active child, preferences
      children/
        page.tsx             # Add/edit/remove children
        add/page.tsx         # Add child form (reuses onboarding form)

  admin/                     # Admin (future: auth-protected)
    page.tsx                 # Current admin, cleaned up
```

### 6.3 Onboarding Gate in `(app)/layout.tsx`

```typescript
export default function AppLayout({ children }) {
  return (
    <AppProviders>
      <OnboardingGate>      {/* Redirects to /onboarding if not set up */}
        <Navigation />
        <HomeworkDuePopup />
        <main>{children}</main>
        <Footer />          {/* Dynamic school name + class */}
      </OnboardingGate>
    </AppProviders>
  );
}
```

`OnboardingGate` is a thin client component that checks `useUser().isOnboarded` and redirects to `/onboarding` if false.

---

## 7. Component Changes

### 7.1 New Components

| Component | Purpose | Location |
|-----------|---------|----------|
| `OnboardingForm.tsx` | Child name + class + section form | `components/onboarding/` |
| `OnboardingGate.tsx` | Checks profile, redirects if missing | `components/onboarding/` |
| `ChildSwitcher.tsx` | Pill/tabs to switch between children | `components/navigation/` |
| `ClassBadge.tsx` | Shows class name as a colored badge | `components/ui/` |
| `ChildAvatar.tsx` | Avatar + name display | `components/ui/` |

### 7.2 Modified Components

**`components/Navigation.tsx`** -- Add child switcher:

```
┌─────────────────────────────────────────────────┐
│ 💓 SchoolPuls    [👦 Aarav PP3 ▾]  📖 7️⃣ 📚 🗓️ 🔔 🎵│
└─────────────────────────────────────────────────┘
```

- Child switcher dropdown appears between the logo and nav links
- Shows active child's avatar + name + class badge
- Clicking opens dropdown to switch between children
- Includes "Manage Children" link to settings

**If only 1 child**: Shows just the class badge (no dropdown arrow).
**If 2+ children**: Shows dropdown with all children.

**`components/Navigation.tsx`** -- Dynamic nav links:

```typescript
const { activeClass } = useChild();

const links = [
  { href: '/', label: 'Today', icon: '📖', always: true },
  { href: '/week', label: 'Week', icon: '7️⃣', always: true },
  { href: '/homework', label: 'Homework', icon: '📚', always: true },
  { href: '/month', label: 'Month', icon: '🗓️', always: true },
  { href: '/dates', label: 'Events', icon: '🔔', always: true },
  { href: '/rhymes', label: 'Rhymes', icon: '🎵', show: activeClass?.hasRhymes },
].filter(link => link.always || link.show);
```

**Footer in `app/(app)/layout.tsx`** -- Dynamic:

```typescript
const { activeChild, activeClass } = useChild();
const schoolInfo = getSchoolInfo();

<footer>
  <div>SchoolPulse</div>
  <div>{schoolInfo.name}</div>
  <div>Showing {activeClass?.name} schedule for {activeChild?.name}</div>
</footer>
```

### 7.3 Simplified Pages

After the ScheduleProvider does the heavy lifting, pages become thin:

**Before** (`app/page.tsx` - 300 lines, 8 state vars, 3 useEffects):
```typescript
function HomeContent() {
  const [selectedMonthId, setSelectedMonthId] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [dayData, setDayData] = useState(null);
  // ... 5 more state vars, 3 useEffects ...
}
```

**After** (~100 lines, 0 state vars, 0 useEffects for data):
```typescript
function HomeContent() {
  const {
    availableMonths, selectedMonthId, setSelectedMonthId,
    selectedDate, setSelectedDate, availableDates,
    dayData, weekData, importantDates,
    navigateDay, hasPrev, hasNext, loading,
  } = useSchedule();

  const { activeChild } = useChild();

  if (loading) return <LoadingSkeleton />;
  // ... just JSX rendering, no data logic ...
}
```

**Before** (`app/week/page.tsx` - calls `getMonthData()` with no class):
```typescript
const data = getMonthData(); // ← which class? no idea
```

**After**:
```typescript
const { monthData, loading } = useSchedule();
// Class is handled by ScheduleProvider reading from ChildProvider
```

---

## 8. Announcement & Homework Filtering

### 8.1 Google Sheets Change

Add a `Target Class` column to the Google Sheet:

```
| Status | Category  | Title              | ... | Target Class |
|--------|-----------|--------------------| ... |--------------|
| Active | Homework  | Math worksheet     | ... | pp3          |
| Active | Homework  | Essay writing      | ... | grade-5      |
| Active | Holiday   | Republic Day       | ... |              | ← empty = all classes
| Active | Urgent    | School closed      | ... |              | ← empty = all classes
| Active | School    | PP3 Graduation Day | ... | pp3          |
```

### 8.2 Filtering Logic

In `app/actions.ts` (or `lib/dal/announcements.ts`):

```typescript
// Add 'targetClass' to headerMap
const headerMap = {
  ...existing,
  targetClass: row0.indexOf('target class'),
};

// In the mapping:
return {
  ...existing,
  targetClass: row[headerMap.targetClass]?.trim() || '',  // empty = school-wide
};
```

In `UpdatesProvider`:

```typescript
const { activeChild } = useChild();

const filteredUpdates = allUpdates.filter(u => {
  // School-wide announcements (no target class) → show to everyone
  if (!u.targetClass) return true;
  // Class-specific → show only if it matches active child's class
  return u.targetClass === activeChild?.classId;
});
```

### 8.3 Announcement Type Extension

```typescript
export interface Announcement {
  // ... existing fields ...
  targetClass?: string;   // NEW: "pp3", "grade-1", or empty for all
}
```

---

## 9. Admin Panel Evolution

### 9.1 Phase 1 (Now): Fix Security + Add Class Selector

Replace hardcoded password with environment variable:

```typescript
// app/admin/page.tsx
// Before: const ADMIN_PASSWORD = 'sreeavyu';
// After:  read from env
```

Add class selector to announcement creation form:

```
Add New Announcement
├─ Message: [___________]
├─ Type: [Info ▾]
├─ Target Class: [All Classes ▾]    ← NEW
│                 All Classes
│                 Nursery
│                 LKG
│                 ... through 7th Standard
├─ Expires On: [date]
└─ [ Add Announcement ]
```

### 9.2 Phase 2 (Future): School Admin Backend

When the school wants to upload data directly:

```
/admin
  /admin/announcements    → Create/manage announcements
  /admin/schedules        → Upload monthly PDFs or paste schedule data
  /admin/classes          → Enable/disable classes
  /admin/homework         → Assign homework by class
```

This is future scope but the data architecture (class directories, class registry) supports it.

---

## 10. PDF Processing Script Changes

### 10.1 Current Script

```bash
# Current usage (hardcodes PP3):
python process-newsletter.py newslet.pdf february 2026
# Output: data/february-2026.json with "class": "PP3"
```

### 10.2 Updated Script

Add required `class` parameter:

```bash
# New usage:
python process-newsletter.py newslet.pdf february 2026 pp3
python process-newsletter.py newslet.pdf february 2026 grade-3
```

Changes to `scripts/process-newsletter.py`:

```python
# Line 104: Add class argument
def main():
    if len(sys.argv) < 5:
        print("Usage: python process-newsletter.py <pdf_path> <month> <year> <class>")
        print("Example: python process-newsletter.py newslet.pdf february 2026 pp3")
        print("Classes: nursery, lkg, ukg, pp3, grade-1 ... grade-7")
        sys.exit(1)

    pdf_path = sys.argv[1]
    month = sys.argv[2]
    year = sys.argv[3]
    class_id = sys.argv[4]  # NEW

# Line 83-88: Use class parameter
def create_template_json(month, year, class_id):
    class_names = {
        'nursery': 'Nursery', 'lkg': 'LKG', 'ukg': 'UKG', 'pp3': 'PP3',
        'grade-1': '1st Standard', 'grade-2': '2nd Standard',
        # ...
    }
    return {
        "month": month.capitalize(),
        "year": int(year),
        "class": class_names.get(class_id, class_id),
        "school": "BGS National Public School",
        # ...
    }

# Line 137: Output to class directory
    output_file = f"../data/{class_id}/{month.lower()}-{year}.json"
```

### 10.3 Batch Processing

For processing all classes in one go:

```bash
#!/bin/bash
# scripts/process-all-classes.sh
MONTH=$1
YEAR=$2

for CLASS in nursery lkg ukg pp3 grade-1 grade-2 grade-3 grade-4 grade-5 grade-6 grade-7; do
  PDF="pdfs/${CLASS}-${MONTH}-${YEAR}.pdf"
  if [ -f "$PDF" ]; then
    echo "Processing $CLASS..."
    python process-newsletter.py "$PDF" "$MONTH" "$YEAR" "$CLASS"
  else
    echo "Skipping $CLASS (no PDF found: $PDF)"
  fi
done
```

---

## 11. Migration Strategy

### Phase 0: Data Reorganization (no code changes)

**Goal**: Move files around without breaking anything.

1. Create `data/school.json` and `data/classes.json`
2. Create `data/pp3/` directory
3. **Copy** (not move) existing JSON files to `data/pp3/`:
   ```
   cp data/november-2025.json data/pp3/
   cp data/december-2025.json data/pp3/
   cp data/january-2026.json  data/pp3/
   cp data/february-2026.json data/pp3/
   ```
4. Create `data/pp3/months-index.json` (same content as current `data/months-index.json` plus `classId`)
5. Keep original files in place (backward compat during migration)

**Verification**: Existing app still works (reads from old paths).

### Phase 1: New Data Layer (lib/dal/)

**Goal**: Build the new class-aware data layer alongside the old one.

1. Create `lib/dal/types.ts` -- extract all interfaces from `lib/data.ts`
2. Create `lib/dal/class-registry.ts` -- reads `data/classes.json`
3. Create `lib/dal/schedule-loader.ts` -- dynamic class-based loading
4. Create `lib/dal/utils.ts` -- move utility functions
5. Create `lib/dal/index.ts` -- re-exports
6. **Do NOT delete `lib/data.ts` yet** -- existing pages still import from it

**Verification**: New data layer loads PP3 data correctly (unit test).

### Phase 2: Onboarding & User Profile

**Goal**: Add registration flow and user profile management.

1. Create `context/UserProvider.tsx`
2. Create `context/ChildProvider.tsx`
3. Create `components/onboarding/OnboardingForm.tsx`
4. Create `components/onboarding/OnboardingGate.tsx`
5. Create `app/onboarding/page.tsx` and `app/onboarding/layout.tsx`
6. Create `app/(app)/settings/page.tsx` and `app/(app)/settings/children/page.tsx`

**Verification**: New user sees onboarding. After setup, redirected to home. Profile persists in localStorage.

### Phase 3: ScheduleProvider + Page Migration

**Goal**: Pages use the new class-aware data layer via context.

1. Create `context/ScheduleProvider.tsx` using `lib/dal/schedule-loader.ts`
2. Create `context/AppProviders.tsx` composing all providers
3. Create `app/(app)/layout.tsx` with providers + onboarding gate
4. Migrate pages one at a time (start with `app/page.tsx`):
   - Replace local state + useEffects with `useSchedule()` hook
   - Replace `import from '@/lib/data'` with `import from '@/lib/dal'`
5. After ALL pages migrated, delete `lib/data.ts`
6. Delete old `data/months-index.json` and original flat JSON files

**Migration order** (safest first):
1. `app/(app)/page.tsx` (home -- most complex, proves the pattern)
2. `app/(app)/week/page.tsx` (simplest page)
3. `app/(app)/dates/page.tsx` (simple)
4. `app/(app)/month/page.tsx` (moderate)
5. `app/(app)/rhymes/page.tsx` (conditionally hidden per class)
6. `app/(app)/homework/page.tsx` (uses UpdatesContext, needs class filter)

**Verification**: Each page works identically for PP3. Switching to a different class (once data exists) shows that class's schedule.

### Phase 4: Navigation & UI Polish

**Goal**: Visual indicators of multi-class support.

1. Update `components/Navigation.tsx` with child switcher
2. Create `components/navigation/ChildSwitcher.tsx`
3. Create `components/ui/ClassBadge.tsx`
4. Update footer to show dynamic school name + class
5. Conditional nav links based on class features (hasRhymes etc.)

**Verification**: Child switcher works. Navigation adapts. Footer shows correct info.

### Phase 5: Announcement Filtering

**Goal**: Class-specific announcements.

1. Add `targetClass` column to Google Sheet
2. Add `targetClass` to `Announcement` interface
3. Update CSV parser in `app/actions.ts` to read `targetClass`
4. Update `UpdatesProvider` to filter by active child's class
5. Update homework page to show class-filtered homework

**Verification**: School-wide announcements show for all. Class-specific ones only for that class.

### Phase 6: Add Data for Other Classes

**Goal**: Start populating data for classes beyond PP3.

1. Update `scripts/process-newsletter.py` with `class` parameter
2. Create `scripts/process-all-classes.sh`
3. Process PDFs for available classes
4. Add months-index.json in each class directory
5. Test class switching with real data

**Verification**: Can switch between PP3 and another class and see different schedules.

### Phase 7: Admin Cleanup

**Goal**: Admin panel supports multi-class.

1. Move admin password to environment variable
2. Add class selector to announcement form
3. Update admin to store class-targeted announcements

---

## 12. Complete File Map

### New Files to Create

```
data/
  school.json                              # School metadata
  classes.json                             # Class registry
  pp3/months-index.json                    # PP3 month index (copy + modify)
  pp3/november-2025.json                   # Moved from data/
  pp3/december-2025.json                   # Moved from data/
  pp3/january-2026.json                    # Moved from data/
  pp3/february-2026.json                   # Moved from data/

lib/
  dal/
    index.ts                               # Public API re-exports
    types.ts                               # All interfaces
    class-registry.ts                      # Class + school info
    schedule-loader.ts                     # Dynamic data loading
    utils.ts                               # Date/color utilities
    announcements.ts                       # CSV parser (consolidated)

context/
  UserProvider.tsx                          # User profile management
  ChildProvider.tsx                         # Active child selection
  ScheduleProvider.tsx                      # Class-aware schedule state
  AppProviders.tsx                          # Composition root

components/
  onboarding/
    OnboardingForm.tsx                     # Name + class + section form
    OnboardingGate.tsx                     # Redirect if not onboarded
  navigation/
    ChildSwitcher.tsx                      # Switch between children
  ui/
    ClassBadge.tsx                         # "PP3" colored badge
    ChildAvatar.tsx                        # Avatar + name

app/
  onboarding/
    page.tsx                               # Registration page
    layout.tsx                             # Onboarding layout (no nav)
  (app)/
    layout.tsx                             # Providers + gate + nav
    settings/
      page.tsx                             # User preferences
      children/
        page.tsx                           # Manage children
        add/page.tsx                       # Add child form
```

### Files to Modify

```
lib/data.ts                                → DELETE after migration (replaced by lib/dal/)
data/months-index.json                     → DELETE after migration (replaced by per-class)
data/*.json (4 files)                      → MOVE to data/pp3/

app/layout.tsx                             → Simplify (remove UpdatesProvider, footer)
app/page.tsx                               → Move to app/(app)/page.tsx, use useSchedule()
app/week/page.tsx                          → Move to app/(app)/week/, use useSchedule()
app/month/page.tsx                         → Move to app/(app)/month/, use useSchedule()
app/homework/page.tsx                      → Move to app/(app)/homework/, add class filter
app/dates/page.tsx                         → Move to app/(app)/dates/, use useSchedule()
app/rhymes/page.tsx                        → Move to app/(app)/rhymes/, conditional by class
app/nof/page.tsx                           → Move to app/(app)/nof/
app/admin/page.tsx                         → Env var password, class selector
app/actions.ts                             → Add targetClass parsing

context/UpdatesContext.tsx                  → Refactor to UpdatesProvider with class filter
components/Navigation.tsx                  → Add ChildSwitcher, dynamic links
scripts/process-newsletter.py              → Add class parameter
```

### Files That Stay Unchanged

```
components/DaySchedule.tsx                 # Pure display, no class logic
components/DictationWords.tsx              # Pure display
components/WeekendRevision.tsx             # Pure display
components/AISuggestedRecap.tsx            # Pure display
components/MonthSelector.tsx               # Pure display
components/ImportantDates.tsx              # Pure display
components/ShareButton.tsx                 # Pure display
components/NotificationBanner.tsx          # Pure display
components/HomeworkDuePopup.tsx            # Uses UpdatesContext (filtered)
components/InstallPrompt.tsx               # No class logic
components/RecentUpdates.tsx               # Uses UpdatesContext (filtered)
```

---

## Summary: Why This Architecture Works

1. **Zero backend required** -- localStorage for profiles, static JSON for data, Google Sheets for announcements. Same hosting on Vercel.

2. **Incremental migration** -- Old `lib/data.ts` and new `lib/dal/` coexist. Pages migrate one at a time. Nothing breaks during transition.

3. **Scales to 10+ classes** -- Each class is an independent directory. Adding a class = add a directory + register in `classes.json`.

4. **Adding a month = no code change** -- Drop JSON in `data/{class}/`, update that class's `months-index.json`. No imports to edit.

5. **Multiple children just work** -- Parent with kids in PP3 + 3rd Standard switches instantly. Each child loads from their class's data directory.

6. **Future admin backend slots in** -- The `schedule-loader.ts` provider pattern can swap from static JSON to API calls without touching any page code.

7. **Class-specific features** -- `ClassInfo.hasRhymes`, `hasShloka`, `hasDictation` flags control what pages/sections appear. 7th Standard won't see the Rhymes page.

8. **Announcement targeting** -- One Google Sheet serves all classes. A single column `Target Class` controls who sees what.
