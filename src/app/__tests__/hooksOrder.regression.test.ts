/**
 * Regression guard for React error #310 (white screen) — v19-fix-01.
 *
 * Root cause (2026-06-01): ProfilePage (and siblings calendar/messages) called
 * a `useMemo` AFTER an `if (!isAuthenticated || !user) return null` early
 * return. That is a latent hooks-order violation: the render that takes the
 * early return has fewer hooks than the render that doesn't. It was DORMANT
 * until v19-fix-01 began persisting the trainer store's `sessions` /
 * `clientGroups` via `partialize` — the rehydrate then re-rendered those
 * whole-store subscribers during the auth-settling window, flipping the hook
 * count between renders and crashing with "rendered more hooks than during the
 * previous render" (minified #310) -> blank screen on catalift.net.
 *
 * `react-hooks/rules-of-hooks` statically catches exactly this class of bug
 * ("React Hook ... is called conditionally ... after an early return?"). Next's
 * production `next build` does NOT run ESLint, which is why it shipped. This
 * test fails CI/local if ANY file under src/ reintroduces the violation, so the
 * whole class cannot regress — independent of whether `next build` lints.
 *
 * Run: npx tsx src/app/__tests__/hooksOrder.regression.test.ts
 */
import { ESLint } from 'eslint';

async function main() {
  const eslint = new ESLint({ errorOnUnmatchedPattern: false });
  const results = await eslint.lintFiles(['src/**/*.{ts,tsx}']);

  const violations = results.flatMap((r) =>
    r.messages
      .filter((m) => m.ruleId === 'react-hooks/rules-of-hooks')
      .map((m) => `${r.filePath}:${m.line}:${m.column}  ${m.message}`),
  );

  if (violations.length > 0) {
    console.error(
      `\u274c hooksOrder regression: ${violations.length} react-hooks/rules-of-hooks violation(s):`,
    );
    violations.forEach((v) => console.error('  ' + v));
    console.error(
      '\nA React Hook is being called conditionally / after an early return.\n' +
        'Move every hook ABOVE the component\u2019s early returns (see v19-fix-01 #310).',
    );
    process.exit(1);
  }

  console.log(
    '\u2705 hooksOrder regression: 0 react-hooks/rules-of-hooks violations under src/',
  );
}

main().catch((e) => {
  console.error('hooksOrder regression test failed to run:', e);
  process.exit(1);
});
