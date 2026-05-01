/**
 * Tests for the program-start RangeError fix.
 *
 * Run with: npx tsx src/lib/__tests__/programStartUtils.test.ts
 *
 * Coverage:
 *  - `normalizeSetCount` clamps invalid/negative/Infinity/NaN/oversized/float
 *    values to safe positive integers so `Array.from({ length: n })` never
 *    throws `RangeError: Invalid array length`.
 *  - `convertProgramDayToTemplate` no longer throws when program_data stores a
 *    negative / Infinity / oversized `sets` value (hendrik's program
 *    08d7809d-eadc-4c72-9bcf-55d35eccddc3, prod 2026-05-01).
 *  - Happy-path regression: flat reps and pyramid (`12→10→8→6`) still produce
 *    the expected per-set targetReps values.
 *
 * `programStartUtils.ts` is a pure module (no store imports, no supabase) so
 * we don't need the localStorage / env shims the other suites install.
 */

import {
  normalizeSetCount,
  parseRepsPerSet,
  convertProgramDayToTemplate,
} from '../programStartUtils';

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

// Minimal console.warn spy: matches the rest of the suite's style (plain
// function replacement, no jest/vitest). `capture()` returns a handle you
// can use to count calls and restore the original.
function spyWarn() {
  const original = console.warn;
  const calls: unknown[][] = [];
  console.warn = (...args: unknown[]) => {
    calls.push(args);
  };
  return {
    get count() { return calls.length; },
    get calls() { return calls; },
    restore() { console.warn = original; },
  };
}

