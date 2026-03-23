import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { WeeklyReport, MuscleGroup, Workout, WorkoutExercise, WorkoutSet, PersonalBest } from '@/types';
import { useAuthStore } from './authStore';
import { exerciseLibraryMap } from '../exercises';

// Lazy imports to avoid circular deps
let _workoutStore: any = null;
let _socialStore: any = null;
const getWorkoutStore = () => { if (!_workoutStore) _workoutStore = require('./workoutStore').useWorkoutStore; return _workoutStore; };
const getSocialStore = () => { if (!_socialStore) _socialStore = require('./socialStore').useSocialStore; return _socialStore; };

interface ReportState {
  weeklyReports: WeeklyReport[];
  
  generateWeeklyReport: () => WeeklyReport;
  getLatestReport: () => WeeklyReport | undefined;
  getReportForWeek: (startDate: string) => WeeklyReport | undefined;
}

export const useReportStore = create<ReportState>()(
  persist(
    (set, get) => ({
      weeklyReports: [],

      generateWeeklyReport: () => {
        const { workoutHistory, personalBests } = getWorkoutStore().getState() as { workoutHistory: Workout[]; personalBests: PersonalBest[] };
        const userId = useAuthStore.getState().user?.id || '';
        
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);
        
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);

        // Filter workouts from this week
        const thisWeekWorkouts = workoutHistory.filter((w: Workout) => {
          const workoutDate = new Date(w.startTime);
          return workoutDate >= weekStart && workoutDate <= weekEnd;
        });

        // Calculate volume by muscle group
        const volumeByMuscle: Record<MuscleGroup, number> = {
          chest: 0, back: 0, shoulders: 0, biceps: 0, triceps: 0,
          forearms: 0, abs: 0, obliques: 0, quads: 0, hamstrings: 0,
          glutes: 0, calves: 0, traps: 0, lats: 0, lower_back: 0,
        };

        thisWeekWorkouts.forEach((workout: Workout) => {
          workout.exercises.forEach((ex: WorkoutExercise) => {
            const exercise = exerciseLibraryMap.get(ex.exerciseId);
            if (exercise) {
              let exerciseVolume = 0;
              ex.sets.forEach((s: WorkoutSet) => {
                if (s.completed && s.weight && s.reps) {
                  exerciseVolume += s.weight * s.reps;
                }
              });

              exercise.primaryMuscles.forEach(muscle => {
                volumeByMuscle[muscle] += exerciseVolume;
              });
              exercise.secondaryMuscles.forEach(muscle => {
                volumeByMuscle[muscle] += exerciseVolume * 0.3;
              });
            }
          });
        });

        // Calculate total stats
        const totalVolume = Object.values(volumeByMuscle).reduce((a, b) => a + b, 0);
        const totalDuration = thisWeekWorkouts.reduce((sum: number, w: Workout) => sum + (w.duration || 0), 0) / 60;

        // Get new PBs from this week
        const newPBs = personalBests.filter((pb: PersonalBest) => {
          const pbDate = new Date(pb.achievedAt);
          return pbDate >= weekStart && pbDate <= weekEnd;
        });

        const report: WeeklyReport = {
          id: uuidv4(),
          userId,
          weekStartDate: weekStart.toISOString(),
          weekEndDate: weekEnd.toISOString(),
          totalWorkouts: thisWeekWorkouts.length,
          totalVolume: Math.round(totalVolume),
          totalDuration: Math.round(totalDuration),
          volumeByMuscleGroup: volumeByMuscle,
          volumeChangeFromLastWeek: volumeByMuscle, // Placeholder - would compare with last week
          newPBs,
          consistencyScore: Math.min(100, thisWeekWorkouts.length * 15),
          generatedAt: new Date().toISOString(),
        };

        set(state => ({
          weeklyReports: [report, ...state.weeklyReports],
        }));

        // Add notification
        getSocialStore().getState().addNotification({
          userId,
          type: 'weekly_report',
          title: 'Weekly Report Ready!',
          message: `Your weekly report is ready. You completed ${report.totalWorkouts} workouts!`,
        });

        return report;
      },

      getLatestReport: () => {
        return get().weeklyReports[0];
      },

      getReportForWeek: (startDate) => {
        return get().weeklyReports.find(r => r.weekStartDate.startsWith(startDate.substring(0, 10)));
      },
    }),
    {
      name: 'apex-reports',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
