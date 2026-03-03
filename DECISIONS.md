# Apex Fitness — Locked-In Decisions

> Single source of truth for all design decisions. Updated as new decisions are locked in.

---

## Medal System

### Evolution Glow Tiers (4-tier)
Every non-excluded medal evolves visually based on `timesEarned`:

| Tier | timesEarned | Visual |
|------|------------|--------|
| Base | 1+ | Standard medal |
| Gold Glow | 5+ | Gold shimmer frame |
| Diamond Glow | 20+ | Diamond sparkle frame |
| Pink Diamond Glow | 50+ | Pink diamond frame |

**Non-evolving medals**: streak medals, powerlifting club medals (300/400/500/1000lb/600 clubs).

### Streak Medals (Weekly Milestones)
Streaks are counted in **weeks** (1+ workout per week = streak continues).

| Medal | Requirement |
|-------|------------|
| 2-Week Streak | 2 consecutive weeks |
| Monthly Streak | 4 consecutive weeks |
| Quarter Streak | 12 consecutive weeks |
| Half-Year Streak | 26 consecutive weeks |
| Year Streak | 52 consecutive weeks |

### Evolving Medals (5-tier progression)
Medals like Workout Warrior, Iron Lifter, PR Collector, Community Builder evolve through bronze → silver → gold → platinum → diamond with increasing targets.

---

## Strength Ratings

### Exercises Included (Free Weights Only)
- **Chest**: Bench Press, Incline Bench, DB Bench, Incline DB Press, Dips
- **Back**: Deadlift, RDL, DB RDL, Barbell Row, DB Row, Pull-up, Chin-up, T-Bar Row
- **Shoulders**: OHP, Military Press, DB Shoulder Press, Lateral Raise
- **Legs**: Squat, Front Squat, Goblet Squat, Hip Thrust, Split Squat, Bulgarian Split Squat

### Exercises REMOVED from Strength Ratings
- **Rear Delt Fly** — removed because it's a cable/machine isolation movement, not a free weight compound. Rear delts are already covered indirectly by rows and pull-ups.

### Shoulder Category Reweight (after rear delt removal)
- Front Delts: 55% (was 35%)
- Side Delts: 45% (was 35%)
- Rear delt slice: removed entirely

---

## Personal Bests (PB Display)

### Toggle in Settings
Users can choose between two PB display modes:
- **Best Weight** (default): Shows heaviest weight lifted for any rep count
- **Best Set**: Shows the set with the highest estimated 1RM (weight × reps via Brzycki/Epley)

---

## Progressive Overload Suggestions

### Formula
- Base suggestion: **current weight × 1.05** (5% increase)
- Rounded to nearest available plate increment: **1.25kg, 2.5kg, or 5kg**
- Displayed as a subtle hint on exercise cards when logging

---

## Navigation

### User Mode (bottom nav)
| Tab | Icon | Route |
|-----|------|-------|
| Today | Calendar | /today |
| Feed | Newspaper | /feed |
| Community | Users | /community |
| Program | GraduationCap | /program |
| Profile | UserCircle | /profile |

### Trainer Mode (bottom nav)
| Tab | Icon | Route |
|-----|------|-------|
| Today | Calendar | /today |
| Feed | Newspaper | /feed |
| Clients | Users | /clients |
| Builder | Dumbbell | /builder |
| Profile | UserCircle | /profile |

### Header
- Message icon (Mail) with unread badge — visible in both modes
- Links to combined inbox at `/messages`

---

## Messaging

### Combined Inbox
- Single `/messages` route for both user and trainer modes
- Filter tabs: **All | Clients | Personal | Groups**
- Accessed via header icon (not a nav tab)

---

## User Program Tab

### Structure
Users see 3 options on the Program tab:
1. **Create Workout** — single workout using block-based builder (same as trainer)
2. **Create Program** — multi-day program with weekly plan + scheduling
3. **Suggested Programs** — browse curated templates (Pro-gated)

