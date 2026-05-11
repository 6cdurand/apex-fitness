'use client';

import { Badge } from '@/components/ui/badge';
import { TrendingUp, Zap, Flame, Heart, Trophy, Clock } from 'lucide-react';

/**
 * Creative per-block "memory" card used in:
 *   - Post-workout Workout Complete summary
 *   - Workout history detail modal
 *
 * Renders a visualization tailored to the block type:
 *   - Cardio with distance: hero distance + pace (min/km, popular running
 *     stat) + speed + splits bar chart (Strava-style relative durations)
 *   - Cardio time-only / steady: hero duration + activity type + intervals
 *   - Circuit: round-progress dots + per-round bar chart with avg line
 *   - Warm-up / cool-down: completion status + duration
 *
 * 2026-05-11 user-feedback: previous version was a plain key-value list.
 * Users specifically asked for "popular running stats like pace" and a
 * "creative" circuit display.
 */

export type BlockMemorySnapshot = {
  id?: string;
  type?: string;
  name?: string;
  timerSeconds?: number;
  completed?: boolean;
  rounds?: number;
  roundsCompleted?: number | unknown[];
  roundTimes?: number[];
  circuitStyle?: string;
  circuitDuration?: number;
  cardioMode?: string;
  cardioActivity?: string;
  distanceCompleted?: number;
  targetDistance?: number;
  targetSeconds?: number;
  splits?: { distance: number; time: number }[] | unknown[];
  intervals?: { intensity: 'work' | 'rest' }[] | unknown[];
  intervalRounds?: number;
};

