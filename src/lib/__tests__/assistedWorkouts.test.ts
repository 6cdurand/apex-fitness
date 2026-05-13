/**
 * v11-D4: Assisted workout regression tests
 * Tests tier ranking inversion, volume PB updates, and graduation medals.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { getTierFor1RM, getProgressInTier } from '../strengthRating';

describe('Assisted Workout Tests', () => {
  test('Tier ranking inverts for assisted exercises (lower counterweight = better)', () => {
    // Elite tier: 0-5kg counterweight
    assert.strictEqual(getTierFor1RM(5, 'assisted-pull-up', true), 'elite');
    assert.strictEqual(getTierFor1RM(2, 'assisted-pull-up', true), 'elite');
    
    // Advanced tier: 5-15kg counterweight
    assert.strictEqual(getTierFor1RM(10, 'assisted-pull-up', true), 'advanced');
    
    // Intermediate tier: 15-30kg counterweight
    assert.strictEqual(getTierFor1RM(20, 'assisted-pull-up', true), 'intermediate');
    
    // Novice tier: 30-45kg counterweight
    assert.strictEqual(getTierFor1RM(35, 'assisted-pull-up', true), 'novice');
    
    // Beginner tier: 45-60kg counterweight
    assert.strictEqual(getTierFor1RM(50, 'assisted-pull-up', true), 'beginner');
    assert.strictEqual(getTierFor1RM(60, 'assisted-pull-up', true), 'beginner');
  });

  test('Tier ranking works for female assisted exercises', () => {
    // Elite tier: 0-4kg counterweight (female)
    assert.strictEqual(getTierFor1RM(2, 'assisted-pull-up', false), 'elite');
    
    // Beginner tier: 40-50kg counterweight (female)
    assert.strictEqual(getTierFor1RM(45, 'assisted-pull-up', false), 'beginner');
  });

  test('Assisted chin-up tier ranking', () => {
    assert.strictEqual(getTierFor1RM(3, 'assisted-chin-up', true), 'elite');
    assert.strictEqual(getTierFor1RM(50, 'assisted-chin-up', true), 'beginner');
  });

  test('Assisted dips tier ranking', () => {
    assert.strictEqual(getTierFor1RM(2, 'assisted-dips', true), 'elite');
    assert.strictEqual(getTierFor1RM(45, 'assisted-dips', true), 'beginner');
  });

  test('Progress within tier for assisted exercises (lower-is-better)', () => {
    // Starting at 28kg (near top of intermediate tier 15-30) should show low progress
    const result1 = getProgressInTier(28, 'assisted-pull-up', true);
    assert.strictEqual(result1.tier, 'intermediate');
    assert.ok(result1.progress < 20, 'Progress should be low near tier max');
    
    // At 16kg (near bottom of intermediate tier) should show high progress
    const result2 = getProgressInTier(16, 'assisted-pull-up', true);
    assert.strictEqual(result2.tier, 'intermediate');
    assert.ok(result2.progress > 80, 'Progress should be high near tier min');
    
    // Midpoint (22.5kg) should show ~50% progress
    const result3 = getProgressInTier(22, 'assisted-pull-up', true);
    assert.strictEqual(result3.tier, 'intermediate');
    assert.ok(result3.progress > 40 && result3.progress < 60, 'Progress should be ~50% at midpoint');
  });

  test('Standard exercises still work correctly (higher-is-better)', () => {
    // Bench press: higher weight = better
    assert.strictEqual(getTierFor1RM(180, 'bench-press', true), 'elite');
    assert.strictEqual(getTierFor1RM(45, 'bench-press', true), 'beginner');
    
    // Pull-up (weighted): higher added weight = better
    assert.strictEqual(getTierFor1RM(60, 'pull-up', true), 'elite');
    assert.strictEqual(getTierFor1RM(-12, 'pull-up', true), 'beginner');
  });
});
