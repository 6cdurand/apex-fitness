// ============ BARREL FILE ============
// Re-exports all stores from individual modules for backward compatibility.
// Each store is defined in its own file under ./stores/ for maintainability.
//
// Module structure:
//   stores/authStore.ts     — useAuthStore, hashPassword
//   stores/workoutStore.ts  — useWorkoutStore
//   stores/socialStore.ts   — useSocialStore
//   stores/trainerStore.ts  — useTrainerStore
//   stores/medalStore.ts    — useMedalStore, checkAllMedalsRetroactive
//   stores/reportStore.ts   — useReportStore

export { useAuthStore, hashPassword } from './stores/authStore';
export { useWorkoutStore } from './stores/workoutStore';
export { useSocialStore } from './stores/socialStore';
export { useTrainerStore } from './stores/trainerStore';
export { useMedalStore, checkAllMedalsRetroactive } from './stores/medalStore';
export { useReportStore } from './stores/reportStore';