const formatDurationLong = (seconds: number): string => {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

const formatPace = (secondsPerKm: number): string => {
  if (!Number.isFinite(secondsPerKm) || secondsPerKm <= 0) return '—';
  const m = Math.floor(secondsPerKm / 60);
  const s = Math.round(secondsPerKm % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

interface BlockMemoryCardProps {
  block: BlockMemorySnapshot;
}

export default function BlockMemoryCard({ block }: BlockMemoryCardProps) {
  const isCardio = block.type === 'cardio';
  const isCircuit = block.type === 'circuit';
  const isWarmupish = block.type === 'warmup' || block.type === 'cooldown';

  if (isCardio) return <CardioMemoryCard block={block} />;
  if (isCircuit) return <CircuitMemoryCard block={block} />;
  if (isWarmupish) return <WarmupMemoryCard block={block} />;
  return null;
}

// ---------- CARDIO ----------

function CardioMemoryCard({ block }: BlockMemoryCardProps) {
  const distanceMeters = typeof block.distanceCompleted === 'number' ? block.distanceCompleted : 0;
  const distanceKm = distanceMeters / 1000;
  const totalSeconds = typeof block.timerSeconds === 'number' ? block.timerSeconds : 0;
  const targetMeters = typeof block.targetDistance === 'number' ? block.targetDistance : 0;
  const targetSeconds = typeof block.targetSeconds === 'number' ? block.targetSeconds : 0;
  const splits = Array.isArray(block.splits) ? (block.splits as { distance: number; time: number }[]) : [];

  const hasDistance = distanceMeters > 0;
  const hasDuration = totalSeconds > 0;

  // Popular running stats — only meaningful if BOTH distance and time exist.
  // Pace = min:sec per km. Speed = km/h. Avg split = time / split count.
  const pacePerKm = hasDistance && hasDuration ? totalSeconds / distanceKm : 0;
  const speedKmH = hasDistance && hasDuration ? distanceKm / (totalSeconds / 3600) : 0;

  // Splits bar widths normalized against the slowest split so a slower split
  // = wider bar, faster = shorter (Strava-style). Empty array → no bars.
  const slowestSplit = splits.length > 0
    ? splits.reduce((max, s) => Math.max(max, s.time || 0), 0)
    : 0;

  // Intervals counter (work vs rest) for HIIT-style cardio.
  const intervals = Array.isArray(block.intervals) ? (block.intervals as { intensity: 'work' | 'rest' }[]) : [];
  const workCount = intervals.filter(i => i?.intensity === 'work').length;
  const restCount = intervals.filter(i => i?.intensity === 'rest').length;

  return (
    <div className="overflow-hidden rounded-xl border border-green-500/30 bg-gradient-to-br from-green-500/5 to-emerald-500/5">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-green-500/20">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-green-500 inline-flex items-center justify-center">
            <Heart className="w-4 h-4 text-white" />
          </span>
          <div>
            <p className="font-semibold text-green-700 leading-tight">{block.cardioActivity || block.name || 'Cardio'}</p>
            {block.cardioMode && (
              <p className="text-[10px] text-green-600/70 capitalize">{block.cardioMode} mode</p>
            )}
          </div>
        </div>
        {block.completed && (
          <Badge className="bg-green-500/20 text-green-700 border-green-500/30 text-[10px]">
            <Trophy className="w-3 h-3 mr-1" />
            Complete
          </Badge>
        )}
      </div>

      {/* Hero metrics row — distance OR duration leads */}
      <div className="px-4 py-4">
        {hasDistance ? (
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-3xl font-bold text-green-700 tabular-nums">{distanceKm.toFixed(2)}</span>
            <span className="text-sm text-green-600/80">km</span>
            {hasDuration && (
              <>
                <span className="text-gray-400 mx-1">·</span>
                <span className="text-sm font-medium text-gray-700 tabular-nums">{formatDurationLong(totalSeconds)}</span>
              </>
            )}
            {targetMeters > 0 && (
              <span className="text-xs text-gray-500 ml-auto">
                of {(targetMeters / 1000).toFixed(1)} km target
              </span>
            )}
          </div>
        ) : hasDuration ? (
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-3xl font-bold text-green-700 tabular-nums">{formatDurationLong(totalSeconds)}</span>
            {targetSeconds > 0 && (
              <span className="text-xs text-gray-500 ml-auto">
                of {formatDurationLong(targetSeconds)} target
              </span>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500 mb-3">Activity logged</p>
        )}

        {/* Stats grid — pace + speed for distance cardio */}
        {hasDistance && hasDuration && (
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="bg-white/70 border border-green-500/20 rounded-lg p-2 text-center">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Pace</p>
              <p className="text-sm font-bold text-green-700 tabular-nums">{formatPace(pacePerKm)}</p>
              <p className="text-[9px] text-gray-400">/km</p>
            </div>
            <div className="bg-white/70 border border-green-500/20 rounded-lg p-2 text-center">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Speed</p>
              <p className="text-sm font-bold text-green-700 tabular-nums">{speedKmH.toFixed(1)}</p>
              <p className="text-[9px] text-gray-400">km/h</p>
            </div>
            <div className="bg-white/70 border border-green-500/20 rounded-lg p-2 text-center">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Time</p>
              <p className="text-sm font-bold text-green-700 tabular-nums">{formatDurationLong(totalSeconds)}</p>
              <p className="text-[9px] text-gray-400">total</p>
            </div>
          </div>
        )}

        {/* Splits bar chart — Strava-style. Each row = one split, bar
            width proportional to time (slower = wider). */}
        {splits.length > 0 && slowestSplit > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Splits</p>
              <p className="text-[10px] text-gray-400">{splits.length} segment{splits.length > 1 ? 's' : ''}</p>
            </div>
            <div className="space-y-1">
              {splits.map((split, idx) => {
                const widthPct = slowestSplit > 0 ? (split.time / slowestSplit) * 100 : 0;
                const splitKm = split.distance / 1000;
                const splitPace = splitKm > 0 ? split.time / splitKm : 0;
                const isFastest = split.time === splits.reduce((min, s) => Math.min(min, s.time), Infinity);
                return (
                  <div key={idx} className="flex items-center gap-2 text-xs">
                    <span className="text-[10px] text-gray-500 w-10 tabular-nums">
                      {splitKm < 1 ? `${(splitKm * 1000).toFixed(0)}m` : `${splitKm.toFixed(1)}k`}
                    </span>
                    <div className="flex-1 h-5 bg-gray-100 rounded-sm overflow-hidden relative">
                      <div
                        className={`h-full rounded-sm transition-all ${
                          isFastest ? 'bg-emerald-500' : 'bg-green-400'
                        }`}
                        style={{ width: `${Math.max(8, widthPct)}%` }}
                      />
                      <span className="absolute inset-0 flex items-center px-2 text-[10px] font-mono text-white mix-blend-difference">
                        {formatDurationLong(split.time)}
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-500 w-12 text-right tabular-nums">
                      {splitPace > 0 ? `${formatPace(splitPace)}/km` : ''}
                    </span>
                    {isFastest && (
                      <span title="Fastest split">
                        <TrendingUp className="w-3 h-3 text-emerald-500" />
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Intervals breakdown — only when interval data exists */}
        {intervals.length > 0 && (
          <div className="mt-3 flex items-center gap-3 text-xs text-gray-700">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <span className="font-semibold">{workCount}</span> work
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-gray-300" />
              <span className="font-semibold">{restCount}</span> rest
            </span>
            {block.intervalRounds && (
              <span className="text-gray-500">· {block.intervalRounds} rounds programmed</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- CIRCUIT ----------

function CircuitMemoryCard({ block }: BlockMemoryCardProps) {
  const rc = block.roundsCompleted;
  const roundsCompleted = typeof rc === 'number'
    ? rc
    : Array.isArray(rc) ? rc.length : 0;
  const roundsTarget = typeof block.rounds === 'number' ? block.rounds : roundsCompleted;
  const roundTimes = Array.isArray(block.roundTimes) ? block.roundTimes : [];
  const totalSeconds = typeof block.timerSeconds === 'number' ? block.timerSeconds : 0;
  const totalRoundTime = roundTimes.reduce((sum, t) => sum + t, 0);
  const avgRoundTime = roundTimes.length > 0 ? totalRoundTime / roundTimes.length : 0;
  const fastestRound = roundTimes.length > 0 ? Math.min(...roundTimes) : 0;
  const slowestRoundTime = roundTimes.length > 0 ? Math.max(...roundTimes) : 1;

  return (
    <div className="overflow-hidden rounded-xl border border-orange-500/30 bg-gradient-to-br from-orange-500/5 to-amber-500/5">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-orange-500/20">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-orange-500 inline-flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </span>
          <div>
            <p className="font-semibold text-orange-700 leading-tight">{block.name || 'Circuit'}</p>
            {block.circuitStyle && (
              <p className="text-[10px] text-orange-600/70 uppercase tracking-wider">{block.circuitStyle}</p>
            )}
          </div>
        </div>
        {block.completed && (
          <Badge className="bg-orange-500/20 text-orange-700 border-orange-500/30 text-[10px]">
            <Trophy className="w-3 h-3 mr-1" />
            Complete
          </Badge>
        )}
      </div>

      {/* Round progress dots + hero stat */}
      <div className="px-4 py-4">
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-3xl font-bold text-orange-700 tabular-nums">{roundsCompleted}</span>
          <span className="text-sm text-orange-600/80">/ {roundsTarget} rounds</span>
          {totalSeconds > 0 && (
            <>
              <span className="text-gray-400 mx-1">·</span>
              <span className="text-sm font-medium text-gray-700 tabular-nums">{formatDurationLong(totalSeconds)}</span>
            </>
          )}
        </div>

        {/* Round dots — visual at-a-glance progress */}
        {roundsTarget > 0 && roundsTarget <= 20 && (
          <div className="flex items-center gap-1 mb-3">
            {Array.from({ length: roundsTarget }, (_, i) => (
              <span
                key={i}
                className={`w-2.5 h-2.5 rounded-full ${
                  i < roundsCompleted
                    ? 'bg-orange-500'
                    : 'bg-orange-200'
                }`}
                aria-label={`Round ${i + 1}${i < roundsCompleted ? ' (done)' : ' (pending)'}`}
              />
            ))}
            {roundsCompleted >= roundsTarget && (
              <Trophy className="w-4 h-4 text-amber-500 ml-1" />
            )}
          </div>
        )}

        {/* Round times bar chart — heights vary by duration (taller = slower) */}
        {roundTimes.length > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Per-round time</p>
              {avgRoundTime > 0 && (
                <p className="text-[10px] text-gray-500">
                  avg <span className="font-mono text-orange-700">{formatDurationLong(avgRoundTime)}</span>
                </p>
              )}
            </div>
            {/* Bars + axis labels */}
            <div className="flex items-end gap-1 h-16 mb-1">
              {roundTimes.map((t, idx) => {
                const heightPct = slowestRoundTime > 0 ? (t / slowestRoundTime) * 100 : 0;
                const isFastest = t === fastestRound && roundTimes.length > 1;
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center min-w-[18px]">
                    <div className="flex-1 w-full flex items-end">
                      <div
                        className={`w-full rounded-t transition-all ${
                          isFastest ? 'bg-emerald-500' : 'bg-orange-400'
                        }`}
                        style={{ height: `${Math.max(10, heightPct)}%` }}
                        title={`Round ${idx + 1}: ${formatDurationLong(t)}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Round labels */}
            <div className="flex items-start gap-1">
              {roundTimes.map((t, idx) => (
                <div key={idx} className="flex-1 text-center min-w-[18px]">
                  <p className="text-[8px] text-gray-400 uppercase">R{idx + 1}</p>
                  <p className="text-[9px] font-mono text-gray-700">{formatDurationLong(t)}</p>
                </div>
              ))}
            </div>
            {fastestRound > 0 && roundTimes.length > 1 && (
              <p className="text-[10px] text-emerald-600 mt-2 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                Fastest round: <span className="font-mono font-semibold">{formatDurationLong(fastestRound)}</span>
              </p>
            )}
          </div>
        )}

        {block.circuitStyle && roundTimes.length === 0 && totalSeconds > 0 && (
          <p className="text-xs text-gray-600 mt-2 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Total time: <span className="font-mono font-semibold">{formatDurationLong(totalSeconds)}</span>
          </p>
        )}
      </div>
    </div>
  );
}

// ---------- WARMUP / COOLDOWN ----------

function WarmupMemoryCard({ block }: BlockMemoryCardProps) {
  const isCooldown = block.type === 'cooldown';
  const totalSeconds = typeof block.timerSeconds === 'number' ? block.timerSeconds : 0;

  return (
    <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 px-4 py-3 flex items-center gap-3">
      <span className="w-7 h-7 rounded-full bg-yellow-500 inline-flex items-center justify-center flex-shrink-0">
        <Flame className="w-4 h-4 text-white" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-yellow-700 leading-tight">{block.name || (isCooldown ? 'Cool-down' : 'Warm-up')}</p>
        <p className="text-[11px] text-yellow-600/70">
          {block.completed ? 'Completed' : 'Logged'}
          {totalSeconds > 0 && ` · ${formatDurationLong(totalSeconds)}`}
        </p>
      </div>
      {block.completed && (
        <Badge className="bg-yellow-500/20 text-yellow-700 border-yellow-500/30 text-[10px]">
          ✓
        </Badge>
      )}
    </div>
  );
}
