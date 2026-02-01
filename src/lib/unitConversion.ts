// Unit conversion utilities for weight display

import { WeightUnit } from '@/types';

// Conversion constants
const KG_TO_LB = 2.20462;
const LB_TO_KG = 0.453592;

/**
 * Convert weight from kg to the target unit
 * All data is stored in kg, this converts for display
 */
export function convertWeight(weightKg: number, targetUnit: WeightUnit): number {
  if (targetUnit === 'lb') {
    return Math.round(weightKg * KG_TO_LB * 10) / 10; // Round to 1 decimal
  }
  return Math.round(weightKg * 10) / 10;
}

/**
 * Convert weight from display unit back to kg for storage
 */
export function convertToKg(weight: number, fromUnit: WeightUnit): number {
  if (fromUnit === 'lb') {
    return Math.round(weight * LB_TO_KG * 10) / 10;
  }
  return weight;
}

/**
 * Format weight with unit suffix
 */
export function formatWeight(weightKg: number, unit: WeightUnit): string {
  const converted = convertWeight(weightKg, unit);
  return `${converted}${unit}`;
}

/**
 * Format weight for display with optional decimal places
 */
export function formatWeightDisplay(weightKg: number, unit: WeightUnit, decimals: number = 1): string {
  const converted = convertWeight(weightKg, unit);
  return converted.toFixed(decimals);
}

/**
 * Get the unit label
 */
export function getUnitLabel(unit: WeightUnit): string {
  return unit;
}

/**
 * Hook-friendly weight formatter that uses user's exercise unit preference
 */
export function useWeightFormatter(exerciseUnit: WeightUnit = 'kg') {
  return {
    format: (weightKg: number) => formatWeight(weightKg, exerciseUnit),
    convert: (weightKg: number) => convertWeight(weightKg, exerciseUnit),
    unit: exerciseUnit,
    toKg: (weight: number) => convertToKg(weight, exerciseUnit),
  };
}
