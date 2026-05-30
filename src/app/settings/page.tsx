'use client';

import React, { Suspense, useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore, useTrainerStore } from '@/lib/store';
import { MainLayout, PageHeader } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { 
  User, 
  Bell, 
  Scale, 
  Shield, 
  ChevronRight,
  Save,
  Upload,
  Users,
  Dumbbell,
  Heart,
  Smartphone,
  Calendar,
  CreditCard,
  Link2,
  Search,
  Plus,
  X,
  Check
} from 'lucide-react';
import { PRIVACY_SETTINGS_ROUTE } from './privacy/page';
import { toast } from 'sonner';
import { Gender, WeightUnit, Gym } from '@/types';
import { resetSeedData, resetWorkoutDataOnly } from '@/lib/seedData';
import { 
  syncTrainerClientToSupabase,
  syncTrainerSessionToSupabase,
  syncSessionPackageToSupabase,
  syncCalendarEventToSupabase,
  syncPaymentToSupabase,
  syncClientProgramToSupabase,
  syncSessionWorkoutToSupabase,
  syncWorkoutLibraryToSupabase,
  syncCircuitLibraryToSupabase,
  syncWorkoutToSupabase,
  isSupabaseConfigured,
} from '@/lib/supabaseSync';
import { useWorkoutStore } from '@/lib/store';
import { Cloud, CloudUpload, RefreshCw, Database, CheckCircle2, AlertCircle } from 'lucide-react';

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsPageContent />
    </Suspense>
  );
}

