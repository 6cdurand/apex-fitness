# APEX Fitness - Project Context

## App Overview
A hybrid personal training and fitness tracker app that combines workout logging, social features, gamification (medals/achievements), and trainer-client management in one platform. Similar to Instagram's social model with followers/following.

---

## User Modes

### User Mode (Green Theme)
**Navigation:** Workout | Feed | Friends | Trainer | Profile

- **Workout:** Create/load workouts, log sets/reps/weights with Strong app-style logging
- **Feed:** Post medals earned with photos/videos, see friends' achievements
- **Friends:** Search, add, interact with other users
- **Trainer:** View assigned workouts from trainer (MyTrainer dashboard)
- **Profile:** Displays strength ratings, medals, settings to upgrade to Trainer Mode

### Trainer Mode (Red Theme)  
**Navigation:** Workout | Feed | Clients | Calendar | Profile

- **Clients:** Manage clients, assign workouts, track progress, view notes
- **Feed:** See client achievements and milestones
- **Calendar:** Color-coded client sessions and scheduled workouts
- **Profile:** Trainer verification tick, specializations, trainer medals

---

## Key Features

### 1. Medals & Achievements System

#### Two Medal Types:

**A. Evolving Medals** - Single medal that levels up through tiers as you progress:
- **Workout Warrior** (💪): 1 → 10 → 50 → 100 → 250 workouts
- **Streak Master** (🔥): 7 → 14 → 30 → 60 → 100 day streaks
- **Iron Lifter** (🏋️): 10k → 50k → 100k → 500k → 1M kg volume
- **PR Collector** (🏆): 1 → 10 → 25 → 50 → 100 PRs
- **Community Builder** (🤝): 1 → 10 → 25 → 50 → 100 follows

**B. Milestone Medals** - One-time achievements with fixed rarity:
- **Bench Milestones:** One Plate (60kg), Two Plate (100kg), Three Plate (140kg), Four Plate (180kg)
- **Squat Milestones:** Initiate (100kg), Warrior (140kg), Beast (180kg), Legend (220kg)
- **Deadlift Milestones:** Beginner (100kg), Warrior (140kg), King (180kg), God (220kg)
- **Powerlifting Totals:** 300kg, 400kg, 500kg, 1000lb (454kg), 600kg clubs
- **Special:** Early Bird, Night Owl, Marathon Session, Jack of All Trades, Weekly Warrior

**Tiers:** Bronze → Silver → Gold → Platinum → Diamond

**Rarity System:**
- **Common** (gray): Most users will achieve
- **Uncommon** (green): Requires dedication
- **Rare** (blue): Significant achievement
- **Epic** (purple): Elite level
- **Legendary** (orange): Very few will achieve

### 2. Strength Rating System
Slice-based system with 4 main categories. Each category has weighted sub-slices.

**Categories & Slices:**

#### 💪 Chest (Profile → Enhanced View)
| Slice | Weight | Contributing Exercises |
|-------|--------|------------------------|
| Middle Chest | 40% | Flat Bench, DB Bench |
| Upper Chest | 30% | Incline Bench, Incline DB |
| Lower Chest | 30% | Dips, Decline Bench |

#### 🔙 Back
| Slice | Weight | Contributing Exercises |
|-------|--------|------------------------|
| Vertical Pull | 35% | Pull-ups, Lat Pulldown |
| Horizontal Pull | 35% | Barbell Row, DB Row |
| Posterior Chain | 30% | Deadlift, RDL |

#### 🎯 Shoulders
| Slice | Weight | Contributing Exercises |
|-------|--------|------------------------|
| Front Delts | 35% | OHP, DB Shoulder Press |
| Side Delts | 35% | Lateral Raises |
| Rear Delts | 30% | Face Pulls, Rear Delt Fly |

#### 🦵 Legs
| Slice | Weight | Contributing Exercises |
|-------|--------|------------------------|
| Quads | 50% | Squat, Leg Press, Leg Extension |
| Glutes/Hamstrings | 50% | Squat, Deadlift, RDL, Leg Curl |

