# Next Improvements Plan — Phase 3.5

## 1. Client Invite Email Flow (Priority: HIGH)

### Current State
- Trainer creates client via `/clients` page with name/email/password (default `client123`)
- Client user record created in localStorage + synced to Supabase via `registerUserToSupabase()`
- Invite email sent via Supabase Edge Function `send-client-invite` with token + email
- Client clicks link → `/invite?token=X&email=Y` → validates token → redirects to `/auth?invite=X&email=Y`
- Auth page shows "Set Your Password" flow — logs in with `client123`, then updates password
- `acceptInvitation()` marks invite as accepted in Supabase

### Issues to Fix
1. **Email delivery reliability** — Edge Function `send-client-invite` may not exist or may fail silently. Need to verify it's deployed and working, or add a fallback (e.g., Resend API).
2. **Onboarding workout exclusion** — When client logs in, they should see all PT workout data recorded by their trainer BUT exclude the initial onboarding/assessment workout. Need a flag `isOnboarding: true` on the Workout type, and filter it out from client's workout history view.
3. **Workout data visibility** — After accepting invite, client needs to see:
   - All PT workouts recorded by trainer (`workout.assignedBy === trainerId`)
   - Their own personal workouts
   - NOT onboarding assessments
4. **Password flow edge cases** — If trainer set a custom password (not `client123`), the setup flow tries default password first and fails. Need to handle this gracefully.
5. **Cross-device data** — Client's workout data is stored under `workout-storage` keyed by `userId`. When client logs in on a new device, their workout history needs to load from Supabase (currently only localStorage).

### Implementation Steps
- [ ] Add `isOnboarding?: boolean` flag to Workout type
- [ ] Mark onboarding workout with this flag during onboarding flow
- [ ] Filter `isOnboarding` workouts from client's Today page, history, and profile stats
- [ ] Verify/create Supabase Edge Function for email sending (or add Resend fallback)
- [ ] Add email template with: trainer name, app link, clear CTA button
- [ ] Fix password setup flow to handle custom passwords (show login form if default fails)
- [ ] Add workout history sync from Supabase on client login (`loadWorkoutHistoryForUser()`)
- [ ] Test full flow: trainer creates client → sends invite → client receives email → clicks link → sets password → sees workout data

---

## 2. Workout Assignment Pathways & Data Flow (Priority: HIGH)

### Current State
- **Assign from Clients page**: Trainer selects template → `assignWorkout()` creates Workout with `assignedBy: trainerId`, `userId: clientId`
- **Assign from Builder**: Trainer builds custom workout in `/workout/builder` → saves as `SessionWorkout`
- **Start PT session from Today**: Trainer taps "Start" on calendar event → starts workout for client
- **Workout saved**: `endWorkout()` saves to `workoutHistory` with `userId: clientId`, `assignedBy: trainerId`

### Issues to Fix
1. **Template assignment is basic** — Only assigns from `defaultTemplates`, not from trainer's custom workout library or builder output.
2. **No scheduled workout delivery** — Assigned workout doesn't appear on client's Today page as "Today's Workout" that they can self-start.
3. **Builder → Client flow gap** — Workouts created in `/workout/builder` save to `sessionWorkouts` in trainer store, but there's no clear path to attach them to a specific client session.
4. **Program → Daily workout** — If client has an active program, the daily workout should auto-populate on their Today page.

### Implementation Steps
- [ ] Connect Builder output to client assignment: after saving in builder, option to "Assign to Client" or "Attach to Calendar Event"
- [ ] Add `scheduledWorkout` concept to client's Today page: show assigned/programmed workout for today with "Start Workout" button
- [ ] When trainer assigns workout, create a calendar event + attach workout reference
- [ ] Client Today page: detect assigned workouts for today → show as primary CTA
- [ ] Program compliance: when client starts assigned template, mark as program day completed
- [ ] Sync assigned workouts to Supabase so client sees them on their device

---

## 3. Profile Card Display (Priority: MEDIUM)

