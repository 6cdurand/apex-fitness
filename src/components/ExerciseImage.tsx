'use client';

import { useState, useEffect } from 'react';
import { generateExerciseImage } from '@/lib/exerciseImageGen';
import { exerciseLibraryMap } from '@/lib/exercises';
import { getExerciseAnimationUrl } from '@/lib/exerciseAnimations';
import { Loader2 } from 'lucide-react';

interface ExerciseImageProps {
  exerciseId: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showGenerateButton?: boolean;
}

const SIZE_MAP = {
  sm: 'w-10 h-10 rounded-lg',
  md: 'w-16 h-16 rounded-xl',
  lg: 'w-full aspect-square max-w-[280px] rounded-2xl',
};

export function ExerciseImage({ exerciseId, size = 'md', className = '', showGenerateButton = false }: ExerciseImageProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exercise = exerciseLibraryMap.get(exerciseId);
  const animationUrl = getExerciseAnimationUrl(exerciseId);

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

  // If no image available at all, render nothing (no emoji placeholder)
  if (!imageUrl && !animationUrl) {
    return null;
  }

  const src = imageUrl || animationUrl || '';

  return (
    <div className={`relative overflow-hidden bg-slate-900 flex-shrink-0 ${SIZE_MAP[size]} ${className}`}>
      <img
        src={src}
        alt={exercise?.name || exerciseId}
        className="w-full h-full object-cover"
        loading="lazy"
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