**Calculation Rules:**
1. **Best lift per slice:** If multiple exercises can contribute, use the one with highest tier %
2. **Progress % formula:** `(1RM - tier_min) / (tier_max - tier_min) × 100`
3. **Points formula:** `slice_weight × progress% / 100`
4. **100% rule:** If a lift is ABOVE category tier, it counts as 100% for that slice
5. **Category tier:** Locked to lowest slice tier (all must contribute)
6. **Total rating:** Sum of all slice points (0-100)

**Tier Ranges (kg) - Male Standards:**
| Lift | Beginner | Novice | Intermediate | Advanced | Elite |
|------|----------|--------|--------------|----------|-------|
| Bench | 0-50 | 50-75 | 75-100 | 100-130 | 130-180 |
| Squat | 0-70 | 70-100 | 100-140 | 140-185 | 185-250 |
| Deadlift | 0-80 | 80-120 | 120-160 | 160-210 | 210-280 |
| OHP | 0-30 | 30-45 | 45-65 | 65-85 | 85-115 |
| Row | 0-40 | 40-60 | 60-85 | 85-115 | 115-150 |

*Female standards = ~65% of male values*

**Enhanced View:** Tap any category on profile to see detailed breakdown with:
- Individual slice progress bars
- Contributing lift and 1RM
- Tier ranges for each exercise
- Points calculation breakdown

**Update Modes:**
- **Live:** Updates immediately when PBs saved
- **Weekly:** Calculates on Sundays, shows "Last updated: [date]"

### 3. 1RM Calculation
- **1 rep:** Actual weight (no calculation)
- **2-6 reps:** Brzycki formula: `weight × (36 / (37 - reps))`
- **7+ reps:** Epley formula: `weight × (1 + reps / 30)`
- Trophy emoji appears when new PB achieved
- Also tracks total exercise volume PB (all sets combined, excludes drop/supersets)

---

## Workout Logging (Strong App Style)

### Exercise Card Layout
1. **Header:** Exercise name, 1RM display ("1RM: 100kg"), settings button (3 dots)
2. **Set Rows:** Set number | Weight input | Reps input | ✅ tick button
3. **Previous values:** Shown faded in input boxes

### Set Types
- **Normal Set:** Standard, complete with tick
- **Superset:** 2+ exercises back-to-back, rest after all completed
- **Drop Set:** Consecutive sets with decreasing weight, shown as mini-stack

### Rest Timer
- Starts automatically when set ticked
- Configurable per exercise or globally
- Circular countdown or inline progress bar

### Settings Button Options
- Edit rest timer
- Add to superset / Add drop set
- Edit exercise (name, default weight/reps)
- Duplicate or delete exercise
- Convert kg ↔ pounds
- Group as warmup vs active workout

---

## Feed Posts

### Post Types
- `workout_complete` - Completed workout with optional photo
- `pb_achieved` - New personal best with trophy
- `medal_earned` - Achievement unlocked
- `milestone` - Special milestone reached
- `general` - Regular text/photo post

### Post Structure
- User avatar + name (+ verified tick for trainers)
- Post type badge (colored pill)
- Content text
- Optional media (photo/video)
- Like/Comment/Share actions

---

## Trainer Features

### Client Management
- Client list with profile previews
- Assign workouts, track progress
- Client notes: goals, injury history, exercise preferences
- Session tracking (used/remaining)
- Quick actions: assign workout, schedule consultation, message

### Workout Assignment
- Create workouts like regular workout menu
- Add PT notes per exercise (form reminders, etc.)
- Assign to specific day
- Long-term programs (4-12 week plans)
- Adaptive goals based on client performance

### Calendar
- Color-coded by client or workout type
- Tap session → open client profile
- Schedule consultations, assessments, rest days

---

## Data Principles

### Empty States (Fresh Account)
- Profile: Empty placeholders, no fake stats/medals
- Feed: Empty until friends/posts exist
- Clients: "No clients found" with functional empty Assign modal
- Recent Workouts: Empty message
- Templates: Show 6 built-in templates

