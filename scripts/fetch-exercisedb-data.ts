/**
 * Fetch exercise data from ExerciseDB free API and map to our exercise library.
 * 
 * Usage: npx tsx scripts/fetch-exercisedb-data.ts
 * 
 * Uses the free open-source ExerciseDB API (no API key required):
 *   https://exercisedb-api.vercel.app
 * 
 * Outputs:
 *  - scripts/exercisedb-mapping.json  (raw mapping for review)
 *  - Updates src/lib/exerciseAnimations.ts with correct GIF URLs
 */

import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'https://exercisedb-api.vercel.app/api/v1';

interface ExerciseDBEntry {
  exerciseId: string;
  name: string;
  gifUrl: string;
  targetMuscles: string[];
  bodyParts: string[];
  equipments: string[];
  secondaryMuscles: string[];
  instructions: string[];
}

// Our exercise IDs extracted from exercises.ts
function getOurExerciseIds(): { id: string; name: string }[] {
  const exercisesPath = path.join(__dirname, '..', 'src', 'lib', 'exercises.ts');
  const content = fs.readFileSync(exercisesPath, 'utf-8');
  const entries: { id: string; name: string }[] = [];
  const seen = new Set<string>();
  
  // Match exercise objects — handles both quoted styles
  const objRegex = /id:\s*'([^']+)',\s*\n\s*name:\s*(?:'([^']*(?:\\.[^']*)*)'|"([^"]*)")/g;
  
  let match;
  while ((match = objRegex.exec(content)) !== null) {
    const id = match[1];
    const name = match[2] || match[3];
    if (!seen.has(id)) {
      seen.add(id);
      entries.push({ id, name });
    }
  }
  
  return entries;
}

async function fetchAllExercises(): Promise<ExerciseDBEntry[]> {
  const allExercises: ExerciseDBEntry[] = [];
  const limit = 100; // API max is 100 per request
  let offset = 0;
  
  console.log('Fetching exercises from ExerciseDB (free API)...');
  
  while (true) {
    const url = `${BASE_URL}/exercises?limit=${limit}&offset=${offset}`;
    console.log(`  Fetching offset=${offset}...`);
    
    const res = await fetch(url);
    
    // Handle rate limiting with retry
    if (res.status === 429) {
      console.log(`  Rate limited at offset=${offset}, waiting 10s...`);
      await new Promise(r => setTimeout(r, 10000));
      continue; // Retry same offset
    }
    
    if (!res.ok) {
      console.error(`API error ${res.status}: ${await res.text()}`);
      break;
    }
    
    const json = await res.json();
    const data: ExerciseDBEntry[] = json.data || [];
    if (data.length === 0) break;
    
    allExercises.push(...data);
    offset += limit;
    
    // Generous delay to avoid rate limits (free API)
    await new Promise(r => setTimeout(r, 2000));
  }
  
  console.log(`Fetched ${allExercises.length} exercises from ExerciseDB\n`);
  return allExercises;
}

// ===== MATCHING ENGINE =====

function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getKeywords(name: string): string[] {
  const norm = normalize(name);
  // Remove common filler words
  const stopWords = new Set(['the', 'a', 'an', 'with', 'on', 'to', 'for', 'and', 'or', 'of', 'in']);
  return norm.split(' ').filter(w => w.length >= 2 && !stopWords.has(w));
}

