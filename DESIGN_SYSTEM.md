# Catalift Design System

**"Journey Upward"** - Calm foundation, radiant progress

---

## Design Pillars

1. **Calm Foundation, Radiant Progress**
   - Base UI uses neutral surfaces and consistent spacing
   - Reserve gradients/glow ONLY for milestones, streaks, level-ups

2. **Progress is the Hero**
   - Every screen answers: "How am I moving forward?"
   - Convert raw numbers into narrative ("Halfway to Tier 2")

3. **Mature Gamification**
   - Earned rewards, not noisy celebrations
   - Subtle and meaningful, not distracting

---

## Spacing Scale (4px base)

| Token | Value | Usage |
|-------|-------|-------|
| `gap-1` / `p-1` | 4px | Tight gaps, icon padding |
| `gap-2` / `p-2` | 8px | Inline elements, small gaps |
| `gap-3` / `p-3` | 12px | List item padding |
| `gap-4` / `p-4` | 16px | Card padding, section gaps |
| `gap-6` / `p-6` | 24px | Between sections |
| `gap-8` / `p-8` | 32px | Page margins, large gaps |
| `gap-12` / `p-12` | 48px | Hero spacing |

---

## Typography Hierarchy

| Class | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| `.text-display` | 32px | 700 | 1.2 | Hero text, big moments |
| `.text-title` | 24px | 600 | 1.3 | Page titles |
| `.text-heading` | 18px | 600 | 1.4 | Card titles, subsections |
| `.text-body` | 16px | 400 | 1.5 | Default readable text |
| `.text-caption` | 14px | 400 | 1.4 | Secondary info, metadata |
| `.text-small` | 12px | 500 | 1.3 | Labels, badges |

---

## Surface Hierarchy

| Level | CSS Variable | Usage |
|-------|--------------|-------|
| 0 | `--background` | Page background (deepest) |
| 1 | `--card` | Cards, containers |
| 2 | `--popover` | Modals, popovers, elevated |
| 3 | `--elevated` | Interactive hover states |

**Utility Classes:**
- `.surface-card` - Standard card with border
- `.surface-elevated` - Modal/popover style
- `.surface-interactive` - Clickable card with hover

---

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | 6px | Buttons, inputs |
| `--radius-md` | 10px | Small cards |
| `--radius-lg` | 14px | Cards, containers |
| `--radius-xl` | 20px | Large cards, modals |
| `--radius-2xl` | 24px | Hero sections |
| `--radius-full` | 9999px | Avatars, pills |

---

## Color System

### Base Colors (everyday UI)
- `--primary` - Sky blue - Primary actions, links
- `--secondary` - Subtle gray - Secondary elements
- `--muted` - Dimmed - Disabled, inactive
- `--destructive` - Red - Delete, danger actions

### Progress Colors (milestones only!)
- `--progress` - Sky blue - Active progress
- `--progress-glow` - Sky blue glow - Progress indicators
- `--milestone` - Orange/amber - Achievements, level-ups
- `--milestone-glow` - Orange glow - Celebration moments

### Glow Effects (use sparingly)
- `.glow-progress` - Strong progress glow
- `.glow-milestone` - Strong milestone glow  
- `.glow-subtle` - Subtle indicator glow

---

## When to Use "Radiant" Effects

✅ **DO use glow/gradients for:**
- Completing a workout
- Reaching a new tier
- Earning a medal
- Hitting a streak milestone
- Personal best achievements

❌ **DON'T use glow/gradients for:**
- Regular buttons
- Navigation
- Form inputs
- Everyday cards
- Loading states

---

## Implementation Files

- `src/app/globals.css` - All design tokens and utilities
- `src/components/CataliftLogo.tsx` - Brand logo component

---

*Last updated: Pass 1 - Design System Foundation*
