# Changelog

All notable changes to SchoolPulse PWA will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## How to Rollback

To rollback to a previous version:

```bash
# View all available versions
git tag -l

# Rollback to a specific version (example: v1.1.0)
git checkout v1.1.0

# Or revert to previous commit
git revert <commit-hash>

# Push the rollback
git push origin main --force
```

---

## [v1.4.0] - 2026-01-17

**Tag**: `v1.4.0`  
**Commit**: TBD  
**Rollback to**: `v1.3.0` (previous stable version)

### Added
- **Dynamic Subject Support**: Weekly Summary now supports ALL subjects dynamically
  - Literacy, Numeracy, General Awareness, Kannada, Hindi, Art, Story, Socio Emotional Skills
  - Color-coded sections with subject-specific icons
  - Automatically adapts to any number of subjects

### Changed
- **Week View Enhancements**:
  - Renamed "Weekend Revision" to "Weekly Summary" for clarity
  - Removed day-by-day schedules from Week view
  - Shows only: Weekly Summary, Dictation Words, Special Days (holidays except Sunday)
  - Cleaner, focused week-level overview

### Fixed
- **Critical Navigation Bug**: Month view date selection now works correctly
  - Clicking a date from Month view (e.g., November) now navigates to that specific date
  - Previously navigated to January 1st instead
  - Added automatic month detection and switching
- **Content Completeness**: Audited and fixed all January weekly summaries
  - Week 4: Added missing Kannada subject, made all content specific
  - Week 5: Replaced all generic content with actual topics from schedules
  - All weeks now have complete, specific content (no assumptions)

### Data Quality
- **Week 4 (Jan 19-23)**: 6 subjects, 22 specific learning points
- **Week 5 (Jan 26-30)**: 7 subjects with actual activities (Rebus Story, Picture Composition, Skip counting, etc.)
- All content extracted from actual daily schedules

### Technical
- Updated `WeekendRevisionContent` interface to use dynamic `subjects` object
- Added `findMonthForDate` function for cross-month navigation
- Enhanced `WeekendRevision` component with subject color/icon mapping

---

## [v1.3.0] - 2026-01-17

**Tag**: `v1.3.0`  
**Commit**: `c1dda15`  
**Rollback to**: `v1.2.0` (previous stable version)

### Added
- **Weekend Revision Feature**: Saturdays now show weekly learning summaries
  - Beautiful purple/blue gradient revision cards
  - Color-coded sections: 📖 Literacy (blue), 🔢 Numeracy (green), 🌍 General Awareness (orange)
  - All 5 Saturdays in January 2026 have curated revision content
  - Sundays remain as "Weekend" holidays

### New Components
- `components/WeekendRevision.tsx`: Displays weekly learning summaries
- Updated `components/DaySchedule.tsx`: Renders weekend revision when applicable

### Data Changes
- `data/january-2026.json`: Added 10 weekend days (5 Saturdays + 5 Sundays)
  - Week 1 (Jan 3): Winter Break activities
  - Week 2 (Jan 10): Digraphs, Subtraction, Nature
  - Week 3 (Jan 17): Phonic sounds, Addition, Seasons
  - Week 4 (Jan 24): Long vowels, Word problems, Seasons
  - Week 5 (Jan 31): Month recap, Republic Day

### Technical
- Added `WeekendRevisionContent` interface to `lib/data.ts`
- Added `isWeekendRevision` and `weekendRevisionContent` fields to `DaySchedule` type

---

## [v1.2.0] - 2026-01-17

**Tag**: `v1.2.0`  
**Commit**: `99dcdf9`  
**Rollback to**: `v1.1.0` (previous stable version)

### Added
- Weekend support: Saturday and Sunday now included in calendar as "Weekend" holidays
- Week 3 (Jan 12-18) includes Jan 17 (Sat) and Jan 18 (Sun)

### Fixed
- **Critical**: Today page now correctly shows current date on weekends
- Previously showed Jan 1 when current date was a weekend (Jan 17)
- Date initialization priority: URL param > Today's date > First available

### Changed
- `data/january-2026.json`: 854 insertions, 166 deletions

---

## [v1.1.0] - 2026-01-17

**Tag**: `v1.1.0`  
**Commit**: `c951f05`  
**Rollback to**: `v1.0.0` (if it exists) or commit `6c772da`

### Added
- November and December 2025 newsletter data integration
- Auto-detection of current month based on today's date
- Month selectors on all pages (Today, Week, Month, Events, Rhymes)
- Small text labels under navigation icons on mobile
- Spiral calendar icon (🗓️) for Month navigation

### Fixed
- Mobile navigation: Icons now fit perfectly across screen width
- Horizontal scroll prevented with `overflow-x-hidden`
- Text truncation on mobile schedule content
- Hydration warning from browser extensions

### Changed
- Navigation icons updated for better clarity:
  - Today: 📖 (book)
  - Week: 7️⃣ (number 7)
  - Month: 🗓️ (spiral calendar)
  - Events: 🔔 (bell)
  - Rhymes: 🎵 (music note)
- Mobile padding reduced: `px-2` on mobile, `px-4` on desktop
- Removed redundant page headings (Daily Schedule, Week View, Month View)
- Notification banner colors: Softer pastel tones

### Files Changed
- `data/november-2025.json` (NEW)
- `data/december-2025.json` (NEW)
- `data/months-index.json`
- `lib/data.ts`
- `app/page.tsx`
- `app/week/page.tsx`
- `app/month/page.tsx`
- `app/dates/page.tsx`
- `app/rhymes/page.tsx`
- `app/layout.tsx`
- `components/Navigation.tsx`
- `components/NotificationBanner.tsx`
- `components/ImportantDates.tsx`
- `components/DaySchedule.tsx`

---

## Version History Summary

| Version | Date | Description | Rollback To |
|---------|------|-------------|-------------|
| v1.4.0 | 2026-01-17 | Weekly Summary enhancements, Navigation fix, Content audit | v1.3.0 |
| v1.3.0 | 2026-01-17 | Weekend Revision feature | v1.2.0 |
| v1.2.0 | 2026-01-17 | Weekend support | v1.1.0 |
| v1.1.0 | 2026-01-17 | Nov/Dec integration, Mobile UX improvements | v1.0.0 |

---

## Rollback Examples

### Rollback from v1.2.0 to v1.1.0

```bash
# Option 1: Checkout previous tag
git checkout v1.1.0
git push origin main --force

# Option 2: Revert specific commit
git revert 99dcdf9
git push origin main
```

### Rollback from v1.1.0 to previous version

```bash
git checkout 6c772da  # Previous commit before v1.1.0
git push origin main --force
```

---

## Notes

- **Semantic Versioning**: MAJOR.MINOR.PATCH
  - MAJOR: Breaking changes
  - MINOR: New features (backward compatible)
  - PATCH: Bug fixes (backward compatible)

- **Tags**: All releases are tagged for easy rollback
- **Testing**: All features verified on localhost before deployment
- **Deployment**: Automatic via Vercel on push to main branch