### Routing
- `/trainer` → MyTrainer screen (client view), NOT trainer dashboard
- `/feed` → Empty on fresh account
- `/clients` → "No clients found" state

### Persistence
- All workout data saved: exercises, sets, reps, weight, supersets, drop sets
- 1RM/PB calculations persistent
- Weekly volume tracking
- Historical data for % change calculations

---

## Weekly Report
- Total workouts, volume, duration
- Volume by muscle group (sets × weight × reps)
- % change from previous week
- New PBs with trophy icons
- Notification: "Your weekly report is ready"
- Generated every Sunday

---

## Workout History

### Summary View
Clicking a workout in history opens a quick summary modal showing:
- Duration, total volume, total sets
- Exercise list with best set per exercise
- Set breakdown (weight × reps) with completion status
- "View Full Details" button for complete workout page

### History Page Features
- Search workouts by name or exercise
- Stats: This Week / This Month / All Time counts
- Grouped by date with calendar icon
- Exercise tags shown on each workout card

---

## Technical Notes
- **Units:** User preference (kg/lb), per-exercise conversion option
- **Gender-based ratings:** Male/female have different strength standards
- **Trainer verification:** Manual flag for MVP
- **Notifications:** In-app + push for weekly report
- **Media storage:** Firebase Storage with size limits if needed

---

## Key Files

### Strength Rating System
- `src/lib/strengthRating.ts` - Tier ranges, slice definitions, calculation functions
- `src/app/profile/strength/[category]/page.tsx` - Enhanced category view

### Medals System
- `src/lib/medals.ts` - Medal definitions (evolving + milestone), rarity functions
- `src/app/medals/page.tsx` - Medals display page

### Stores (Zustand)
- `src/lib/store.ts` - All state management (Auth, Workout, Social, Trainer, Medal, Report)

### Types
- `src/types/index.ts` - All TypeScript interfaces

---

## Profile Card System (FIFA Player Card Style)

### Mini Card (Collapsed)
Always visible, clickable to expand:
- **Tier Ring:** Avatar surrounded by gradient ring matching strength tier
- **Rating Badge:** Overall strength rating number on avatar corner
- **Name + Verified:** Username with trainer verification tick
- **Mini Stats:** Workouts, followers, medals count
- **Top 3 Medals:** Stacked medal icons with tier gradients
- **Expand Arrow:** Chevron indicating expandable

### Expanded Card
Full snapshot when clicked:

#### Top 3 Medals Display
- Large clickable medal cards with tier gradient backgrounds
- Shows medal icon, name, tier
- Click opens medal detail modal with:
  - Description and earned date
  - Evolution progress bar
  - Attached media (photos/videos) - friends only

#### Additional Medals Section
- Grid of smaller medal badges
- Friends see more medals than non-friends
- Shows rarity color borders
- Lock icon + "Follow to see more" for non-friends

#### Strength Ratings
- 2x2 grid showing all 4 categories (Chest, Back, Shoulders, Legs)
- Progress bar and tier label for each
- Percentage score with tier color

#### Profile Stats
- Total workouts, volume (k), PRs, medals
- Compact 4-column grid

#### Action Buttons
- Follow/Following toggle (for other users)
- Share button (copies profile link)

### Privacy & Visibility

| Content | Own Profile | Friends | Non-Friends |
|---------|-------------|---------|-------------|
| Top 3 Medals | ✅ Full | ✅ Full | ✅ Basic |
| Additional Medals | ✅ All | ✅ 12 max | ⚠️ 6 max |
| Attached Media | ✅ All | ✅ All | ❌ Hidden |
| Strength Details | ✅ Full | ✅ Full | ✅ Basic |
| Stats | ✅ Full | ✅ Full | ✅ Basic |

### Edit Mode (Own Profile)
- Drag & drop to reorder top 3 medals
- Toggle visibility per medal (public/friends/private)
- Attach photos/videos to medals
- Preview how card appears to friends vs public

