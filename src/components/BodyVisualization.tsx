'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { MuscleGroup } from '@/types';

interface BodyVisualizationProps {
  muscleData: Record<MuscleGroup, number>;
  maxValue?: number;
  view?: 'front' | 'back';
  size?: 'sm' | 'md' | 'lg';
}

const musclePositions: Record<MuscleGroup, { front?: { x: number; y: number }; back?: { x: number; y: number } }> = {
  chest: { front: { x: 50, y: 28 } },
  shoulders: { front: { x: 50, y: 20 }, back: { x: 50, y: 20 } },
  biceps: { front: { x: 25, y: 35 } },
  triceps: { back: { x: 25, y: 35 } },
  forearms: { front: { x: 20, y: 48 }, back: { x: 20, y: 48 } },
  abs: { front: { x: 50, y: 42 } },
  obliques: { front: { x: 38, y: 42 } },
  quads: { front: { x: 42, y: 65 } },
  hamstrings: { back: { x: 42, y: 60 } },
  glutes: { back: { x: 50, y: 50 } },
  calves: { front: { x: 42, y: 82 }, back: { x: 42, y: 82 } },
  back: { back: { x: 50, y: 32 } },
  lats: { back: { x: 38, y: 35 } },
  traps: { back: { x: 50, y: 18 } },
  lower_back: { back: { x: 50, y: 45 } },
};

function getIntensityColor(value: number, maxValue: number): string {
  const intensity = Math.min(value / maxValue, 1);
  if (intensity === 0) return 'fill-gray-700';
  if (intensity < 0.25) return 'fill-emerald-900';
  if (intensity < 0.5) return 'fill-emerald-700';
  if (intensity < 0.75) return 'fill-emerald-500';
  return 'fill-emerald-400';
}

export function BodyVisualization({ 
  muscleData, 
  maxValue = 10000, 
  view = 'front',
  size = 'md' 
}: BodyVisualizationProps) {
  const sizeClasses = {
    sm: 'w-32 h-48',
    md: 'w-48 h-72',
    lg: 'w-64 h-96',
  };

  return (
    <div className={cn("relative", sizeClasses[size])}>
      <svg viewBox="0 0 100 150" className="w-full h-full">
        {/* Body outline */}
        <ellipse cx="50" cy="12" rx="12" ry="12" className="fill-gray-800 stroke-gray-600" strokeWidth="0.5" />
        
        {/* Neck */}
        <rect x="45" y="22" width="10" height="6" className="fill-gray-800" />
        
        {/* Torso */}
        <path 
          d="M 30 28 Q 25 35 25 50 L 30 75 L 35 75 L 40 55 L 50 55 L 60 55 L 65 75 L 70 75 L 75 50 Q 75 35 70 28 Z" 
          className="fill-gray-800 stroke-gray-600" 
          strokeWidth="0.5" 
        />
        
        {/* Left Arm */}
        <path 
          d="M 30 28 Q 20 30 15 45 L 12 65 L 18 67 L 22 50 L 25 35" 
          className="fill-gray-800 stroke-gray-600" 
          strokeWidth="0.5" 
        />
        
        {/* Right Arm */}
        <path 
          d="M 70 28 Q 80 30 85 45 L 88 65 L 82 67 L 78 50 L 75 35" 
          className="fill-gray-800 stroke-gray-600" 
          strokeWidth="0.5" 
        />
        
        {/* Left Leg */}
        <path 
          d="M 35 75 L 32 110 L 30 140 L 40 140 L 42 110 L 45 75" 
          className="fill-gray-800 stroke-gray-600" 
          strokeWidth="0.5" 
        />
        
        {/* Right Leg */}
        <path 
          d="M 55 75 L 58 110 L 60 140 L 70 140 L 68 110 L 65 75" 
          className="fill-gray-800 stroke-gray-600" 
          strokeWidth="0.5" 
        />

        {/* Muscle highlights */}
        {Object.entries(muscleData).map(([muscle, value]) => {
          const position = musclePositions[muscle as MuscleGroup]?.[view];
          if (!position || value === 0) return null;
          
          const colorClass = getIntensityColor(value, maxValue);
          const radius = 6 + (value / maxValue) * 4;
          
          return (
            <g key={muscle}>
              <circle
                cx={position.x}
                cy={position.y}
                r={radius}
                className={cn(colorClass, "opacity-80")}
              />
              {/* Mirror for bilateral muscles */}
              {['biceps', 'triceps', 'forearms', 'quads', 'hamstrings', 'calves', 'lats', 'obliques'].includes(muscle) && (
                <circle
                  cx={100 - position.x}
                  cy={position.y}
                  r={radius}
                  className={cn(colorClass, "opacity-80")}
                />
              )}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-center gap-1">
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <div className="w-2 h-2 rounded-full bg-gray-700" />
          <span>Low</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>High</span>
        </div>
      </div>
    </div>
  );
}

export function MuscleHeatmap({ 
  muscleData, 
  maxValue = 10000 
}: { 
  muscleData: Record<MuscleGroup, number>; 
  maxValue?: number;
}) {
  const sortedMuscles = Object.entries(muscleData)
    .filter(([_, value]) => value > 0)
    .sort((a, b) => b[1] - a[1]);

  if (sortedMuscles.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No muscle data available</p>
      </div>
    );
  }

  const displayMax = sortedMuscles[0][1];

  const getMuscleDisplayName = (muscle: string): string => {
    const names: Record<string, string> = {
      chest: 'Chest',
      back: 'Back',
      shoulders: 'Shoulders',
      biceps: 'Biceps',
      triceps: 'Triceps',
      forearms: 'Forearms',
      abs: 'Abs',
      obliques: 'Obliques',
      quads: 'Quads',
      hamstrings: 'Hamstrings',
      glutes: 'Glutes',
      calves: 'Calves',
      traps: 'Traps',
      lats: 'Lats',
      lower_back: 'Lower Back',
    };
    return names[muscle] || muscle;
  };

  return (
    <div className="space-y-3">
      {sortedMuscles.map(([muscle, value]) => {
        const percentage = (value / displayMax) * 100;
        
        return (
          <div key={muscle} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-300">{getMuscleDisplayName(muscle)}</span>
              <span className="text-white font-medium">{Math.round(value).toLocaleString()} kg</span>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-500"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
