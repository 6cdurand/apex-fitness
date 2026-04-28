/**
 * Tests for the unified exercise search.
 *
 * Run with: npx tsx src/lib/__tests__/exerciseSearch.test.ts
 *
 * Acceptance (BACKLOG.md P0):
 *  - identical results in active workout + builders for any query;
 *  - "cheast prese" returns a bench-press variant in the top 3;
 *  - "db row" alias returns "Dumbbell Row" first.
 */

import { searchExercises, __resetSearchCacheForTests } from '../exerciseSearch';
import { allExercises } from '../exercises';

let passed = 0;
let failed = 0;
function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    console.error(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

__resetSearchCacheForTests();

// ============ Empty query ============
console.log('\n--- empty query ---');
{
  const res = searchExercises('');
  assert('empty query returns the full library', res.length === allExercises.length);
}
{
  const res = searchExercises('   ');
  assert('whitespace-only query is treated as empty', res.length === allExercises.length);
}
{
  const res = searchExercises('', { blockType: 'warmup' });
  const onlyWarmup = res.every(
    e => e.category === 'warmup' || e.category === 'stretching' || e.category === 'activation',
  );
  assert('empty query + blockType=warmup returns only warm-up-eligible exercises', onlyWarmup && res.length > 0);
}
{
  const res = searchExercises('', { blockType: 'work' });
  const onlyWork = res.every(
    e => e.category !== 'warmup' && e.category !== 'cardio' && e.category !== 'stretching' && e.category !== 'activation',
  );
  assert('empty query + blockType=work excludes warm-up / cardio / stretching', onlyWork && res.length > 0);
}

// ============ Exact-name query ============
console.log('\n--- exact-name query ---');
{
  const res = searchExercises('Dumbbell Row');
  assert('exact name "Dumbbell Row" puts dumbbell-row first', res[0]?.id === 'dumbbell-row');
}
{
  const res = searchExercises('Bench Press');
  const top3Ids = res.slice(0, 3).map(e => e.id);
  assert(
    '"Bench Press" puts bench-press in the top 3',
    top3Ids.includes('bench-press'),
    `top3=${top3Ids.join(',')}`,
  );
}

// ============ Alias resolution ============
console.log('\n--- alias resolution ---');
{
  const res = searchExercises('db row');
  assert(
    '"db row" alias returns Dumbbell Row first',
    res[0]?.id === 'dumbbell-row',
    `top=${res[0]?.id}`,
  );
}
{
  const res = searchExercises('flat bench');
  const top3Ids = res.slice(0, 3).map(e => e.id);
  assert(
    '"flat bench" alias puts bench-press in top 3',
    top3Ids.includes('bench-press'),
    `top3=${top3Ids.join(',')}`,
  );
}
{
  const res = searchExercises('chest press');
  const top3Ids = res.slice(0, 3).map(e => e.id);
  assert(
    '"chest press" alias puts a bench/press variant in top 3',
    top3Ids.includes('bench-press') || top3Ids.includes('machine-chest-press'),
    `top3=${top3Ids.join(',')}`,
  );
}
{
  const res = searchExercises('ohp');
  const top3Ids = res.slice(0, 3).map(e => e.id);
  assert(
    '"ohp" alias puts overhead-press in top 3',
    top3Ids.includes('overhead-press'),
    `top3=${top3Ids.join(',')}`,
  );
}
{
  const res = searchExercises('rdl');
  assert(
    '"rdl" alias returns romanian-deadlift first',
    res[0]?.id === 'romanian-deadlift',
    `top=${res[0]?.id}`,
  );
}

// ============ Fuzzy / typo tolerance (acceptance criterion) ============
console.log('\n--- fuzzy / typo tolerance ---');
{
  const res = searchExercises('cheast prese');
  const top3Ids = res.slice(0, 3).map(e => e.id);
  // BACKLOG spec says "Bench Press (Flat) in top 3"; library uses canonical
  // names, so we assert the spirit: any bench/chest-press variant in top 3.
  const hasChestPress = top3Ids.some(id => id.includes('bench') || id.includes('chest-press'));
  assert(
    'BACKLOG: "cheast prese" returns a bench/chest-press variant in top 3',
    hasChestPress,
    `top3=${top3Ids.join(',')}`,
  );
}
{
  const res = searchExercises('lat puldown');
  const top3Ids = res.slice(0, 3).map(e => e.id);
  assert(
    '"lat puldown" (typo) finds lat-pulldown in top 3',
    top3Ids.includes('lat-pulldown'),
    `top3=${top3Ids.join(',')}`,
  );
}

// ============ Block-type filter (when searching) ============
console.log('\n--- block-type filter while searching ---');
{
  const res = searchExercises('press', { blockType: 'warmup' });
  // No press lives in warmup/stretching/activation in the seed library.
  // We just want to assert that whatever comes back is in those categories.
  const onlyWarmup = res.every(
    e => e.category === 'warmup' || e.category === 'stretching' || e.category === 'activation',
  );
  assert('search "press" + blockType=warmup yields only warm-up categories (or none)', onlyWarmup);
}
{
  const res = searchExercises('squat', { blockType: 'work' });
  const allWork = res.every(
    e => e.category !== 'warmup' && e.category !== 'cardio' && e.category !== 'stretching' && e.category !== 'activation',
  );
  assert('search "squat" + blockType=work returns only work-eligible exercises', allWork && res.length > 0);
}

// ============ Limit ============
console.log('\n--- limit ---');
{
  const res = searchExercises('', { limit: 5 });
  assert('limit=5 caps results to 5', res.length === 5);
}
{
  const res = searchExercises('press', { limit: 3 });
  assert('search + limit=3 caps results to 3', res.length <= 3);
}

// ============ Categories filter ============
console.log('\n--- categories filter ---');
{
  const res = searchExercises('', { categories: ['cardio'] });
  const onlyCardio = res.every(e => e.category === 'cardio');
  assert('categories=[cardio] returns only cardio exercises', onlyCardio && res.length > 0);
}

// ============ Extra exercises (custom) ============
console.log('\n--- extra exercises (custom) ---');
{
  const custom = [
    {
      id: 'custom-foo-bar',
      name: 'Foo Bar Curl',
      primaryMuscles: ['biceps' as const],
      secondaryMuscles: [],
      category: 'isolation' as const,
      equipment: 'other' as const,
      isCustom: true,
    },
  ];
  const res = searchExercises('foo bar', { extraExercises: custom });
  assert(
    'extraExercises includes custom items in search',
    res[0]?.id === 'custom-foo-bar',
    `top=${res[0]?.id}`,
  );
}

// ============ Cross-surface parity ============
// All three pages call searchExercises(query, opts) with the same arguments
// → they must get identical, identically-ordered results.
console.log('\n--- cross-surface parity ---');
{
  const queries = ['bench', 'db row', 'cheast prese', 'rdl', 'tricep'];
  const opts = { blockType: 'work' as const, limit: 25 };
  let parity = true;
  for (const q of queries) {
    const a = searchExercises(q, opts).map(e => e.id).join('|');
    const b = searchExercises(q, opts).map(e => e.id).join('|');
    const c = searchExercises(q, opts).map(e => e.id).join('|');
    if (a !== b || b !== c) {
      parity = false;
      console.error(`    parity broke for query="${q}": ${a} vs ${b} vs ${c}`);
    }
  }
  assert('searchExercises is deterministic across calls (identical results for same args)', parity);
}

// ============ Summary ============
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