### Key Files
- `src/components/ProfileCard.tsx` - Main profile card component
- Used in profile page and friend views

---

## Exercise Strength Standards (Rarity Tiers by Weight)

### Medal Priority Order
1. **Milestone Medals** (highest priority) - Exercise-specific weight achievements
2. **Streak Medals** - Consistency achievements
3. **Evolving Medals** - Progressive achievements

### Medal Evolution System
- **Bronze:** Earned 10 times
- **Silver:** Earned 50 times  
- **Gold:** Earned 100 times

### Push (Chest Movements)

#### Flat Bench Press
| Rarity | Male (kg) | Female (kg) |
|--------|-----------|-------------|
| Common | 50 | 20 |
| Uncommon | 70 | 30 |
| Rare | 100 | 50 |
| Epic | 130 | 70 |
| Legendary | 160 | 100 |

#### Incline DB Press (Middle/Upper Chest)
| Rarity | Male (kg) | Female (kg) |
|--------|-----------|-------------|
| Common | 15 | 6 |
| Uncommon | 30 | 12 |
| Rare | 40 | 20 |
| Epic | 55 | 30 |
| Legendary | 75 | 45 |

#### Incline BB Press (Middle/Upper Chest)
| Rarity | Male (kg) | Female (kg) |
|--------|-----------|-------------|
| Common | 45 | 13 |
| Uncommon | 65 | 26 |
| Rare | 90 | 44 |
| Epic | 120 | 67 |
| Legendary | 150 | 93 |

#### Dips (Upper Chest)
| Rarity | Male (kg) | Female (kg) |
|--------|-----------|-------------|
| Common | -8 | 0 |
| Uncommon | 18 | 9 |
| Rare | 50 | 25 |
| Epic | 86 | 43 |
| Legendary | 125 | 62 |

#### Chest Fly (Middle Chest)
| Rarity | Male (kg) | Female (kg) |
|--------|-----------|-------------|
| Common | 34 | 20 |
| Uncommon | 57 | 33 |
| Rare | 87 | 50 |
| Epic | 124 | 71 |
| Legendary | 166 | 95 |

### Pull (Back Movements)

#### Lat Pulldown (Vertical)
| Rarity | Male (kg) | Female (kg) |
|--------|-----------|-------------|
| Common | 38 | 19 |
| Uncommon | 58 | 31 |
| Rare | 82 | 46 |
| Epic | 110 | 64 |
| Legendary | 141 | 83 |

#### Seated Row (Horizontal)
| Rarity | Male (kg) | Female (kg) |
|--------|-----------|-------------|
| Common | 41 | 20 |
| Uncommon | 61 | 32 |
| Rare | 86 | 47 |
| Epic | 115 | 66 |
| Legendary | 147 | 86 |

#### Bent-over Row (Horizontal)
| Rarity | Male (kg) | Female (kg) |
|--------|-----------|-------------|
| Common | 41 | 15 |
| Uncommon | 60 | 26 |
| Rare | 85 | 41 |
| Epic | 115 | 59 |
| Legendary | 147 | 79 |

### Legs (Quads, Glutes, Hamstrings)

#### Squat (Quads & Glutes)
| Rarity | Male (kg) | Female (kg) |
|--------|-----------|-------------|
| Common | 64 | 30 |
| Uncommon | 93 | 48 |
| Rare | 130 | 73 |
| Epic | 173 | 103 |
| Legendary | 219 | 136 |

#### Front Squat (Quads)
| Rarity | Male (kg) | Female (kg) |
|--------|-----------|-------------|
| Common | 55 | 30 |
| Uncommon | 77 | 45 |
| Rare | 105 | 62 |
| Epic | 137 | 83 |
| Legendary | 172 | 105 |

#### Leg Press (Quads)
| Rarity | Male (kg) | Female (kg) |
|--------|-----------|-------------|
| Common | 86 | 41 |
| Uncommon | 147 | 82 |
| Rare | 226 | 141 |
| Epic | 324 | 214 |
| Legendary | 432 | 299 |

