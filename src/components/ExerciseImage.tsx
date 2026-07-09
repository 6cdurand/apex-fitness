'use client';

import { useState, useEffect } from 'react';
import { generateExerciseImage } from '@/lib/exerciseImageGen';
import { exerciseLibraryMap } from '@/lib/exercises';
import { getExerciseAnimationUrl } from '@/lib/exerciseAnimations';
import { Loader2, Dumbbell } from 'lucide-react';

interface ExerciseImageProps {
  exerciseId: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showGenerateButton?: boolean;
  /** v11-D3: callback fired when user taps "Suggest a video" on empty state */
  onSuggestVideo?: (exerciseId: string) => void;
}

const SIZE_MAP = {
  sm: 'w-10 h-10 rounded-lg',
  md: 'w-16 h-16 rounded-xl',
  lg: 'w-full aspect-square max-w-[280px] rounded-2xl',
};

export function ExerciseImage({ exerciseId, size = 'md', className = '', showGenerateButton = false, onSuggestVideo }: ExerciseImageProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // RC-5: remember the animation URL that failed to load (e.g. the
  // exercisedb.dev CDN going dark). A dead primary source must degrade to the
  // AI-image / empty state instead of a permanently-broken <img>. Keying on the
  // URL (not a boolean) means it auto-resets when the exercise changes — no
  // extra effect needed.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  const exercise = exerciseLibraryMap.get(exerciseId);
  const rawAnimationUrl = getExerciseAnimationUrl(exerciseId);
  const animationUrl = rawAnimationUrl && rawAnimationUrl !== failedUrl ? rawAnimationUrl : undefined;

  // Use animation GIF as primary source, then try cached AI image
  useEffect(() => {
    if (animationUrl) {
      setImageUrl(animationUrl);
      return;
    }
    let cancelled = false;
    fetch(`/api/exercise-image?exerciseId=${encodeURIComponent(exerciseId)}`)
      .then(res => {
        if (!res.ok) return null;
        return res.json();
      })
      .then(data => {
        if (!cancelled && data?.imageUrl) {
          setImageUrl(data.imageUrl);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [exerciseId, animationUrl]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const result = await generateExerciseImage(exerciseId);
      if (result.imageUrl) {
        setImageUrl(result.imageUrl);
      } else {
        setError(result.error || 'Failed');
      }
    } catch {
      setError('Generation failed');
    }
    setGenerating(false);
  };

  // If no image available at all, render elegant empty state (v11-D3)
  if (!imageUrl && !animationUrl) {
    const exerciseName = exercise?.name || exerciseId;
    const muscleGroups = exercise?.primaryMuscles?.slice(0, 2).join(' · ') || '';
    
    const handleSuggest = () => {
      onSuggestVideo?.(exerciseId);
    };

    return (
      <div className={`relative bg-gradient-to-br from-sky-50 to-blue-50 border border-sky-100 flex flex-col items-center justify-center text-center p-2 ${SIZE_MAP[size]} ${className}`}>
        <Dumbbell className="w-6 h-6 text-sky-300 mb-1" />
        {size === 'lg' && (
          <>
            <p className="text-xs font-medium text-gray-700 line-clamp-1 px-1">{exerciseName}</p>
            {muscleGroups && (
              <p className="text-[9px] text-gray-500 mt-0.5">{muscleGroups}</p>
            )}
            {showGenerateButton && onSuggestVideo && (
              <button
                onClick={handleSuggest}
                className="mt-2 text-[10px] text-sky-600 hover:text-sky-700 underline"
              >
                Suggest a video
              </button>
            )}
          </>
        )}
      </div>
    );
  }

  const src = imageUrl || animationUrl || '';

  return (
    <div className={`relative overflow-hidden bg-slate-900 flex-shrink-0 ${SIZE_MAP[size]} ${className}`}>
      <img
        src={src}
        alt={exercise?.name || exerciseId}
        className="w-full h-full object-cover"
        loading="lazy"
        onError={() => {
          // RC-5: the source (usually the animation CDN) is dead. Record it so
          // we fall through to the AI-image fetch / empty state, and clear the
          // broken image so we don't render a broken icon.
          if (src && src === rawAnimationUrl) setFailedUrl(rawAnimationUrl);
          if (imageUrl === src) setImageUrl(null);
        }}
      />

      {/* Loading state */}
      {generating && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60">
          <Loader2 className="w-6 h-6 text-sky-400 animate-spin mb-1" />
          <span className="text-xs text-sky-300">Generating…</span>
        </div>
      )}
    </div>
  );
}