// Synonym map: our term → ExerciseDB terms
const SYNONYMS: Record<string, string[]> = {
  'press': ['press', 'pushing'],
  'row': ['row', 'rowing'],
  'curl': ['curl', 'curling'],
  'raise': ['raise', 'raising'],
  'fly': ['fly', 'flye', 'flies', 'flyes'],
  'flye': ['fly', 'flye', 'flies', 'flyes'],
  'flyes': ['fly', 'flye', 'flies', 'flyes'],
  'pulldown': ['pulldown', 'pull down', 'pull-down'],
  'pushdown': ['pushdown', 'push down', 'push-down'],
  'dip': ['dip', 'dips'],
  'dips': ['dip', 'dips'],
  'squat': ['squat', 'squats', 'squatting'],
  'lunge': ['lunge', 'lunges', 'lunging'],
  'lunges': ['lunge', 'lunges', 'lunging'],
  'extension': ['extension', 'extensions', 'extending'],
  'crunch': ['crunch', 'crunches', 'crunching'],
  'crunches': ['crunch', 'crunches'],
  'deadlift': ['deadlift', 'dead lift'],
  'pushup': ['push up', 'push-up', 'pushup'],
  'pullup': ['pull up', 'pull-up', 'pullup'],
  'chinup': ['chin up', 'chin-up', 'chinup'],
  'bench': ['bench'],
  'barbell': ['barbell', 'bar'],
  'dumbbell': ['dumbbell', 'dumbell'],
  'cable': ['cable'],
  'machine': ['machine', 'lever', 'assisted'],
  'smith': ['smith'],
  'kettlebell': ['kettlebell'],
  'overhead': ['overhead', 'over head'],
  'incline': ['incline', 'inclined'],
  'decline': ['decline', 'declined'],
  'seated': ['seated', 'sitting'],
  'standing': ['standing'],
  'lying': ['lying'],
  'reverse': ['reverse', 'reversed'],
  'hip': ['hip'],
  'thrust': ['thrust', 'thrusting'],
  'kickback': ['kickback', 'kick back'],
  'shrug': ['shrug', 'shrugs'],
  'shrugs': ['shrug', 'shrugs'],
};