### Current State
- Two profile card components: `ProfileCard.tsx` (V1, expandable) and `ProfileCardV2.tsx` (V2, full card with medal picker)
- V2 used on Profile page in a dialog (`showProfileCard` state)
- Features: featured medals (auto top 3 or user-chosen), strength rating toggle, stats grid, tier-based styling
- User type has `featuredMedalIds`, `showStrengthRating`, `isPublicProfile` fields

### Issues to Fix
1. **Profile card not prominently shown** — It's hidden behind a dialog on Profile page. Should be the hero section or easily shareable.
2. **No public view** — Other users can't see your profile card (no `/profile/[userId]` route yet).
3. **Featured lift not implemented** — User type has no `featuredLift` field. Design decision: show best lift (e.g., "Bench Press 100kg") on card.
4. **Share functionality** — Currently just copies URL. Should generate a shareable card image or deep link.
5. **Feed integration** — Profile card should render inline in feed when someone visits your post.

### Implementation Steps
- [ ] Make profile card the hero section on `/profile` page (always visible, not dialog-only)
- [ ] Add `featuredLift?: { exerciseId: string; weight: number; reps: number }` to User type
- [ ] Add lift picker UI in profile card edit mode (select from personal bests)
- [ ] Create `/profile/[userId]` public route that shows profile card + public stats
- [ ] Respect `isPublicProfile` toggle — private profiles show limited info
- [ ] Profile card in Feed: when tapping user avatar on a post, show inline profile card
- [ ] Optional: generate shareable card image (canvas-based or html2canvas)

---

## 4. Payments & Session Counting — Never Reset (Priority: HIGH)

### Current State
- `SessionPackage` tracks: `totalSessions`, `usedSessions`, `remainingSessions`, `paidSessions`
- `useSessionFromPackage()` increments `usedSessions`, decrements `remainingSessions` (min 0)
- Package stays `active` even when `remainingSessions` hits 0 (continuous tracking)
- Payment records (`ClientPayment`) are created per session or per cycle
- `getClientPaymentData()` calculates outstanding balance from package data
- Session history stored in `sessions[]` array in trainer store

### Issues to Fix
1. **Package completion must NOT reset counts** — When a package reaches 0 remaining, the `usedSessions` and `paidSessions` must persist. A new package should ADD to the running totals, not replace them.
2. **Historical payment visibility** — All past payments must remain visible in payment history even after package completion. Currently `payments[]` array persists, but need to ensure UI shows all-time history.
3. **Session count continuity** — `sessions[]` array must never be cleared. Each session is a permanent record. The "Sessions" tab on client page should show ALL sessions ever, grouped by package.
4. **Package transition** — When one package completes and a new one starts, the old package data should be archived (status: `completed`) but still visible. New package starts fresh counts but old data remains.
5. **Payment history page** — The `/payments` page should have a "History" tab showing all payments across all packages for each client, not just current package.

### Implementation Steps
- [ ] Verify `useSessionFromPackage()` never resets — confirmed, it only increments (code looks correct)
- [ ] Add package archiving: when creating new package, auto-complete old one but keep all records
- [ ] Payment history UI: add "All Time" filter to payments page showing every payment record
- [ ] Session history: ensure client page "Sessions" tab shows all sessions from all packages
- [ ] Add package selector on client page: "Current Package" / "All Packages" / specific package
- [ ] Add lifetime totals display: "Total sessions ever: X | Total paid: $Y | All-time"
- [ ] Ensure `deletePayment()` only removes the payment record, doesn't affect session counts
- [ ] Test: create package → use sessions → complete → create new package → verify old data persists

---

## Implementation Order

1. **Payments & Sessions** (most impactful for trainer daily use)
2. **Workout Assignment** (critical for client experience)  
3. **Client Invite Email** (needed for client onboarding)
4. **Profile Card** (polish/social feature, less urgent)

## Dependencies
- Items 1-3 require Supabase sync verification
- Item 3 requires email service (Edge Function or Resend)
- Item 4 is mostly frontend-only