#### Hip Thrust (Glutes)
| Rarity | Male (kg) | Female (kg) |
|--------|-----------|-------------|
| Common | 38 | 30 |
| Uncommon | 76 | 56 |
| Rare | 129 | 93 |
| Epic | 196 | 139 |
| Legendary | 273 | 191 |

#### Split Squat (Quads)
| Rarity | Male (kg) | Female (kg) |
|--------|-----------|-------------|
| Common | 10 | 6 |
| Uncommon | 18 | 11 |
| Rare | 30 | 18 |
| Epic | 44 | 26 |
| Legendary | 60 | 36 |

#### RDL (Glutes/Hamstrings)
| Rarity | Male (kg) | Female (kg) |
|--------|-----------|-------------|
| Common | 55 | 29 |
| Uncommon | 84 | 45 |
| Rare | 120 | 66 |
| Epic | 164 | 91 |
| Legendary | 211 | 119 |

### Shoulders (Press Movements)

#### Barbell Press
| Rarity | Male (kg) | Female (kg) |
|--------|-----------|-------------|
| Common | 30 | 13 |
| Uncommon | 45 | 22 |
| Rare | 64 | 34 |
| Epic | 87 | 48 |
| Legendary | 112 | 65 |

#### Dumbbell Press
| Rarity | Male (kg) | Female (kg) |
|--------|-----------|-------------|
| Common | 13 | 6 |
| Uncommon | 21 | 10 |
| Rare | 32 | 16 |
| Epic | 45 | 23 |
| Legendary | 60 | 31 |

#### Machine Press
| Rarity | Male (kg) | Female (kg) |
|--------|-----------|-------------|
| Common | 24 | 8 |
| Uncommon | 46 | 18 |
| Rare | 77 | 34 |
| Epic | 115 | 56 |
| Legendary | 159 | 80 |

---

## Trainer App – Client Onboarding, Programming & Session/Payment Tracking

### 1. Client Creation & Onboarding Flow

**Entry Point:**
- Main Clients screen has "+ Add Client" button
- After creating client (name + basic info), trainer can press "Start Onboarding"

**Onboarding / Orientation Screen:**
Collects minimum effective data to generate programs and suggest pathways.

**Orientation Questions (stored in client file):**
- Primary goal (fat loss, strength, hypertrophy, general health, performance, pain reduction)
- Secondary goal (optional)
- Training preference (1:1, classes, mixed, unsure)
- Experience level (new, some, confident, advanced)
- Injury / pain flags (shoulder, knee, back, hip, none, other)
- Availability (days per week, session length)
- Will train alone outside PT (yes/maybe/no)
- Movement confidence (1–5 for squat, hinge, push, pull, core)
- Wants to move into classes? (yes ASAP / later / maybe / no)
- Lifestyle basics (sleep quality, stress level, job activity)

**System Outputs (auto-suggested):**
- Recommended training phase
- Suggested pathway (Standard 1:1 programming)
- Trainer can override all suggestions
- All onboarding data saved in client file, can be revisited

### 2. Phase Selection (Trainer-Controlled)

After onboarding, trainer selects client's current phase:
- **Phase 1:** Foundation / Stability
- **Phase 2:** Strength / Hypertrophy
- **Phase 3:** Performance / Power
- **Phase 4:** Return to Training / Rehab-informed

Each phase unlocks:
- Appropriate program templates
- Phase-appropriate exercises
- Phase-appropriate progressions/regressions

Trainer confirms phase → proceeds to templates.

### 3. Program Templates & Weekly Plans

**Program Template Screen:**
App suggests templates based on:
- Phase
- Goal
- Days per week
- Class-bound vs PT-only

**Examples:**
- 3-day Full Body
- Upper / Lower
- Full Body A/B

Templates include pre-filled sets, reps, rest. Trainer can:
- Select template as-is
- Tap into any workout day to edit

### 4. Workout Builder / Editor

Inside each workout:
- Exercise list
- Sets / reps editor
- Rest time editor