// Manual overrides for exercises that won't fuzzy match
const MANUAL_SEARCH_TERMS: Record<string, string> = {
  'bench-press': 'barbell bench press',
  'incline-bench-press': 'barbell incline bench press',
  'decline-bench-press': 'barbell decline bench press',
  'dumbbell-bench-press': 'dumbbell bench press',
  'incline-dumbbell-press': 'dumbbell incline bench press',
  'dumbbell-flyes': 'dumbbell fly',
  'cable-flyes': 'cable fly',
  'chest-dips': 'chest dip',
  'push-ups': 'push up',
  'machine-chest-press': 'lever chest press',
  'pec-deck': 'pec deck fly',
  'deadlift': 'barbell deadlift',
  'sumo-deadlift': 'barbell sumo deadlift',
  'romanian-deadlift': 'barbell romanian deadlift',
  'dumbbell-rdl': 'dumbbell romanian deadlift',
  'barbell-row': 'barbell bent over row',
  'pendlay-row': 'barbell bent over row',
  'dumbbell-row': 'dumbbell bent over row',
  'pull-ups': 'pull up',
  'chin-ups': 'chin up',
  'lat-pulldown': 'cable lat pulldown',
  'close-grip-pulldown': 'cable close grip lat pulldown',
  'cable-row': 'cable seated row',
  't-bar-row': 'lever t bar row',
  'machine-row': 'lever seated row',
  'face-pulls': 'cable face pull',
  'straight-arm-pulldown': 'cable straight arm pulldown',
  'hyperextensions': 'hyperextension',
  'overhead-press': 'barbell overhead press',
  'seated-overhead-press': 'barbell seated overhead press',
  'dumbbell-shoulder-press': 'dumbbell shoulder press',
  'arnold-press': 'dumbbell arnold press',
  'lateral-raises': 'dumbbell lateral raise',
  'cable-lateral-raises': 'cable lateral raise',
  'front-raises': 'dumbbell front raise',
  'rear-delt-flyes': 'dumbbell rear delt fly',
  'reverse-pec-deck': 'lever reverse fly',
  'upright-rows': 'barbell upright row',
  'shrugs': 'barbell shrug',
  'dumbbell-shrugs': 'dumbbell shrug',
  'barbell-curl': 'barbell curl',
  'ez-bar-curl': 'ez barbell curl',
  'dumbbell-curl': 'dumbbell biceps curl',
  'hammer-curls': 'dumbbell hammer curl',
  'incline-dumbbell-curl': 'dumbbell incline curl',
  'preacher-curl': 'barbell preacher curl',
  'concentration-curl': 'dumbbell concentration curl',
  'cable-curl': 'cable curl',
  'spider-curls': 'dumbbell spider curl',
  'close-grip-bench': 'barbell close grip bench press',
  'tricep-dips': 'triceps dip',
  'skull-crushers': 'barbell lying triceps extension skull crusher',
  'tricep-pushdown': 'cable pushdown',
  'rope-pushdown': 'cable rope pushdown',
  'overhead-tricep-extension': 'dumbbell overhead triceps extension',
  'cable-overhead-extension': 'cable overhead triceps extension',
  'kickbacks': 'dumbbell kickback',
  'diamond-pushups': 'diamond push up',
  'back-squat': 'barbell full squat',
  'front-squat': 'barbell front squat',
  'goblet-squat': 'dumbbell goblet squat',
  'leg-press': 'leg press',
  'hack-squat': 'sled hack squat',
  'leg-extension': 'lever leg extension',
  'lunges': 'barbell lunge',
  'walking-lunges': 'dumbbell walking lunge',
  'split-squat': 'dumbbell split squat',
  'bulgarian-split-squat': 'dumbbell bulgarian split squat',
  'step-ups': 'dumbbell step up',
  'sissy-squat': 'sissy squat',
  'leg-curl': 'lever lying leg curl',
  'seated-leg-curl': 'lever seated leg curl',
  'stiff-leg-deadlift': 'barbell stiff leg deadlift',
  'good-mornings': 'barbell good morning',
  'hip-thrust': 'barbell hip thrust',
  'glute-bridge': 'glute bridge',
  'cable-kickbacks': 'cable glute kickback',
  'glute-ham-raise': 'glute ham raise',
  'nordic-curl': 'nordic curl',
  'standing-calf-raise': 'lever standing calf raise',
  'seated-calf-raise': 'lever seated calf raise',
  'donkey-calf-raise': 'donkey calf raise',
  'leg-press-calf-raise': 'sled calf press on leg press',
  'crunches': 'crunch',
  'sit-ups': 'sit up',
  'leg-raises': 'hanging leg raise',
  'lying-leg-raises': 'lying leg raise',
  'plank': 'front plank',
  'russian-twists': 'russian twist',
  'cable-crunches': 'cable crunch',
  'ab-wheel-rollout': 'wheel rollout',
  'mountain-climbers': 'mountain climber',
  'bicycle-crunches': 'bicycle crunch',
  'dead-bug': 'dead bug',
  'pallof-press': 'cable pallof press',
  'woodchoppers': 'cable wood chop',
  'wrist-curls': 'barbell wrist curl',
  'reverse-wrist-curls': 'barbell reverse wrist curl',
  'farmers-walk': 'farmer walk',
  'hip-abduction': 'hip abduction machine',
  'hip-adduction': 'hip adduction machine',
  'cable-crossover': 'cable crossover',
  'cable-fly-low-to-high': 'cable low fly',
  'kettlebell-swing': 'kettlebell swing',
  'kettlebell-goblet-squat': 'kettlebell goblet squat',
  'kettlebell-deadlift': 'kettlebell deadlift',
  'kettlebell-rdl': 'kettlebell romanian deadlift',
  'power-clean': 'barbell power clean',
  'push-press': 'barbell push press',
  'bodyweight-squat': 'bodyweight squat',
  'jumping-jacks': 'jumping jack',
  'high-knees': 'high knee',
  'burpees': 'burpee',
  'box-jumps': 'box jump',
  'jump-rope': 'jump rope',
  'plank-hold': 'front plank',
  'side-plank': 'side plank',
  'knee-raises': 'hanging knee raise',
  'bird-dog': 'bird dog',
  'inchworm': 'inchworm',
  'butt-kicks': 'butt kick',
  'assisted-pull-up': 'assisted pull up',
  'reverse-lunges': 'dumbbell reverse lunge',
  'box-squat': 'barbell box squat',
  'tricep-extension-machine': 'lever triceps extension',
  'bicep-curl-machine': 'lever biceps curl',
  'ab-crunch-machine': 'lever crunch',
  'machine-shoulder-press': 'lever shoulder press',
  'lateral-raise-machine': 'lever lateral raise',
  'hip-thrust-machine': 'lever hip thrust',
  'chest-fly-machine': 'lever fly',
  'incline-chest-press-machine': 'lever incline chest press',
  'high-row-machine': 'lever high row',
  'rdl-machine': 'lever romanian deadlift',
  'seated-row-machine': 'lever seated row',
  'chest-supported-row-machine': 'lever chest supported row',
  'rear-delt-machine': 'lever reverse fly',
  'glute-kickback-machine': 'lever glute kickback',
  'inner-thigh-machine': 'lever hip adduction',
  'outer-thigh-machine': 'lever hip abduction',
  'preacher-curl-machine': 'lever preacher curl',
  'tricep-dip-machine': 'lever triceps dip',
  'smith-machine-bench-press': 'smith machine bench press',
  'smith-machine-incline-press': 'smith machine incline bench press',
  'smith-machine-squat': 'smith machine squat',
  'smith-machine-shoulder-press': 'smith machine shoulder press',
  'smith-machine-row': 'smith machine bent over row',
  'smith-machine-lunge': 'smith machine lunge',
  'smith-machine-calf-raise': 'smith machine calf raise',
  'smith-machine-shrug': 'smith machine shrug',
  'smith-machine-upright-row': 'smith machine upright row',
  'smith-machine-hip-thrust': 'smith machine hip thrust',
  'shoulder-tap-plank': 'shoulder tap',
  'rowing-machine': 'rowing machine',
  'stationary-bike': 'stationary bike',
  'battle-ropes': 'battle rope',
};