### Block-Based Builder
- Reuses trainer's block builder code
- Same block types: Strength, Circuit, Cardio, Stretch
- Fixed days + cycling mode for multi-day programs

### Suggested Programs (Pro Gate)
- Free users see program previews but get a Pro upgrade prompt at entry
- Pro users can browse, filter (by goal, expertise, sessions/week), and activate
- Filters: Goal (strength/hypertrophy/endurance/weight loss), Expertise (beginner/intermediate/advanced), Sessions/week (2-6)

---

## Membership Tiers

| Tier | Price | Key Features |
|------|-------|-------------|
| Free | $0 | Workout logging, basic medals, feed, community |
| Pro | $X/mo | Suggested programs, advanced analytics, priority support |
| Trainer | $Y/mo | Client management, builder, calendar, payments, session tracking |

---

## Workout Dataflow

### deriveAll() Pipeline
Centralized post-workout processing function called on save, edit, and delete:
1. Recalculate all PBs from workout history
2. Re-evaluate all medals (earn or revert)
3. Recalculate strength ratings
4. Update volume rollups (per-exercise, per-session, total)

### Block Memory
- Block performance data stored per user per workout
- Circuit blocks: completion time, rounds completed
- Strength blocks: total volume (sets × reps × weight)
- Accessible in workout history and for progressive overload suggestions

### Medal Revert on Delete
- When a workout is deleted, `deriveAll()` recalculates from remaining history
- Medals that no longer meet criteria are reverted (earned → unearned)
- `timesEarned` is recounted from scratch

---

## Code Migration Strategy

- **70% keep** — existing code that works well
- **15% modify** — existing code that needs updates (medals, nav, strength ratings)
- **5% replace** — code being swapped out (e.g., streak calculation logic)
- **10% new** — new features (Program tab, deriveAll pipeline, volume rollups)

### Approach
- Incremental changes on main branch
- No SQL schema changes in Phase 1 (code-only)
- Future SQL changes are always additive (ADD COLUMN, CREATE TABLE)

---

## Session → Payment → Package Flow

### Current Flow (preserved)
1. Workout completes → `addSession()` creates trainer_sessions record
2. Active package found → `useSessionFromPackage()` decrements remaining
3. User toggles paid → `toggleSessionPaid()` + `addPayment()` creates payment record

### Package Types
- **Regular**: Fixed count (e.g., 10-pack), auto-completes when remaining hits 0
- **Continuous**: Unlimited (`remainingSessions = -1`), just tracks `usedSessions`

### Future Improvements (Phase 3+)
- Atomic session + payment creation
- `package_id` foreign key on `client_payments`
- Stripe Connect integration

---

## Membership & Mode Switching

### Membership Tiers
| Tier | Access |
|------|--------|
| Free | Basic workouts, limited templates |
| Pro | All programs, suggested templates, full features |
| Trainer | Pro + trainer mode (clients, builder, calendar, payments) |

### Current State (MVP)
- All users default to `membershipTier: 'pro'` for testing
- Trainer mode switch is currently unrestricted

### Future Gate (Post-MVP)
- Switching to **trainer mode** requires `membershipTier: 'trainer'`
- Free users see locked programs with upgrade prompt
- Membership page with Stripe subscription flow

---

## Today Page — Mode-Specific Content

### User Mode
- Calendar day strip + calendar button → full calendar
- Weekly stats (streak, workouts, minutes, volume)
- Steps tracker (manual entry MVP → health integrations Phase 2)
- Completed workouts today
- Upcoming sessions (if has trainer)
- Medal progress (only if real workout history)
- Recent workouts
- Quick start workout actions

### Trainer Mode
- Calendar day strip + calendar button → full calendar
- Session timeline for selected day (with client avatars, start/done status)
- Outstanding payments alert
- Quick actions (Sessions, Calendar)
- Recent client completions
- **No** steps/streaks/medals (trainers focus on clients, not own stats)