**Exercise Tap-In (Key Feature):**
When exercise is tapped, open Exercise Detail Modal showing:
- Exercise name
- Movement pattern (squat, hinge, push, pull, carry, core)
- Phase suitability

**Tabs:**
- Regressions (max 3)
- Progressions (max 3)

Each regression/progression shows:
- Exercise name
- When to use it (1 line)
- 1 key coaching cue

Trainer can press "Swap into workout" → replaces exercise without breaking sets/reps logic.

**Phase-aware filtering:**
- Phase 1 → control & stability options
- Phase 2 → load & volume
- Phase 3 → power & speed

If client is class-bound: Show "Class-Safe" badge, grey out unsafe options.

### 5. Weekly Plan Overview & Sending

Trainer sees:
- Weekly calendar view (e.g. Mon / Wed / Fri)
- Tap any day to edit workout
- "Send Program to Client" button

Client receives:
- Weekly schedule
- Individual workouts
- Ability to log sessions

### 6. Session Auto-Logging

**Automatic Session Logging:**
When client starts or completes workout, app:
- Auto-logs session for that date
- Marks as "Completed"

**Session Status Options:**
- Completed (default)
- Cancelled (trainer button)
- No-show (optional later)

Cancelled sessions do NOT count toward package usage, still visible in history.

### 7. Payments & Session Tracking (Trainer View)

**Session-Based Logic:**
- Sessions are auto-logged
- Trainer does NOT need to manually add sessions

**Payment Tracking Options:**
Each client file includes:
- Package type (e.g. 10 sessions, weekly payment, pay-as-you-go)
- Sessions remaining
- Payments received
- Outstanding balance

**Payment Confirmation:**
Trainer can:
- Mark payment as received
- Link payment to one or multiple sessions

### 8. Trainer Payment Dashboard (Optional)

Separate Payments / Admin tab showing:
- Total sessions completed this week
- Total income received this week
- Outstanding payments
- Sessions cancelled / no-showed

Updates automatically as sessions are logged.

### 9. Key Design Principles

- Trainer always has final control (no hard locks)
- Suggestions > enforcement
- Minimal taps during sessions
- Orientation data drives everything
- Session logging is automatic
- Payments tied to sessions, not manual spreadsheets

---

## Goal Input System (Orientation)

**Goal field = two inputs:**
1. Goal dropdown (multi-select or primary+secondary)
2. Custom goal text (optional)

**Dropdown Goals (seed list):**
- Fat loss
- Muscle gain (hypertrophy)
- Strength (general)
- Strength (powerlifting)
- Conditioning / fitness
- Mobility / flexibility
- Pain reduction / return to training
- Posture / movement quality
- Athletic performance
- Boxing / combat sports
- Confidence / consistency

**Trainer can also type custom goals:**
- "Train for Hyrox"
- "Glute growth + reduce knee pain"
- "Get confident for classes"

### How Goals Affect Suggestions

**1) Recommended Phase (soft suggestion):**
- Pain / posture / movement quality → Foundation / Return-to-training
- Fat loss → Foundation → Strength (with conditioning finisher)
- Hypertrophy → Strength/Hypertrophy emphasis
- Strength/powerlifting → Strength focus, lower reps
- Performance → Strength base → Power later

Trainer can always override.

**2) Template Ranking:**
Templates have tags: phase, goal_bias, days/week, equipment style, conditioning included (true/false). Goal selection filters and ranks templates.

**3) Rep Ranges + Finisher Presets:**

| Goal | Reps | Rest | Notes |
|------|------|------|-------|
| Fat loss | 8–15 | Shorter | Optional circuit finisher |
| Hypertrophy | 6–12 | Moderate | Higher volume |
| Strength | 3–6 (main lifts) | Longer | Compound focus |
| Movement quality/pain | 10–15 | Moderate | Tempo, stability, low load |
| Performance | Varies | Varies | Contrast sets later (Phase 3) |

### Progression Plan Screen (Optional)

After onboarding: "Recommended Progression Plan" shows suggested path:
- Weeks 1–4: Foundation
- Weeks 5–12: Strength/Hypertrophy
- Optional later: Power/Performance