function scoreFuzzyMatch(ourName: string, dbName: string): number {
  const ourWords = getKeywords(ourName);
  const dbWords = getKeywords(dbName);
  
  if (ourWords.length === 0 || dbWords.length === 0) return 0;
  
  let matchedOurWords = 0;
  for (const w of ourWords) {
    const synonyms = SYNONYMS[w] || [w];
    const matched = dbWords.some(dw => 
      synonyms.some(syn => dw === syn || dw.startsWith(syn) || syn.startsWith(dw))
    );
    if (matched) matchedOurWords++;
  }
  
  let matchedDbWords = 0;
  for (const dw of dbWords) {
    const matched = ourWords.some(w => {
      const synonyms = SYNONYMS[w] || [w];
      return synonyms.some(syn => dw === syn || dw.startsWith(syn) || syn.startsWith(dw));
    });
    if (matched) matchedDbWords++;
  }
  
  // Weighted score: favor matching most of OUR words (precision) 
  // and some of DB words (relevance)
  const precision = matchedOurWords / ourWords.length;
  const recall = matchedDbWords / dbWords.length;
  
  return (precision * 0.7) + (recall * 0.3);
}

function findBestMatch(ourId: string, ourName: string, dbExercises: ExerciseDBEntry[]): ExerciseDBEntry | null {
  // Try manual search term first
  const searchTerm = MANUAL_SEARCH_TERMS[ourId];
  
  if (searchTerm) {
    const normSearch = normalize(searchTerm);
    // Exact match on manual term
    const exact = dbExercises.find(e => normalize(e.name) === normSearch);
    if (exact) return exact;
    
    // Contains match on manual term
    const contains = dbExercises.find(e => normalize(e.name).includes(normSearch));
    if (contains) return contains;
    
    // Reverse contains
    const reverse = dbExercises.find(e => normSearch.includes(normalize(e.name)));
    if (reverse) return reverse;
    
    // Fuzzy on manual term
    let bestScore = 0;
    let bestMatch: ExerciseDBEntry | null = null;
    for (const entry of dbExercises) {
      const score = scoreFuzzyMatch(searchTerm, entry.name);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = entry;
      }
    }
    if (bestMatch && bestScore >= 0.55) return bestMatch;
  }
  
  // Try fuzzy matching on our exercise name
  const normOur = normalize(ourName);
  
  // Exact match
  const exact = dbExercises.find(e => normalize(e.name) === normOur);
  if (exact) return exact;
  
  // Contains
  const contains = dbExercises.find(e => normalize(e.name).includes(normOur));
  if (contains) return contains;
  
  // Reverse contains
  const reverse = dbExercises.find(e => normOur.includes(normalize(e.name)));
  if (reverse) return reverse;
  
  // Score-based
  let bestScore = 0;
  let bestMatch: ExerciseDBEntry | null = null;
  for (const entry of dbExercises) {
    const score = scoreFuzzyMatch(ourName, entry.name);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = entry;
    }
  }
  
  if (bestMatch && bestScore >= 0.5) return bestMatch;
  return null;
}

