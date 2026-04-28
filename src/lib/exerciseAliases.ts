/**
 * Exercise alias dictionary — canonical library IDs → list of shorthand,
 * synonym, and common-misspelling strings that should match that exercise.
 *
 * This is the single source of truth for semantic synonyms (e.g. "ohp" →
 * overhead press). Typo tolerance is handled separately by the Fuse index
 * in `exerciseSearch.ts`, so you do **not** need to add minor misspellings
 * here — only true synonyms and abbreviations.
 *
 * All keys MUST be IDs that exist in `exerciseLibrary` / `allExercises`
 * (see `src/lib/exercises.ts`). Adding an alias for a non-existent ID is
 * a no-op.
 *
 * Acceptance-test-required seeds (from BACKLOG.md):
 *  - "flat bench" → Barbell Bench Press
 *  - "chest press" → Barbell Bench Press
 *  - "db row" → Dumbbell Row
 */
export const EXERCISE_ALIASES: Record<string, string[]> = {
  // ── Chest ────────────────────────────────────────────────
  'bench-press': ['flat bench', 'bb bench', 'barbell bench', 'chest press', 'bench'],
  'incline-bench-press': ['incline press', 'incline bench', 'incline barbell'],
  'decline-bench-press': ['decline bench', 'decline press'],
  'dumbbell-bench-press': ['db bench', 'db bench press', 'dumbbell bench'],
  'incline-dumbbell-press': ['incline db press', 'db incline press'],
  'machine-chest-press': ['chest press machine', 'seated chest press'],
  'pec-deck': ['chest fly machine', 'butterfly', 'pec fly'],
  'cable-flyes': ['cable crossover', 'cable chest fly'],
  'push-up': ['pushup', 'press up'],
  'chest-dips': ['chest dip', 'parallel bar dip'],

  // ── Back ─────────────────────────────────────────────────
  'deadlift': ['dl', 'conventional deadlift', 'conventional dl'],
  'sumo-deadlift': ['sumo dl'],
  'romanian-deadlift': ['rdl', 'romanian dl'],
  'dumbbell-rdl': ['db rdl', 'dumbbell romanian deadlift'],
  'stiff-leg-deadlift': ['sldl', 'stiff leg dl', 'straight leg deadlift'],
  'barbell-row': ['bb row', 'bent over row', 'barbell bent over row'],
  'pendlay-row': ['pendlay'],
  'dumbbell-row': ['db row', 'single arm row', 'one arm row', 'one arm db row'],
  'cable-row': ['seated row', 'low row', 'seated cable row'],
  'lat-pulldown': ['pulldown', 'wide grip pulldown', 'cable pulldown'],
  'close-grip-pulldown': ['close grip pulldown', 'cg pulldown'],
  'pull-ups': ['pull up', 'pullup', 'wide grip pull up'],
  'chin-ups': ['chin up', 'chinup', 'underhand pull up'],
  't-bar-row': ['t bar row', 'landmine row'],
  'face-pulls': ['face pull', 'cable face pull', 'rear delt pull'],

  // ── Shoulders ────────────────────────────────────────────
  'overhead-press': ['ohp', 'military press', 'standing press', 'shoulder press', 'bb ohp'],
  'seated-overhead-press': ['seated ohp', 'seated military press'],
  'dumbbell-shoulder-press': ['db shoulder press', 'db ohp', 'seated db press'],
  'arnold-press': ['arnold shoulder press'],
  'lateral-raises': ['side raise', 'side lateral', 'db lateral raise', 'lateral raise'],
  'front-raises': ['front raise', 'db front raise'],
  'rear-delt-flyes': ['reverse fly', 'rear delt raise', 'bent over fly'],
  'reverse-pec-deck': ['rear delt machine', 'machine rear delt'],
  'upright-rows': ['upright row', 'bb upright row'],
  'shrugs': ['bb shrug', 'trap shrug', 'barbell shrug'],
  'dumbbell-shrugs': ['db shrug'],

  // ── Arms ─────────────────────────────────────────────────
  'barbell-curl': ['bb curl', 'standing barbell curl', 'bicep curl'],
  'ez-bar-curl': ['ez curl'],
  'dumbbell-curl': ['db curl', 'db bicep curl'],
  'hammer-curls': ['hammer curl', 'neutral grip curl'],
  'preacher-curl': ['ez bar preacher', 'machine preacher curl'],
  'concentration-curl': ['seated concentration curl'],
  'cable-curl': ['straight bar cable curl', 'cable bicep curl'],
  'close-grip-bench': ['cgbp', 'close grip press'],
  'skull-crushers': ['lying tricep extension', 'french press', 'nose breaker'],
  'tricep-pushdown': ['cable pushdown', 'pushdown'],
  'rope-pushdown': ['rope tricep pushdown', 'rope tricep extension'],
  'overhead-tricep-extension': ['db overhead tricep extension', 'seated overhead extension'],
  'kickbacks': ['db kickback', 'tricep kickback'],

  // ── Legs ─────────────────────────────────────────────────
  'back-squat': ['back squat', 'bb squat', 'barbell back squat', 'squat'],
  'front-squat': ['bb front squat'],
  'goblet-squat': ['kb squat', 'kettlebell squat'],
  'leg-press': ['seated leg press', '45 degree leg press', 'machine leg press'],
  'hack-squat': ['hack squat machine'],
  'leg-extension': ['quad extension', 'knee extension'],
  'lunges': ['bb lunge', 'barbell lunge'],
  'walking-lunges': ['walking lunge', 'forward lunge'],
  'split-squat': ['static lunge'],
  'bulgarian-split-squat': ['bss', 'rear foot elevated split squat', 'rfess'],
  'step-ups': ['box step up', 'weighted step up', 'step up'],
  'leg-curl': ['hamstring curl', 'lying leg curl', 'prone leg curl'],
  'seated-leg-curl': ['seated hamstring curl'],
  'hip-thrust': ['barbell hip thrust', 'bb hip thrust', 'glute thrust'],
  'glute-bridge': ['bridge', 'hip bridge'],
  'cable-kickbacks': ['glute kickback', 'cable glute kickback', 'donkey kick'],
  'hyperextensions': ['back extension', '45 degree extension', 'hyper'],
  'good-mornings': ['good morning', 'bb good morning'],

  // ── Calves ───────────────────────────────────────────────
  'standing-calf-raise': ['calf raise', 'calf press'],
  'seated-calf-raise': ['seated calf', 'soleus raise'],

  // ── Core ─────────────────────────────────────────────────
  'plank': ['front plank', 'forearm plank'],
  'leg-raises': ['hanging leg raise', 'hanging knee raise'],
  'cable-crunches': ['kneeling cable crunch', 'rope crunch'],
  'ab-wheel-rollout': ['ab roller', 'wheel rollout', 'ab wheel'],
  'russian-twists': ['russian twist'],
  'pallof-press': ['anti rotation press', 'cable pallof'],
  'dead-bug': ['deadbug'],
  'mountain-climbers': ['mountain climber'],
  'bicycle-crunches': ['bicycle crunch', 'bicycle'],

  // ── Forearms / Carries ───────────────────────────────────
  'farmers-walk': ['farmers carry', 'loaded carry'],
  'wrist-curls': ['wrist curl'],
};

/**
 * Inverse lookup: given a raw query token, return the set of canonical
 * exercise IDs whose alias list contains a match. Used at call sites that
 * want alias resolution without the full Fuse pipeline.
 */
export function resolveAlias(query: string): string[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const matches: string[] = [];
  for (const [id, aliases] of Object.entries(EXERCISE_ALIASES)) {
    if (aliases.some(a => a.toLowerCase() === q)) matches.push(id);
  }
  return matches;
}