Based on goals + experience + injury flags. Trainer can edit the timeline.

---

## Ideal Template Selection System (Trainer Programming Engine)

### Core Idea
App helps trainers find best starting program template using layered filtering system, not rigid algorithm. Trainer always has final control.

### Template Selection Logic (Layered)

Templates filtered in this fixed order:
1. **Phase** (most important – sets training context)
2. **Goal** (biases structure and intent)
3. **Injuries / Limitations** (modifies emphasis & exercise selection)
4. **Training Frequency** (days/week – adjusts split structure)

Each layer narrows options, does not generate a new template.

### Template Philosophy
- Templates are broad frameworks, not rigid programs
- Trainers responsible for final exercise choices
- Injury logic prioritises warm-ups, regressions, emphasis — not total exclusion
- Frequency changes structure, not intent
- Avoids "template explosion" while maintaining safety

### How Each Layer Modifies the Program

**1️⃣ Phase (Structural Rules):**
Defines: rep ranges & intensity, movement complexity, progression style, exercise library tier, rest expectations.
- Foundation → control, stability, simpler patterns
- Strength → load, compound lifts
- Performance → power, contrast work

**2️⃣ Goal (Bias Layer):**
Biases: exercise priority, volume distribution, conditioning inclusion, session intent.
- Fat loss → circuits, shorter rest
- Hypertrophy → volume, isolation
- Strength → compound priority

**3️⃣ Injuries / Limitations (Modification Layer):**
Does NOT select templates. Instead:
- Adjusts warm-up blocks
- Flags preferred regressions
- Adds activation priorities
- De-prioritises risky movements

Examples:
- Knee pain → glute activation + squat regressions
- Shoulder pain → rotator cuff work + press modifications
- Back pain → core stability + hinge emphasis

**4️⃣ Frequency (Distribution Layer):**
Adjusts: weekly split structure, volume per session, recovery spacing.
- 2x/week → full body
- 3x/week → full body or upper/lower
- 4x/week → upper/lower or split

### Template Selection Flow

```
Select Phase
  ↓
Filter Templates by Phase
  ↓
Filter by Goal Compatibility
  ↓
Apply Injury Modifiers (warm-ups, regressions, emphasis)
  ↓
Adjust Structure Based on Days/Week
  ↓
Return 1–3 Suggested Templates
```

Trainer selects one → edits freely.

---

## Template Data Model

```typescript
interface Template {
  id: string
  name: string
  description: string
  
  // Filtering tags
  phases: ("foundation" | "strength" | "performance" | "return")[]
  goals: ("fat_loss" | "hypertrophy" | "strength" | "conditioning" | "mobility" | "general")[]
  frequencyOptions: number[]  // [2, 3] or [3, 4]
  structure: "full_body" | "upper_lower" | "push_pull_legs" | "split" | "circuit"
  classSafe: boolean
  
  // Block structure
  days: WorkoutDay[]
}

interface WorkoutDay {
  dayLabel: string  // "Day A", "Upper", "Push"
  blocks: Block[]
}

interface Block {
  type: "warmup" | "work" | "cooldown"
  name: string  // "Activation", "Main Lifts", "Accessory", "Finisher"
  exercises: TemplateExercise[]
}

interface TemplateExercise {
  slot: string           // "Squat Pattern", "Horizontal Push" — placeholder
  defaultExercise: string // "Goblet Squat" — suggested default
  sets: number
  reps: string           // "8-12" or "3-5"
  rest: string           // "90s" or "60s"
  notes?: string
  injuryFlags?: string[] // ["knee", "back"] — triggers regression suggestions
}
```

---

## Base Template Library (~20 Templates)