// ===== MAIN =====

async function main() {
  const ourExercises = getOurExerciseIds();
  console.log(`Found ${ourExercises.length} exercises in our library`);
  
  const dbExercises = await fetchAllExercises();
  
  // Build mapping
  const mapping: Record<string, { gifUrl: string; instructions: string; dbName: string; dbId: string }> = {};
  let matched = 0;
  let unmatched = 0;
  const unmatchedList: string[] = [];
  
  for (const ex of ourExercises) {
    const match = findBestMatch(ex.id, ex.name, dbExercises);
    if (match && match.gifUrl) {
      mapping[ex.id] = {
        gifUrl: match.gifUrl,
        instructions: match.instructions?.map(s => s.replace(/^Step:\d+\s*/, '')).join(' ') || '',
        dbName: match.name,
        dbId: match.exerciseId,
      };
      console.log(`  ✅ ${ex.name} → ${match.name}`);
      matched++;
    } else {
      console.log(`  ❌ No match: ${ex.name} (${ex.id})`);
      unmatchedList.push(`${ex.name} (${ex.id})`);
      unmatched++;
    }
  }
  
  console.log(`\n========================================`);
  console.log(`Matched: ${matched}, Unmatched: ${unmatched}`);
  if (unmatchedList.length > 0) {
    console.log(`\nUnmatched exercises:`);
    unmatchedList.forEach(e => console.log(`  - ${e}`));
  }
  
  // Save raw mapping
  const mappingPath = path.join(__dirname, 'exercisedb-mapping.json');
  fs.writeFileSync(mappingPath, JSON.stringify(mapping, null, 2));
  console.log(`\nSaved mapping to ${mappingPath}`);
  
  // Generate updated exerciseAnimations.ts (MERGE with existing, don't overwrite)
  generateAnimationsFile(mapping);
}

function generateAnimationsFile(mapping: Record<string, { gifUrl: string; instructions: string; dbName: string; dbId: string }>) {
  // Read existing file to preserve manually curated entries
  const outPath = path.join(__dirname, '..', 'src', 'lib', 'exerciseAnimations.ts');
  
  const lines: string[] = [
    '/**',
    ' * Exercise Animation GIF URLs mapped from ExerciseDB',
    ' * Source: https://exercisedb-api.vercel.app',
    ' * ',
    ' * Auto-generated by scripts/fetch-exercisedb-data.ts',
    ' * Maps our exercise IDs to animated GIF URLs showing proper form.',
    ' * Used in: exercise info dialogs, exercise picker, workout detail page.',
    ' */',
    '',
    'export const exerciseAnimationMap: Record<string, string> = {',
  ];
  
  const entries = Object.entries(mapping).sort(([a], [b]) => a.localeCompare(b));
  
  for (const [id, data] of entries) {
    lines.push(`  '${id}': '${data.gifUrl}', // ${data.dbName}`);
  }
  
  lines.push('};');
  lines.push('');
  lines.push('/**');
  lines.push(' * Get the animation GIF URL for an exercise by ID.');
  lines.push(' * Returns undefined if no animation is available.');
  lines.push(' */');
  lines.push('export function getExerciseAnimationUrl(exerciseId: string): string | undefined {');
  lines.push('  return exerciseAnimationMap[exerciseId];');
  lines.push('}');
  lines.push('');
  
  fs.writeFileSync(outPath, lines.join('\n'));
  console.log(`Updated ${outPath} with ${entries.length} GIF URLs`);
}

main().catch(console.error);