(() => {
  console.log('\n--- normalizeSetCount: happy paths ---');
  {
    const warn = spyWarn();
    try {
      assert('normalizeSetCount(5) → 5', normalizeSetCount(5) === 5);
      assert('normalizeSetCount(5) emits no warn', warn.count === 0, `got ${warn.count}`);
    } finally {
      warn.restore();
    }
  }
  {
    const warn = spyWarn();
    try {
      assert("normalizeSetCount('4') → 4", normalizeSetCount('4') === 4);
      assert("normalizeSetCount('4') emits no warn", warn.count === 0, `got ${warn.count}`);
    } finally {
      warn.restore();
    }
  }

  console.log('\n--- normalizeSetCount: invalid → default 3 + warn ---');
  for (const [label, input] of [
    ['0', 0],
    ['-1', -1],
    ['Infinity', Infinity],
    ['-Infinity', -Infinity],
    ['NaN', NaN],
    ["'-2'", '-2'],
    ['undefined', undefined],
    ['null', null],
    ["''", ''],
    ["'abc'", 'abc'],
  ] as [string, unknown][]) {
    const warn = spyWarn();
    try {
      const out = normalizeSetCount(input as any);
      assert(`normalizeSetCount(${label}) → 3`, out === 3, `got ${out}`);
      assert(`normalizeSetCount(${label}) fires warn`, warn.count >= 1, `count=${warn.count}`);
    } finally {
      warn.restore();
    }
  }

  console.log('\n--- normalizeSetCount: clamp / floor → warn ---');
  {
    const warn = spyWarn();
    try {
      const out = normalizeSetCount(100);
      assert('normalizeSetCount(100) → 50', out === 50, `got ${out}`);
      assert('normalizeSetCount(100) fires warn', warn.count >= 1);
    } finally {
      warn.restore();
    }
  }
  {
    const warn = spyWarn();
    try {
      const out = normalizeSetCount(2.7);
      assert('normalizeSetCount(2.7) → 2', out === 2, `got ${out}`);
      assert('normalizeSetCount(2.7) fires warn', warn.count >= 1);
    } finally {
      warn.restore();
    }
  }

  console.log('\n--- normalizeSetCount: contextLabel appears in warn payload ---');
  {
    const warn = spyWarn();
    try {
      normalizeSetCount(-1, 'Bench Press');
      const joined = warn.calls.flat().map(v => String(v)).join(' ');
      assert(
        'warn payload contains contextLabel',
        joined.includes('Bench Press'),
        `payload=${joined}`,
      );
    } finally {
      warn.restore();
    }
  }

  console.log('\n--- convertProgramDayToTemplate: no throw on malformed sets ---');
  const mkDay = (sets: unknown) => ({
    dayLabel: 'Day 1',
    blocks: [
      {
        id: 'b1',
        type: 'work',
        name: 'Work',
        exercises: [
          {
            id: 'e1',
            exerciseId: 'bench-press',
            exerciseName: 'Bench Press',
            sets,
            reps: '10',
            rest: '90s',
          },
        ],
      },
    ],
  });
  const opts = { programId: 'p1', dayIndex: 0, programName: 'Test', userId: 'u1' };

  for (const [label, sets, expectedLen] of [
    ['sets: -1 → length 3 (default)', -1, 3],
    ['sets: Infinity → length 3 (default)', Infinity, 3],
    ['sets: NaN → length 3 (default)', NaN, 3],
    ['sets: 0 → length 3 (default)', 0, 3],
    ['sets: 100 → length 50 (clamped)', 100, 50],
    ['sets: 2.7 → length 2 (floored)', 2.7, 2],
  ] as [string, unknown, number][]) {
    const warn = spyWarn();
    try {
      let tpl: any;
      let threw = false;
      try {
        tpl = convertProgramDayToTemplate(mkDay(sets), opts);
      } catch (e) {
        threw = true;
      }
      assert(`convertProgramDayToTemplate ${label} does not throw`, !threw);
      assert(
        `convertProgramDayToTemplate ${label} produces sets.length === ${expectedLen}`,
        !threw && tpl.exercises[0].sets.length === expectedLen,
        threw ? 'threw' : `got ${tpl.exercises[0].sets.length}`,
      );
    } finally {
      warn.restore();
    }
  }

  console.log('\n--- convertProgramDayToTemplate: happy-path regressions ---');
  {
    const warn = spyWarn();
    try {
      const tpl: any = convertProgramDayToTemplate(
        {
          dayLabel: 'Day 1',
          blocks: [
            {
              id: 'b1',
              type: 'work',
              name: 'Work',
              exercises: [{ exerciseId: 'x', exerciseName: 'X', sets: 4, reps: '10', rest: '60s' }],
            },
          ],
        },
        opts,
      );
      const setsArr = tpl.exercises[0].sets;
      assert('flat reps: 4 sets produced', setsArr.length === 4, `got ${setsArr.length}`);
      assert(
        'flat reps: every set has targetReps === 10',
        setsArr.every((s: any) => s.targetReps === 10),
        JSON.stringify(setsArr.map((s: any) => s.targetReps)),
      );
      assert('flat reps: no warn', warn.count === 0, `count=${warn.count}`);
    } finally {
      warn.restore();
    }
  }
  {
    const warn = spyWarn();
    try {
      const tpl: any = convertProgramDayToTemplate(
        {
          dayLabel: 'Day 1',
          blocks: [
            {
              id: 'b1',
              type: 'work',
              name: 'Work',
              exercises: [{ exerciseId: 'x', exerciseName: 'X', sets: 4, reps: '12→10→8→6', rest: '60s' }],
            },
          ],
        },
        opts,
      );
      const setsArr = tpl.exercises[0].sets;
      const targets = setsArr.map((s: any) => s.targetReps);
      assert('pyramid reps: 4 sets produced', setsArr.length === 4, `got ${setsArr.length}`);
      assert(
        'pyramid reps: per-set targetReps are 12/10/8/6',
        JSON.stringify(targets) === JSON.stringify([12, 10, 8, 6]),
        JSON.stringify(targets),
      );
      assert('pyramid reps: no warn', warn.count === 0, `count=${warn.count}`);
    } finally {
      warn.restore();
    }
  }

  console.log('\n--- parseRepsPerSet: tolerates invalid setCount (belt-and-braces) ---');
  {
    const warn = spyWarn();
    try {
      let out: number[] = [];
      let threw = false;
      try {
        out = parseRepsPerSet('10', -5 as number);
      } catch (e) {
        threw = true;
      }
      assert('parseRepsPerSet(-5) does not throw', !threw);
      assert('parseRepsPerSet(-5) returns length-3 default', !threw && out.length === 3, `len=${out.length}`);
      assert('parseRepsPerSet(-5) fires warn', warn.count >= 1);
    } finally {
      warn.restore();
    }
  }

  // --- Summary ---
  console.log(`\n--- Summary: ${passed} passed, ${failed} failed ---`);
  if (failed > 0) process.exit(1);
})();