| # | Name | Structure | Frequency | Phases | Primary Goals |
|---|------|-----------|-----------|--------|---------------|
| 1 | Full Body – Foundation | Full Body | 2-3x | foundation, return | general, fat_loss |
| 2 | Full Body – Strength | Full Body | 3x | strength | strength, general |
| 3 | Full Body A/B | Full Body | 3x | foundation, strength | general, hypertrophy |
| 4 | Full Body – Circuit | Full Body | 2-3x | foundation | fat_loss, conditioning |
| 5 | Upper/Lower – Foundation | Upper/Lower | 3-4x | foundation | general |
| 6 | Upper/Lower – Strength | Upper/Lower | 4x | strength | strength, hypertrophy |
| 7 | Upper/Lower – Volume | Upper/Lower | 4x | strength | hypertrophy |
| 8 | Upper/Lower – Hybrid | Upper/Lower | 3-4x | strength | fat_loss, conditioning |
| 9 | Push/Pull/Legs – Classic | PPL | 4-6x | strength | hypertrophy, strength |
| 10 | Push/Pull/Legs – Strength | PPL | 4-5x | strength, performance | strength |
| 11 | Push/Pull/Legs – Volume | PPL | 5-6x | strength | hypertrophy |
| 12 | Bro Split – Bodybuilding | Split | 4-5x | strength | hypertrophy |
| 13 | Circuit – HIIT Style | Circuit | 2-3x | foundation | fat_loss, conditioning |
| 14 | Circuit – Strength | Circuit | 3x | foundation, strength | fat_loss, strength |
| 15 | Circuit – Low Impact | Circuit | 2-3x | return | conditioning, mobility |
| 16 | Return to Training – Mobility | Full Body | 2-3x | return | mobility, general |
| 17 | Return to Training – Stability | Full Body | 2-3x | return | mobility, general |
| 18 | Performance – Power Prep | Upper/Lower | 4x | performance | strength, conditioning |
| 19 | Class Prep – Group Safe | Full Body | 2-3x | foundation | general, conditioning |
| 20 | Class Prep – Conditioning | Circuit | 3x | foundation | fat_loss, conditioning |

---

## Workout Structure (Blocks)

**Block Types:**
- **Warm-up Block:** Activation, mobility, movement prep
- **Work Block:** Main lifts, accessory work, finishers
- **Cool-down Block:** Stretching, recovery

Similar to Strong app UI but with block element separating sections.

### Example Template Structure

**3-Day Full Body – Foundation:**

```
Day A:
├── Warm-up Block (Activation)
│   ├── Glute Bridge: 2×12
│   └── Dead Bug: 2×8 each
│
├── Work Block (Main Lifts)
│   ├── Goblet Squat: 3×10-12 [knee flag]
│   ├── DB Bench Press: 3×10-12 [shoulder flag]
│   └── Cable Row: 3×10-12
│
├── Work Block (Accessory)
│   ├── Split Squat: 2×10 each
│   └── Plank: 2×30s
│
└── Cool-down Block (Stretch)
    └── Hip Flexor Stretch: 1×60s each
```

---

## Trainer Programming Screens

**Screen 1: Client Setup / Orientation**
Inputs: Phase, Goal, Injuries, Days per week
CTA: "Find Program Templates"

**Screen 2: Template Suggestions**
Displays: 1–3 recommended templates, description, structure, tags (Class-safe, Joint-friendly)
Actions: Select template, View why suggested, Override filters

**Screen 3: Weekly Plan Preview**
Shows: Weekly layout (days), Workout names, Edit buttons
CTA: "Build / Edit Workouts"

**Screen 4: Workout Builder**
Features: Exercise list, Set/rep editing, Tap exercise → regressions/progressions, Injury-aware suggestions

---

## Trainer Accountability

- Templates cannot auto-progress clients
- Trainer must: Approve phase changes, Select final exercises, Adjust loads
- App assists decision-making, does not replace coaching

---

## Color Themes
- **User Mode:** Emerald/Green (`emerald-500`, `emerald-600`)
- **Trainer Mode:** Red theme
- **Tiers:**
  - Bronze: `amber-700` to `amber-900`
  - Silver: `gray-300` to `gray-500`
  - Gold: `yellow-400` to `yellow-600`
  - Platinum: `cyan-300` to `cyan-500`
  - Diamond: `purple-400` to `blue-500`