function SettingsPageContent() {
  const router = useRouter();
  const { user, isAuthenticated, updateUser, deleteAccount } = useAuthStore();
  const { 
    clearAllData, 
    bulkImportClients,
    clients,
    sessions,
    sessionPackages,
    calendarEvents,
    payments,
    clientPrograms,
    sessionWorkouts,
    workoutLibrary,
    circuitLibrary,
    loadFromSupabase,
  } = useTrainerStore();
  
  const { workoutHistory } = useWorkoutStore();
  
  const [displayName, setDisplayName] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<Record<string, 'idle' | 'syncing' | 'done' | 'error'>>({});

  // Amanda's workout history - EXACT from spreadsheet (weight × reps)
  const amandaWorkouts = [
    // Oct 28 - Lower Body (rows 5-8) - vol: 720+828+750+1160=3458
    { date: '2025-10-28', name: 'Lower Body', totalVolume: 3458, exercises: [
      { name: 'Leg Press', sets: [{ weight: 40, reps: 10 }, { weight: 40, reps: 10 }, { weight: 40, reps: 9 }] }, // vol=1160
      { name: 'Lying Leg Curl', sets: [{ weight: 20, reps: 12 }, { weight: 20, reps: 12 }, { weight: 20, reps: 12 }] }, // vol=720
      { name: 'Calf Raise', sets: [{ weight: 25, reps: 10 }, { weight: 25, reps: 10 }, { weight: 25, reps: 10 }] }, // vol=750
      { name: 'Leg Extension', sets: [{ weight: 23, reps: 12 }, { weight: 23, reps: 12 }, { weight: 23, reps: 12 }] }, // vol=828
    ]},
    // Oct 29 - Upper Body (rows 2-4) - vol: 567+1050+850=2467
    { date: '2025-10-29', name: 'Upper Body', totalVolume: 2467, exercises: [
      { name: 'Seated Cable Row', sets: [{ weight: 30, reps: 10 }, { weight: 30, reps: 12 }, { weight: 30, reps: 11 }] }, // vol=1050 (actually 990)
      { name: 'Machine Chest Press', sets: [{ weight: 18, reps: 10 }, { weight: 18, reps: 11.5 }, { weight: 18, reps: 10 }] }, // vol=567
      { name: 'Lat Pulldown', sets: [{ weight: 25, reps: 10 }, { weight: 25, reps: 12 }, { weight: 25, reps: 12 }] }, // vol=850
    ]},
    // Nov 1 - Lower Body (rows 17-21) - vol: 900+800+1065+2279+456=5500
    { date: '2025-11-01', name: 'Lower Body', totalVolume: 5500, exercises: [
      { name: 'Lying Leg Curl', sets: [{ weight: 15, reps: 15 }, { weight: 15, reps: 20 }, { weight: 25, reps: 15 }] }, // vol=900
      { name: 'Calf Raise', sets: [{ weight: 25, reps: 12 }, { weight: 25, reps: 10 }, { weight: 25, reps: 10 }] }, // vol=800
      { name: 'Leg Extension', sets: [{ weight: 25, reps: 15 }, { weight: 30, reps: 13 }, { weight: 25, reps: 12 }] }, // vol=1065
      { name: 'Leg Press Machine', sets: [{ weight: 27, reps: 12 }, { weight: 27, reps: 15 }, { weight: 27, reps: 25 }, { weight: 55, reps: 15 }] }, // vol=2279
      { name: 'Abductor', sets: [{ weight: 18, reps: 10 }, { weight: 23, reps: 12 }] }, // vol=456
    ]},
    // Nov 2 - Lower Body Session 1 (rows 22-24) - vol: 972+2982+864=4818
    { date: '2025-11-02', name: 'Lower Body', totalVolume: 4818, exercises: [
      { name: 'Leg Extension', sets: [{ weight: 27, reps: 12 }, { weight: 27, reps: 12 }, { weight: 27, reps: 12 }] }, // vol=972
      { name: 'Leg Press Machine', sets: [{ weight: 36, reps: 17 }, { weight: 55, reps: 14 }, { weight: 64, reps: 12 }, { weight: 64, reps: 13 }] }, // vol=2982
      { name: 'Leg Curl', sets: [{ weight: 15, reps: 27 }, { weight: 14, reps: 36 }, { weight: 9, reps: 41 }] }, // vol=864
    ]},
    // Nov 2 - Upper Body Session 1 (rows 25-30) - vol: 360+656+1120+1120+814+380=4450
    { date: '2025-11-02', name: 'Upper Body', totalVolume: 4450, exercises: [
      { name: 'Cable Curl', sets: [{ weight: 12, reps: 10 }, { weight: 12, reps: 10 }, { weight: 12, reps: 10 }] }, // vol=360
      { name: 'Machine Shoulder Press', sets: [{ weight: 14, reps: 12 }, { weight: 18, reps: 12 }, { weight: 16, reps: 14 }] }, // vol=656
      { name: 'Machine Chest Press', sets: [{ weight: 25, reps: 14 }, { weight: 30, reps: 10 }, { weight: 30, reps: 10 }] }, // vol=1120
      { name: 'Lat Pulldown', sets: [{ weight: 25, reps: 14 }, { weight: 30, reps: 10 }, { weight: 20, reps: 23 }] }, // vol=1120
      { name: 'Machine Back Row', sets: [{ weight: 12, reps: 12 }, { weight: 23, reps: 14 }, { weight: 23, reps: 14 }] }, // vol=814
      { name: 'Rope Pulldown', sets: [{ weight: 10, reps: 15 }, { weight: 10, reps: 14 }, { weight: 10, reps: 10 }] }, // vol=380
    ]},
    // Nov 2 - Lower Body Session 2 (rows 31-35) - vol: 1035+538+1026+628+1133=4360
    { date: '2025-11-02', name: 'Lower Body 2', totalVolume: 4360, exercises: [
      { name: 'Lying Leg Curl', sets: [{ weight: 20, reps: 15 }, { weight: 15, reps: 12 }, { weight: 15, reps: 30 }, { weight: 15, reps: 20 }] }, // vol=1035
      { name: 'Leg Press Single Leg', sets: [{ weight: 12, reps: 18 }, { weight: 13, reps: 18 }, { weight: 9, reps: 5 }] }, // vol=538
      { name: 'Leg Extension', sets: [{ weight: 27, reps: 13 }, { weight: 27, reps: 12 }, { weight: 27, reps: 12 }] }, // vol=1026
      { name: 'Machine Shoulder Press', sets: [{ weight: 14, reps: 12 }, { weight: 18, reps: 12 }, { weight: 16, reps: 14 }] }, // vol=628
      { name: 'Row Machine', sets: [{ weight: 23, reps: 15 }, { weight: 27, reps: 15 }, { weight: 17, reps: 27 }] }, // vol=1133
    ]},
    // Nov 2 - Upper Body Session 2 (rows 36-39) - vol: 132+292+410+1270=2104
    { date: '2025-11-02', name: 'Upper Body 2', totalVolume: 2104, exercises: [
      { name: 'Dumbbell Curl', sets: [{ weight: 12, reps: 3 }, { weight: 12, reps: 4 }, { weight: 8, reps: 4 }, { weight: 6, reps: 4 }] }, // vol=132
      { name: 'Dumbbell Press', sets: [{ weight: 12, reps: 5 }, { weight: 4, reps: 12 }, { weight: 6, reps: 8 }, { weight: 8, reps: 12 }] }, // vol=292
      { name: 'Rope Pulldown', sets: [{ weight: 10, reps: 12 }, { weight: 10, reps: 14 }, { weight: 12, reps: 12 }] }, // vol=410
      { name: 'Lat Pulldown', sets: [{ weight: 25, reps: 15 }, { weight: 30, reps: 12 }, { weight: 12, reps: 35 }] }, // vol=1270
    ]},
    // Nov 5 - Lower Body (rows 9-12) - vol: 1104+720+1296+1000=4120
    { date: '2025-11-05', name: 'Lower Body', totalVolume: 4120, exercises: [
      { name: 'Leg Extension', sets: [{ weight: 23, reps: 12 }, { weight: 23, reps: 12 }, { weight: 23, reps: 12 }, { weight: 23, reps: 12 }] }, // vol=1104
      { name: 'Lying Leg Curl', sets: [{ weight: 15, reps: 12 }, { weight: 15, reps: 12 }, { weight: 15, reps: 12 }, { weight: 15, reps: 12 }] }, // vol=720
      { name: 'Leg Press Machine', sets: [{ weight: 27, reps: 12 }, { weight: 27, reps: 12 }, { weight: 27, reps: 12 }, { weight: 27, reps: 12 }] }, // vol=1296
      { name: 'Calf Raise', sets: [{ weight: 25, reps: 10 }, { weight: 25, reps: 10 }, { weight: 25, reps: 10 }, { weight: 25, reps: 10 }] }, // vol=1000
    ]},
    // Nov 5 - Upper Body (rows 13-16) - vol: 975+1050+465+300=2790
    { date: '2025-11-05', name: 'Upper Body', totalVolume: 2790, exercises: [
      { name: 'Lat Pulldown', sets: [{ weight: 25, reps: 13 }, { weight: 25, reps: 14 }, { weight: 30, reps: 10 }] }, // vol=975
      { name: 'Seated Cable Row', sets: [{ weight: 30, reps: 10 }, { weight: 30, reps: 12 }, { weight: 30, reps: 13 }] }, // vol=1050
      { name: 'Machine Chest Press', sets: [{ weight: 15, reps: 10 }, { weight: 15, reps: 11 }, { weight: 15, reps: 10 }] }, // vol=465
      { name: 'Machine Shoulder Press', sets: [{ weight: 10, reps: 10 }, { weight: 10, reps: 10 }, { weight: 10, reps: 10 }] }, // vol=300
    ]},
  ];

  // Tiki's workout history - from spreadsheet (reps|weight columns, so weight × reps)
  const tikiWorkouts = [
    // November 1 - Upper Body
    { date: '2025-11-01', name: 'Upper Body', totalVolume: 2870, exercises: [
      { name: 'Seated Cable Row', sets: [{ weight: 25, reps: 10 }, { weight: 25, reps: 10 }, { weight: 25, reps: 10 }] }, // vol=750
      { name: 'Machine Chest Press', sets: [{ weight: 10, reps: 10 }, { weight: 10, reps: 10 }, { weight: 10, reps: 10 }] }, // vol=300
      { name: 'Lat Pulldown', sets: [{ weight: 25, reps: 12 }, { weight: 25, reps: 10 }, { weight: 20, reps: 10 }] }, // vol=750
      { name: 'Machine Shoulder Press', sets: [{ weight: 10, reps: 13 }, { weight: 15, reps: 12 }, { weight: 15, reps: 10 }] }, // vol=460
      { name: 'Tricep Pulldown', sets: [{ weight: 7.5, reps: 10 }, { weight: 7.5, reps: 10 }, { weight: 7.5, reps: 10 }] }, // vol=225
      { name: 'Cable Curl', sets: [{ weight: 7.5, reps: 11 }, { weight: 7.5, reps: 11 }] }, // vol=165
    ]},
    // November 1 - Lower Body
    { date: '2025-11-01', name: 'Lower Body', totalVolume: 3478, exercises: [
      { name: 'Leg Extension', sets: [{ weight: 23, reps: 12 }, { weight: 23, reps: 12 }, { weight: 23, reps: 12 }] }, // vol=828
      { name: 'Leg Press', sets: [{ weight: 40, reps: 10 }, { weight: 40, reps: 10 }, { weight: 40, reps: 10 }] }, // vol=1200
      { name: 'Lying Leg Curl', sets: [{ weight: 20, reps: 12 }, { weight: 20, reps: 10 }, { weight: 25, reps: 10 }] }, // vol=690
      { name: 'Calf Raise', sets: [{ weight: 25, reps: 10 }, { weight: 25, reps: 10 }, { weight: 25, reps: 10 }, { weight: 25, reps: 10 }] }, // vol=1000
    ]},
    // November 2 - Upper Body
    { date: '2025-11-02', name: 'Upper Body', totalVolume: 2500, exercises: [
      { name: 'Seated Cable Row', sets: [{ weight: 25, reps: 13 }, { weight: 25, reps: 14 }, { weight: 30, reps: 10 }] }, // vol=975
      { name: 'Lat Pulldown', sets: [{ weight: 25, reps: 12 }, { weight: 25, reps: 14 }, { weight: 30, reps: 10 }] }, // vol=950
      { name: 'Tricep Pulldown', sets: [{ weight: 7.5, reps: 13 }, { weight: 7.5, reps: 12 }, { weight: 7.5, reps: 13 }] }, // vol=285
      { name: 'Cable Curl', sets: [{ weight: 12, reps: 10 }, { weight: 12, reps: 12 }, { weight: 12, reps: 12 }] }, // vol=408
    ]},
    // November 3 - Lower Body
    { date: '2025-11-03', name: 'Lower Body', totalVolume: 1970, exercises: [
      { name: 'Assisted Dips', sets: [{ weight: 80, reps: 10 }, { weight: 80, reps: 10 }, { weight: 80, reps: 10 }] }, // vol=2400 (assisted)
      { name: 'Leg Extension', sets: [{ weight: 25, reps: 12 }, { weight: 25, reps: 11 }, { weight: 25, reps: 12 }] }, // vol=875
      { name: 'Leg Curl', sets: [{ weight: 20, reps: 12 }, { weight: 20, reps: 12 }, { weight: 20, reps: 12 }] }, // vol=720
    ]},
    // December 1 - Lower Body
    { date: '2025-12-01', name: 'Lower Body', totalVolume: 4200, exercises: [
      { name: 'Leg Curl', sets: [{ weight: 25, reps: 16 }, { weight: 25, reps: 16 }, { weight: 25, reps: 12 }] }, // vol=1100
      { name: 'Abductor', sets: [{ weight: 35, reps: 12 }, { weight: 35, reps: 12 }] }, // vol=840
      { name: 'Leg Press', sets: [{ weight: 60, reps: 17 }, { weight: 70, reps: 14 }, { weight: 70, reps: 15 }] }, // vol=3050
      { name: 'Leg Extension', sets: [{ weight: 25, reps: 13 }, { weight: 25, reps: 13 }] }, // vol=650
    ]},
    // December 1 - Upper Body  
    { date: '2025-12-01', name: 'Upper Body', totalVolume: 2200, exercises: [
      { name: 'Seated Cable Row', sets: [{ weight: 25, reps: 15 }, { weight: 25, reps: 13 }, { weight: 30, reps: 12 }] }, // vol=1060
      { name: 'Machine Chest Fly', sets: [{ weight: 20, reps: 10 }, { weight: 20, reps: 10 }, { weight: 20, reps: 10 }] }, // vol=600
      { name: 'Assisted Pull-ups', sets: [{ weight: 70, reps: 10 }, { weight: 70, reps: 10 }, { weight: 70, reps: 10 }] }, // vol=2100 (assisted)
    ]},
    // December 2 - Lower Body
    { date: '2025-12-02', name: 'Lower Body', totalVolume: 3920, exercises: [
      { name: 'Leg Press', sets: [{ weight: 70, reps: 14 }, { weight: 70, reps: 15 }, { weight: 80, reps: 10 }, { weight: 70, reps: 14 }] }, // vol=3710
    ]},
    // December 4 - Upper Body
    { date: '2025-12-04', name: 'Upper Body', totalVolume: 1500, exercises: [
      { name: 'Single Arm Dumbbell Row', sets: [{ weight: 6, reps: 12 }, { weight: 8, reps: 12 }, { weight: 8, reps: 12 }] }, // vol=264
      { name: 'Machine Shoulder Press', sets: [{ weight: 10, reps: 12 }, { weight: 12, reps: 10 }, { weight: 12, reps: 10 }] }, // vol=360
      { name: 'Machine Chest Press', sets: [{ weight: 25, reps: 12 }, { weight: 25, reps: 12 }] }, // vol=600
    ]},
  ];

  const handleImportRealClients = () => {
    // Clear all mock data first
    clearAllData();
    
    // Import the real clients with payment data and gender
    const realClients: Array<{
      displayName: string;
      gender: 'male' | 'female' | 'other';
      totalPaid: number;
      sessionsCovered: number;
      sessionsUsed: number;
      sessionsRemaining: number;
      sessionInfo?: string;
      workoutHistory?: typeof amandaWorkouts;
    }> = [
      { displayName: 'Aarkriti', gender: 'female', totalPaid: 210, sessionsCovered: 3, sessionsUsed: 3, sessionsRemaining: 0 },
      { displayName: 'Amanda', gender: 'female', totalPaid: 460, sessionsCovered: 12, sessionsUsed: 12, sessionsRemaining: 0, workoutHistory: amandaWorkouts },
      { displayName: 'Caleb', gender: 'male', totalPaid: 0, sessionsCovered: 0, sessionsUsed: 0, sessionsRemaining: 0 },
      { displayName: 'Carol', gender: 'female', totalPaid: 120, sessionsCovered: 2, sessionsUsed: 2, sessionsRemaining: 0 },
      { displayName: 'Catherine', gender: 'female', totalPaid: 490, sessionsCovered: 7, sessionsUsed: 6, sessionsRemaining: 1, sessionInfo: 'Continuous' },
      { displayName: 'Catherine S', gender: 'female', totalPaid: 770, sessionsCovered: 14, sessionsUsed: 14, sessionsRemaining: 0 },
      { displayName: 'Ciaran', gender: 'male', totalPaid: 1200, sessionsCovered: 24, sessionsUsed: 3, sessionsRemaining: 21 },
      { displayName: 'Dani', gender: 'female', totalPaid: 240, sessionsCovered: 4, sessionsUsed: 4, sessionsRemaining: 0 },
      { displayName: 'Don', gender: 'male', totalPaid: 450, sessionsCovered: 9, sessionsUsed: 4, sessionsRemaining: 5 },
      { displayName: 'Hara', gender: 'female', totalPaid: 0, sessionsCovered: 0, sessionsUsed: 0, sessionsRemaining: 0 },
      { displayName: 'Jason', gender: 'male', totalPaid: 300, sessionsCovered: 6, sessionsUsed: 6, sessionsRemaining: 0 },
      { displayName: 'Levi', gender: 'male', totalPaid: 540, sessionsCovered: 12, sessionsUsed: 8, sessionsRemaining: 4 },
      { displayName: 'Marcus', gender: 'male', totalPaid: 180, sessionsCovered: 3, sessionsUsed: 3, sessionsRemaining: 0 },
      { displayName: 'Shaun', gender: 'male', totalPaid: 240, sessionsCovered: 4, sessionsUsed: 3, sessionsRemaining: 1 },
      { displayName: 'Shiree', gender: 'female', totalPaid: 445, sessionsCovered: 8, sessionsUsed: 8, sessionsRemaining: 0 },
      { displayName: 'Tiki', gender: 'female', totalPaid: 1150, sessionsCovered: 23, sessionsUsed: 23, sessionsRemaining: 0, workoutHistory: tikiWorkouts },
    ];
    
    bulkImportClients(realClients);
    toast.success('Imported 16 clients with payment data! Reloading...');
    setTimeout(() => window.location.reload(), 500);
  };

  const handleFixClientCredentials = () => {
    const storedUsers = JSON.parse(localStorage.getItem('apex-users') || '[]');
    let fixedCount = 0;
    
    const updatedUsers = storedUsers.map((u: any) => {
      // Skip trainer accounts
      if (u.isTrainer || u.mode === 'trainer') return u;
      
      // Fix missing email
      if (!u.email || u.email === '') {
        u.email = `${u.displayName?.toLowerCase().replace(/\s+/g, '.') || u.username}@client.apex`;
        fixedCount++;
      }
      
      // Fix missing password
      if (!u.password) {
        u.password = 'client123';
        fixedCount++;
      }
      
      return u;
    });
    
    localStorage.setItem('apex-users', JSON.stringify(updatedUsers));
    toast.success(`Fixed credentials for ${fixedCount} items! Reloading...`);
    setTimeout(() => window.location.reload(), 500);
  };

  // Sync all data to Supabase
  const handleSyncAllToSupabase = async () => {
    if (!isSupabaseConfigured()) {
      toast.error('Supabase not configured');
      return;
    }
    
    setIsSyncing(true);
    const trainerId = user?.id;
    if (!trainerId) {
      toast.error('No user ID found');
      setIsSyncing(false);
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    // Sync clients
    setSyncStatus(s => ({ ...s, clients: 'syncing' }));
    for (const client of clients) {
      const success = await syncTrainerClientToSupabase({ ...client, trainerId });
      if (success) successCount++; else errorCount++;
    }
    setSyncStatus(s => ({ ...s, clients: errorCount > 0 ? 'error' : 'done' }));

    // Sync sessions
    setSyncStatus(s => ({ ...s, sessions: 'syncing' }));
    for (const session of sessions) {
      const success = await syncTrainerSessionToSupabase({ ...session, trainerId });
      if (success) successCount++; else errorCount++;
    }
    setSyncStatus(s => ({ ...s, sessions: 'done' }));

    // Sync session packages
    setSyncStatus(s => ({ ...s, packages: 'syncing' }));
    for (const pkg of sessionPackages) {
      const success = await syncSessionPackageToSupabase({ ...pkg, trainerId });
      if (success) successCount++; else errorCount++;
    }
    setSyncStatus(s => ({ ...s, packages: 'done' }));

    // Sync calendar events
    setSyncStatus(s => ({ ...s, calendar: 'syncing' }));
    for (const event of calendarEvents) {
      const success = await syncCalendarEventToSupabase({ ...event, trainerId });
      if (success) successCount++; else errorCount++;
    }
    setSyncStatus(s => ({ ...s, calendar: 'done' }));

    // Sync payments
    setSyncStatus(s => ({ ...s, payments: 'syncing' }));
    for (const payment of payments) {
      const success = await syncPaymentToSupabase({ ...payment, trainerId });
      if (success) successCount++; else errorCount++;
    }
    setSyncStatus(s => ({ ...s, payments: 'done' }));

    // Sync client programs
    setSyncStatus(s => ({ ...s, programs: 'syncing' }));
    for (const program of clientPrograms) {
      const success = await syncClientProgramToSupabase({ ...program, trainerId });
      if (success) successCount++; else errorCount++;
    }
    setSyncStatus(s => ({ ...s, programs: 'done' }));

    // Sync session workouts (from builder)
    setSyncStatus(s => ({ ...s, workouts: 'syncing' }));
    for (const workout of sessionWorkouts) {
      const success = await syncSessionWorkoutToSupabase({ ...workout, trainerId });
      if (success) successCount++; else errorCount++;
    }
    setSyncStatus(s => ({ ...s, workouts: 'done' }));

    // Sync workout library
    setSyncStatus(s => ({ ...s, library: 'syncing' }));
    for (const workout of workoutLibrary) {
      const success = await syncWorkoutLibraryToSupabase({ ...workout, trainerId });
      if (success) successCount++; else errorCount++;
    }
    setSyncStatus(s => ({ ...s, library: 'done' }));

    // Sync circuit library
    setSyncStatus(s => ({ ...s, circuits: 'syncing' }));
    for (const circuit of circuitLibrary) {
      const success = await syncCircuitLibraryToSupabase({ ...circuit, trainerId });
      if (success) successCount++; else errorCount++;
    }
    setSyncStatus(s => ({ ...s, circuits: 'done' }));

    // Sync workout history (completed workouts)
    setSyncStatus(s => ({ ...s, history: 'syncing' }));
    for (const workout of workoutHistory) {
      const success = await syncWorkoutToSupabase(workout);
      if (success) successCount++; else errorCount++;
    }
    setSyncStatus(s => ({ ...s, history: 'done' }));

    setIsSyncing(false);
    toast.success(`Synced ${successCount} items to Supabase!`, {
      description: errorCount > 0 ? `${errorCount} items failed` : 'All data backed up to cloud',
    });
  };

  // Load all data from Supabase
  const handleLoadFromSupabase = async () => {
    if (!isSupabaseConfigured()) {
      toast.error('Supabase not configured');
      return;
    }
    
    setIsSyncing(true);
    try {
      await loadFromSupabase(user?.id || '');
      toast.success('Data loaded from Supabase!', {
        description: 'Your data has been restored from the cloud',
      });
    } catch (e) {
      toast.error('Failed to load from Supabase');
    }
    setIsSyncing(false);
  };

  const [bio, setBio] = useState('');
  const [personalEmail, setPersonalEmail] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [preferredUnit, setPreferredUnit] = useState<WeightUnit>('kg');
  const [exerciseUnit, setExerciseUnit] = useState<WeightUnit>('kg');
  const [isPublicProfile, setIsPublicProfile] = useState(true);
  const [notifications, setNotifications] = useState(true);
  // TODO: notification_prefs JSONB column may not exist in users table yet.
  // DEFAULT to { email: true, push: true } client-side until schema migration applied.
  const [emailNotifications, setEmailNotifications] = useState((user as any)?.notification_prefs?.email ?? true);
  const [pushNotifications, setPushNotifications] = useState((user as any)?.notification_prefs?.push ?? true);
  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false);
  
  // Gym affiliation
  const [gymName, setGymName] = useState('');
  const [gymSearch, setGymSearch] = useState('');
  const [showGymSearch, setShowGymSearch] = useState(false);
  const [gyms, setGyms] = useState<Gym[]>([]);
  
  // Health connections
  const [healthConnections, setHealthConnections] = useState(user?.healthConnections || {});
  const [showHealthInfo, setShowHealthInfo] = useState<string | null>(null);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const searchParams = useSearchParams();

  // Handle OAuth callbacks from Google Calendar and Stripe
  const handleOAuthCallback = useCallback(() => {
    const gcalStatus = searchParams.get('gcal');
    const stripeStatus = searchParams.get('stripe');
    const callbackData = searchParams.get('data');

    if (gcalStatus === 'success' && callbackData) {
      try {
        const data = JSON.parse(decodeURIComponent(callbackData));
        const updated = { ...healthConnections, calendar: { connected: true, provider: 'google' as const, lastSync: new Date().toISOString(), email: data.email } };
        setHealthConnections(updated);
        updateUser({ healthConnections: updated });
        toast.success(`Google Calendar connected (${data.email})`);
      } catch { /* ignore parse errors */ }
      window.history.replaceState({}, '', '/settings');
    } else if (gcalStatus === 'error') {
      const reason = searchParams.get('reason');
      toast.error(`Calendar connection failed: ${reason || 'Unknown error'}`);
      window.history.replaceState({}, '', '/settings');
    }

    if (stripeStatus === 'success' && callbackData) {
      try {
        const data = JSON.parse(decodeURIComponent(callbackData));
        const updated = { ...healthConnections, stripe: { connected: true, accountId: data.accountId } };
        setHealthConnections(updated);
        updateUser({ healthConnections: updated });
        toast.success('Stripe account connected!');
      } catch { /* ignore parse errors */ }
      window.history.replaceState({}, '', '/settings');
    } else if (stripeStatus === 'error') {
      const reason = searchParams.get('reason');
      toast.error(`Stripe connection failed: ${reason || 'Unknown error'}`);
      window.history.replaceState({}, '', '/settings');
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    handleOAuthCallback();
  }, [handleOAuthCallback]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/auth');
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || '');
      setBio(user.bio || '');
      setPersonalEmail(user.contactLinks?.email || user.email || '');
      setHeight(user.height?.toString() || '');
      setWeight(user.weight?.toString() || '');
      setPreferredUnit(user.preferredUnit || 'kg');
      setExerciseUnit(user.exerciseUnit || 'kg');
      setIsPublicProfile(user.isPublicProfile !== false); // Default to true
      setGymName(user.gymName || '');
      setHealthConnections(user.healthConnections || {});
    }
  }, [user]);

  // Load gyms list
  // v16-D2: scope `apex-gyms` per-user so a different account on the
  // same browser doesn't inherit this user's saved gyms.
  useEffect(() => {
    if (!user?.id) {
      setGyms([]);
      return;
    }
    try {
      const stored = JSON.parse(localStorage.getItem(`apex-gyms-${user.id}`) || '[]');
      setGyms(stored);
    } catch {
      setGyms([]);
    }
  }, [user?.id]);

  const handleSaveProfile = () => {
    updateUser({
      displayName,
      bio,
      height: height ? parseFloat(height) : undefined,
      weight: weight ? parseFloat(weight) : undefined,
      preferredUnit,
      exerciseUnit,
      isPublicProfile,
      gymName: gymName || undefined,
      healthConnections,
      contactLinks: {
        ...user?.contactLinks,
        email: personalEmail || undefined,
      },
    });
    toast.success('Profile updated successfully');
  };

  const handleAddGym = (name: string) => {
    if (!name.trim() || !user) return;
    const newGym: Gym = {
      id: `gym-${Date.now()}`,
      name: name.trim(),
      createdBy: user.id,
      createdAt: new Date().toISOString(),
    };
    const updated = [...gyms, newGym];
    setGyms(updated);
    // v16-D2: per-user scoped key
    localStorage.setItem(`apex-gyms-${user.id}`, JSON.stringify(updated));
    setGymName(name.trim());
    setGymSearch('');
    setShowGymSearch(false);
  };

  const handleToggleConnection = (service: string) => {
    // Calendar and Stripe use real OAuth — redirect to provider
    if (service === 'calendar') {
      handleGoogleCalendarConnect();
      return;
    }
    if (service === 'stripe') {
      handleStripeConnect();
      return;
    }
    // Apple Health & Google Health show info dialog (native-only)
    setShowHealthInfo(service);
  };

  const handleGoogleCalendarConnect = async () => {
    if (!user?.id) return;
    setOauthLoading('calendar');
    try {
      const res = await fetch(`/api/auth/google-calendar?userId=${user.id}`);
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error(data.error || 'Failed to start Google Calendar connection. Check that GOOGLE_CLIENT_ID is set in .env.local');
        setOauthLoading(null);
      }
    } catch {
      toast.error('Failed to connect to Google Calendar');
      setOauthLoading(null);
    }
  };

  const handleStripeConnect = async () => {
    if (!user?.id) return;
    setOauthLoading('stripe');
    try {
      const res = await fetch(`/api/auth/stripe-connect?userId=${user.id}`);
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error(data.error || 'Failed to start Stripe connection. Check that STRIPE_CONNECT_CLIENT_ID is set in .env.local');
        setOauthLoading(null);
      }
    } catch {
      toast.error('Failed to connect to Stripe');
      setOauthLoading(null);
    }
  };

  const handleConfirmConnection = (service: string) => {
    // For health services (native-only) — mark as interested / waiting for native app
    const updated = { ...healthConnections, [service]: { connected: false, interested: true, requestedAt: new Date().toISOString() } };
    setHealthConnections(updated);
    updateUser({ healthConnections: updated });
    setShowHealthInfo(null);
    toast.success(`${service === 'appleHealth' ? 'Apple Health' : 'Google Health'} — you'll be notified when the native app is ready!`);
  };

  const handleDisconnectService = async (service: string) => {
    const updated = { ...healthConnections, [service]: { connected: false } };
    setHealthConnections(updated);
    updateUser({ healthConnections: updated });
    toast.success('Disconnected');
  };

  if (!isAuthenticated || !user) return null;

  return (
    <MainLayout>
      <PageHeader 
        title="Settings" 
        showBack
        action={
          <Button onClick={handleSaveProfile} className="bg-sky-500 hover:bg-sky-600">
            <Save className="w-4 h-4 mr-2" />
            Save
          </Button>
        }
      />

      <div className="px-4 py-6 space-y-6">
        {/* Profile Settings */}
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-gray-900 flex items-center gap-2">
              <User className="w-5 h-5 text-sky-400" />
              Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-gray-600">Display Name</Label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your display name"
                className="bg-gray-50 border-gray-200 text-gray-900"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-600">Personal Email</Label>
              <Input
                type="email"
                value={personalEmail}
                onChange={(e) => setPersonalEmail(e.target.value)}
                placeholder="your@email.com"
                className="bg-gray-50 border-gray-200 text-gray-900"
              />
              <p className="text-[11px] text-gray-500">Used for app access links and notifications</p>
            </div>
            <div className="space-y-2">
              <Label className="text-gray-600">Bio</Label>
              <Textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell us about yourself..."
                className="bg-gray-50 border-gray-200 text-gray-900 min-h-[80px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-600">Height (cm)</Label>
                <Input
                  type="number"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  placeholder="175"
                  className="bg-gray-50 border-gray-200 text-gray-900"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-600">Weight (kg)</Label>
                <Input
                  type="number"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="70"
                  className="bg-gray-50 border-gray-200 text-gray-900"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-gray-600">Gym</Label>
              {gymName && !showGymSearch ? (
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
                    <Dumbbell className="w-4 h-4 text-sky-400" />
                    <span className="text-gray-900 text-sm">{gymName}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-gray-400 hover:text-gray-900"
                    onClick={() => { setShowGymSearch(true); setGymSearch(gymName); }}
                  >
                    <Search className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-gray-400 hover:text-red-400"
                    onClick={() => { setGymName(''); }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <Input
                    value={gymSearch}
                    onChange={(e) => { setGymSearch(e.target.value); setShowGymSearch(true); }}
                    onFocus={() => setShowGymSearch(true)}
                    placeholder="Search or add your gym..."
                    className="bg-gray-50 border-gray-200 text-gray-900"
                  />
                  {showGymSearch && gymSearch.trim() && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg z-50 max-h-48 overflow-y-auto shadow-xl">
                      {gyms
                        .filter(g => g.name.toLowerCase().includes(gymSearch.toLowerCase()))
                        .slice(0, 5)
                        .map(g => (
                          <button
                            key={g.id}
                            className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm text-gray-900 flex items-center gap-2"
                            onClick={() => { setGymName(g.name); setGymSearch(''); setShowGymSearch(false); }}
                          >
                            <Dumbbell className="w-3 h-3 text-sky-400" />
                            {g.name}
                            {g.location && <span className="text-gray-500 text-xs">• {g.location}</span>}
                          </button>
                        ))}
                      {!gyms.some(g => g.name.toLowerCase() === gymSearch.toLowerCase()) && (
                        <button
                          className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm text-sky-500 flex items-center gap-2 border-t border-gray-200"
                          onClick={() => handleAddGym(gymSearch)}
                        >
                          <Plus className="w-3 h-3" />
                          Add &quot;{gymSearch.trim()}&quot;
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Connected Services */}
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-gray-900 flex items-center gap-2">
              <Link2 className="w-5 h-5 text-emerald-400" />
              Connected Services
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Apple Health */}
            <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                  <Heart className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">Apple Health</p>
                  <p className="text-xs text-gray-500">Requires iOS app (HealthKit)</p>
                </div>
              </div>
              {(healthConnections?.appleHealth as any)?.interested ? (
                <span className="text-xs text-amber-400">Notify me</span>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs border-gray-600 text-gray-300 hover:border-red-500/50 hover:text-red-400"
                  onClick={() => handleToggleConnection('appleHealth')}
                >
                  Set Up
                </Button>
              )}
            </div>

            {/* Google/Samsung Health */}
            <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                  <Smartphone className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">Google / Samsung Health</p>
                  <p className="text-xs text-gray-500">Requires Android app (Health Connect)</p>
                </div>
              </div>
              {(healthConnections?.googleHealth as any)?.interested ? (
                <span className="text-xs text-amber-400">Notify me</span>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs border-gray-600 text-gray-300 hover:border-green-500/50 hover:text-green-400"
                  onClick={() => handleToggleConnection('googleHealth')}
                >
                  Set Up
                </Button>
              )}
            </div>

            {/* Calendar */}
            <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">Google Calendar</p>
                  <p className="text-xs text-gray-500">Sign in to sync bookings & workouts</p>
                </div>
              </div>
              {healthConnections?.calendar?.connected ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-emerald-400">Connected</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-gray-400 hover:text-red-400"
                    onClick={() => handleDisconnectService('calendar')}
                  >
                    Disconnect
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs border-gray-600 text-gray-300 hover:border-blue-500/50 hover:text-blue-400"
                  disabled={oauthLoading === 'calendar'}
                  onClick={() => handleToggleConnection('calendar')}
                >
                  {oauthLoading === 'calendar' ? 'Redirecting...' : 'Sign In'}
                </Button>
              )}
            </div>

            {/* Stripe — trainers only */}
            {user.isTrainer && (
              <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">Stripe</p>
                    <p className="text-xs text-gray-500">Connect account to accept payments</p>
                  </div>
                </div>
                {healthConnections?.stripe?.connected ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-emerald-400">Connected</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-gray-400 hover:text-red-400"
                      onClick={() => handleDisconnectService('stripe')}
                    >
                      Disconnect
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs border-gray-600 text-gray-300 hover:border-purple-500/50 hover:text-purple-400"
                    disabled={oauthLoading === 'stripe'}
                    onClick={() => handleToggleConnection('stripe')}
                  >
                    {oauthLoading === 'stripe' ? 'Redirecting...' : 'Connect'}
                  </Button>
                )}
              </div>
            )}

            <p className="text-xs text-gray-500 text-center pt-1">
              Calendar & Stripe connect via OAuth. Health data requires the native iOS/Android app.
            </p>
          </CardContent>
        </Card>

        {/* Connection Info Dialog */}
        {showHealthInfo && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowHealthInfo(null)}>
            <div className="bg-white border border-gray-200 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-lg" onClick={e => e.stopPropagation()}>
              <div className="text-center">
                <div className={`w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center ${
                  showHealthInfo === 'appleHealth' ? 'bg-red-500/20' :
                  showHealthInfo === 'googleHealth' ? 'bg-green-500/20' :
                  showHealthInfo === 'calendar' ? 'bg-blue-500/20' : 'bg-purple-500/20'
                }`}>
                  {showHealthInfo === 'appleHealth' && <Heart className="w-8 h-8 text-red-400" />}
                  {showHealthInfo === 'googleHealth' && <Smartphone className="w-8 h-8 text-green-400" />}
                  {showHealthInfo === 'calendar' && <Calendar className="w-8 h-8 text-blue-400" />}
                  {showHealthInfo === 'stripe' && <CreditCard className="w-8 h-8 text-purple-400" />}
                </div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {showHealthInfo === 'appleHealth' ? 'Apple Health' : 'Google / Samsung Health'}
                </h3>
                <p className="text-sm text-gray-500 mt-2">
                  {showHealthInfo === 'appleHealth' && 'Apple Health uses HealthKit which requires a native iOS app. Once our iOS app is available, it will read your steps, calories, heart rate, and sleep data directly from your Apple ID.'}
                  {showHealthInfo === 'googleHealth' && 'Google Health Connect requires a native Android app. Once our Android app is available, it will read your steps, calories, and heart rate data from your Google or Samsung account.'}
                </p>
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mt-2">
                  <p className="text-xs text-amber-600">📱 Native app coming soon! Tap below to be notified when it launches.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 border-gray-200 text-gray-500"
                  onClick={() => setShowHealthInfo(null)}
                >
                  Not Now
                </Button>
                <Button
                  className={`flex-1 ${
                    showHealthInfo === 'appleHealth' ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
                  }`}
                  onClick={() => handleConfirmConnection(showHealthInfo)}
                >
                  <Bell className="w-4 h-4 mr-2" /> Notify Me
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Preferences */}
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-gray-900 flex items-center gap-2">
              <Scale className="w-5 h-5 text-blue-400" />
              Preferences
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Body Weight Unit</p>
                <p className="text-sm text-gray-500">For your body weight display</p>
              </div>
              <Select value={preferredUnit} onValueChange={(v) => setPreferredUnit(v as WeightUnit)}>
                <SelectTrigger className="w-24 bg-gray-50 border-gray-200 text-gray-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-200">
                  <SelectItem value="kg">kg</SelectItem>
                  <SelectItem value="lb">lb</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Separator className="bg-gray-200" />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Exercise Weight Unit</p>
                <p className="text-sm text-gray-500">For workout exercises display</p>
              </div>
              <Select value={exerciseUnit} onValueChange={(v) => setExerciseUnit(v as WeightUnit)}>
                <SelectTrigger className="w-24 bg-gray-50 border-gray-200 text-gray-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-200">
                  <SelectItem value="kg">kg</SelectItem>
                  <SelectItem value="lb">lb</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Privacy Settings */}
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-gray-900 flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-400" />
              Privacy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Public Profile</p>
                <p className="text-sm text-gray-500">Anyone can view your profile and stats</p>
              </div>
              <Switch 
                checked={isPublicProfile}
                onCheckedChange={setIsPublicProfile}
                className="data-[state=checked]:bg-sky-500"
              />
            </div>
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <p className="text-xs text-gray-500">
                {isPublicProfile 
                  ? "Your profile is visible to everyone. Anyone can see your strength ratings and workout stats."
                  : "Your profile is private. Only your trainer and friends can see your strength ratings and workout stats."}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-gray-900 flex items-center gap-2">
              <Bell className="w-5 h-5 text-amber-400" />
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Email Notifications</p>
                <p className="text-sm text-gray-500">Receive workout summaries, program updates, and reminders via email</p>
              </div>
              <Switch 
                checked={emailNotifications}
                onCheckedChange={(checked) => {
                  setEmailNotifications(checked);
                  // TODO: Save to users.notification_prefs once column exists
                  toast.success(checked ? 'Email notifications enabled' : 'Email notifications disabled');
                }}
                className="data-[state=checked]:bg-sky-500"
              />
            </div>
            <Separator className="bg-gray-200" />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Push Notifications</p>
                <p className="text-sm text-gray-500">Receive in-app alerts for messages, completed workouts, and updates</p>
              </div>
              <Switch 
                checked={pushNotifications}
                onCheckedChange={(checked) => {
                  setPushNotifications(checked);
                  // TODO: Save to users.notification_prefs once column exists
                  toast.success(checked ? 'Push notifications enabled' : 'Push notifications disabled');
                }}
                className="data-[state=checked]:bg-sky-500"
              />
            </div>
          </CardContent>
        </Card>

        {/* More Options
         *
         * Previously held three buttons (Privacy & Security, Appearance,
         * Help & Support). Appearance + Help & Support had no onClick and
         * violated App Store Guideline 5.1.1 — they've been removed in the
         * 2026-05-06 Sev-1 cleanup. Privacy & Security is wired below to
         * the new `/settings/privacy` page. If / when Appearance and Help
         * ship as real pages, re-introduce their buttons here with the
         * same row styling. Route constant is imported from the privacy
         * page module so there is a single source of truth.
         */}
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="p-0">
            <Button
              variant="ghost"
              className="w-full justify-start h-14 px-4 text-gray-600 hover:bg-gray-50 rounded-none"
              onClick={() => router.push(PRIVACY_SETTINGS_ROUTE)}
              data-testid="settings-privacy-button"
            >
              <Shield className="w-5 h-5 mr-3 text-gray-500" />
              Privacy & Security
              <ChevronRight className="w-5 h-5 ml-auto text-gray-500" />
            </Button>
          </CardContent>
        </Card>

        {/* Trainer Import - Only show for trainers */}
        {user.isTrainer && (
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-gray-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-sky-400" />
                Client Import
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                className="w-full bg-sky-600 hover:bg-sky-700"
                onClick={handleImportRealClients}
              >
                <Upload className="w-4 h-4 mr-2" />
                Import Real Clients (Clear Mock Data)
              </Button>
              <p className="text-xs text-gray-500 text-center">
                This will clear all mock users/posts and import your 16 real clients
              </p>
              <Button
                variant="outline"
                className="w-full border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
                onClick={handleFixClientCredentials}
              >
                Fix Client Login Credentials
              </Button>
              <p className="text-xs text-gray-500 text-center">
                Add missing emails/passwords to existing clients so they can log in
              </p>
            </CardContent>
          </Card>
        )}

        {/* Cloud Sync - Supabase */}
        <Card className="bg-white border-blue-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-gray-900 flex items-center gap-2">
              <Cloud className="w-5 h-5 text-blue-400" />
              Cloud Sync (Supabase)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-500">
              Sync your data to the cloud for cross-device access. Your data is stored locally first, then backed up to Supabase.
            </p>
            
            {/* Data summary */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded p-2">
                <span className="text-gray-500">Clients</span>
                <span className="text-gray-900 font-medium">{clients.length}</span>
              </div>
              <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded p-2">
                <span className="text-gray-500">Sessions</span>
                <span className="text-gray-900 font-medium">{sessions.length}</span>
              </div>
              <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded p-2">
                <span className="text-gray-500">Calendar</span>
                <span className="text-gray-900 font-medium">{calendarEvents.length}</span>
              </div>
              <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded p-2">
                <span className="text-gray-500">Payments</span>
                <span className="text-gray-900 font-medium">{payments.length}</span>
              </div>
              <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded p-2">
                <span className="text-gray-500">Programs</span>
                <span className="text-gray-900 font-medium">{clientPrograms.length}</span>
              </div>
              <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded p-2">
                <span className="text-gray-500">Workouts</span>
                <span className="text-gray-900 font-medium">{sessionWorkouts.length}</span>
              </div>
              <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded p-2">
                <span className="text-gray-500">Library Templates</span>
                <span className="text-gray-900 font-medium">{workoutLibrary.length}</span>
              </div>
              <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded p-2">
                <span className="text-gray-500">Circuit Templates</span>
                <span className="text-gray-900 font-medium">{circuitLibrary.length}</span>
              </div>
              <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded p-2">
                <span className="text-gray-500">Workout History</span>
                <span className="text-gray-900 font-medium">{workoutHistory.length}</span>
              </div>
            </div>

            <Separator className="bg-gray-200" />

            <Button
              className="w-full bg-blue-600 hover:bg-blue-700"
              onClick={handleSyncAllToSupabase}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CloudUpload className="w-4 h-4 mr-2" />
              )}
              {isSyncing ? 'Syncing...' : 'Upload All Data to Supabase'}
            </Button>
            <p className="text-xs text-gray-500 text-center">
              Push all your local data to Supabase for backup & cross-device sync
            </p>

            <Button
              variant="outline"
              className="w-full border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
              onClick={handleLoadFromSupabase}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Database className="w-4 h-4 mr-2" />
              )}
              {isSyncing ? 'Loading...' : 'Load Data from Supabase'}
            </Button>
            <p className="text-xs text-gray-500 text-center">
              Pull your data from Supabase (replaces local data)
            </p>
          </CardContent>
        </Card>

        {/* Delete Account */}
        <Card className="bg-white border-red-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-red-400 flex items-center gap-2">
              ⚠️ Danger Zone
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="destructive"
              className="w-full bg-red-600 hover:bg-red-700"
              onClick={() => setShowDeleteAccountConfirm(true)}
            >
              Delete My Account
            </Button>
            <p className="text-xs text-gray-500 text-center">
              Permanently delete your account and all associated data
            </p>
          </CardContent>
        </Card>

        {/* Developer Options */}
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-gray-900 flex items-center gap-2">
              🔧 Developer Options
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="outline"
              className="w-full border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
              onClick={() => {
                resetWorkoutDataOnly();
                toast.success('Workouts & medals cleared! Reload to see changes.');
                setTimeout(() => window.location.reload(), 500);
              }}
            >
              Reset Workouts & Medals Only
            </Button>
            <p className="text-xs text-gray-500 text-center">
              Clear workout history, medals, and strength rating to test fresh
            </p>
            <Button
              variant="destructive"
              className="w-full"
              onClick={() => {
                resetSeedData();
                toast.success('All data reset! Reloading...');
                setTimeout(() => window.location.href = '/', 500);
              }}
            >
              Reset All Data & Reload
            </Button>
            <p className="text-xs text-gray-500 text-center">
              Clear everything and regenerate sample users, posts, and workouts
            </p>
          </CardContent>
        </Card>

        {/* App Info */}
        <div className="text-center text-gray-500 text-sm py-4">
          <p>Catalift v1.0.0</p>
          <p className="mt-1">Made with 💪 for fitness enthusiasts</p>
        </div>
      </div>
      <ConfirmDialog
        open={showDeleteAccountConfirm}
        onOpenChange={setShowDeleteAccountConfirm}
        title="Delete Account"
        description="Are you sure you want to delete your account? This cannot be undone. All your data will be permanently removed."
        confirmLabel="Delete My Account"
        variant="destructive"
        onConfirm={() => {
          deleteAccount();
          toast.success('Account deleted');
          setTimeout(() => window.location.href = '/auth', 500);
        }}
      />
    </MainLayout>
  );
}
