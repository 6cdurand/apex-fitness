// Exercise technique video/GIF URL mapping
// URLs temporarily cleared — MuscleWiki CDN paths are not publicly accessible
// and cause black screen / broken image issues. Add verified working URLs here
// when a reliable source is found (e.g. self-hosted or Lottie animations).

// Placeholder map — add verified URLs here in the future
const VIDEO_MAP: Record<string, string> = {};

/**
 * Get a technique video/GIF URL for an exercise.
 * Returns null if no video is mapped for this exercise.
 */
export function getExerciseVideoUrl(exerciseId: string): string | null {
  return VIDEO_MAP[exerciseId] || null;
}
