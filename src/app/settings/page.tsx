'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
import { 
  User, 
  Bell, 
  Scale, 
  Palette, 
  Shield, 
  HelpCircle,
  ChevronRight,
  Save,
  Upload,
  Users
} from 'lucide-react';
import { toast } from 'sonner';
import { Gender, WeightUnit } from '@/types';
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
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [preferredUnit, setPreferredUnit] = useState<WeightUnit>('kg');
  const [exerciseUnit, setExerciseUnit] = useState<WeightUnit>('kg');
  const [isPublicProfile, setIsPublicProfile] = useState(true);
  const [notifications, setNotifications] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/auth');
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || '');
      setBio(user.bio || '');
      setHeight(user.height?.toString() || '');
      setWeight(user.weight?.toString() || '');
      setPreferredUnit(user.preferredUnit || 'kg');
      setExerciseUnit(user.exerciseUnit || 'kg');
      setIsPublicProfile(user.isPublicProfile !== false); // Default to true
    }
  }, [user]);

  const handleSaveProfile = () => {
    updateUser({
      displayName,
      bio,
      height: height ? parseFloat(height) : undefined,
      weight: weight ? parseFloat(weight) : undefined,
      preferredUnit,
      exerciseUnit,
      isPublicProfile,
    });
    toast.success('Profile updated successfully');
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
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <User className="w-5 h-5 text-sky-400" />
              Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-gray-300">Display Name</Label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your display name"
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">Bio</Label>
              <Textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell us about yourself..."
                className="bg-gray-800 border-gray-700 text-white min-h-[80px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-300">Height (cm)</Label>
                <Input
                  type="number"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  placeholder="175"
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">Weight (kg)</Label>
                <Input
                  type="number"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="70"
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Preferences */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Scale className="w-5 h-5 text-blue-400" />
              Preferences
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-white">Body Weight Unit</p>
                <p className="text-sm text-gray-500">For your body weight display</p>
              </div>
              <Select value={preferredUnit} onValueChange={(v) => setPreferredUnit(v as WeightUnit)}>
                <SelectTrigger className="w-24 bg-gray-800 border-gray-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="kg">kg</SelectItem>
                  <SelectItem value="lb">lb</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Separator className="bg-gray-800" />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-white">Exercise Weight Unit</p>
                <p className="text-sm text-gray-500">For workout exercises display</p>
              </div>
              <Select value={exerciseUnit} onValueChange={(v) => setExerciseUnit(v as WeightUnit)}>
                <SelectTrigger className="w-24 bg-gray-800 border-gray-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="kg">kg</SelectItem>
                  <SelectItem value="lb">lb</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Privacy Settings */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-400" />
              Privacy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-white">Public Profile</p>
                <p className="text-sm text-gray-500">Anyone can view your profile and stats</p>
              </div>
              <Switch 
                checked={isPublicProfile}
                onCheckedChange={setIsPublicProfile}
                className="data-[state=checked]:bg-sky-500"
              />
            </div>
            <div className="p-3 bg-gray-800 rounded-lg">
              <p className="text-xs text-gray-400">
                {isPublicProfile 
                  ? "Your profile is visible to everyone. Anyone can see your strength ratings and workout stats."
                  : "Your profile is private. Only your trainer and friends can see your strength ratings and workout stats."}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Bell className="w-5 h-5 text-amber-400" />
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-white">Weekly Reports</p>
                <p className="text-sm text-gray-500">Get notified when your weekly report is ready</p>
              </div>
              <Switch 
                checked={notifications}
                onCheckedChange={setNotifications}
                className="data-[state=checked]:bg-sky-500"
              />
            </div>
            <Separator className="bg-gray-800" />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-white">Workout Reminders</p>
                <p className="text-sm text-gray-500">Remind me to workout</p>
              </div>
              <Switch className="data-[state=checked]:bg-sky-500" />
            </div>
            <Separator className="bg-gray-800" />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-white">Social Notifications</p>
                <p className="text-sm text-gray-500">Likes, comments, and follows</p>
              </div>
              <Switch defaultChecked className="data-[state=checked]:bg-sky-500" />
            </div>
          </CardContent>
        </Card>

        {/* More Options */}
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-0">
            <Button
              variant="ghost"
              className="w-full justify-start h-14 px-4 text-gray-300 hover:bg-gray-800 rounded-none border-b border-gray-800"
            >
              <Shield className="w-5 h-5 mr-3 text-gray-500" />
              Privacy & Security
              <ChevronRight className="w-5 h-5 ml-auto text-gray-500" />
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start h-14 px-4 text-gray-300 hover:bg-gray-800 rounded-none border-b border-gray-800"
            >
              <Palette className="w-5 h-5 mr-3 text-gray-500" />
              Appearance
              <ChevronRight className="w-5 h-5 ml-auto text-gray-500" />
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start h-14 px-4 text-gray-300 hover:bg-gray-800 rounded-none"
            >
              <HelpCircle className="w-5 h-5 mr-3 text-gray-500" />
              Help & Support
              <ChevronRight className="w-5 h-5 ml-auto text-gray-500" />
            </Button>
          </CardContent>
        </Card>

        {/* Trainer Import - Only show for trainers */}
        {user.isTrainer && (
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
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
        <Card className="bg-gray-900 border-blue-900">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Cloud className="w-5 h-5 text-blue-400" />
              Cloud Sync (Supabase)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-400">
              Sync your data to the cloud for cross-device access. Your data is stored locally first, then backed up to Supabase.
            </p>
            
            {/* Data summary */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center justify-between bg-gray-800 rounded p-2">
                <span className="text-gray-400">Clients</span>
                <span className="text-white font-medium">{clients.length}</span>
              </div>
              <div className="flex items-center justify-between bg-gray-800 rounded p-2">
                <span className="text-gray-400">Sessions</span>
                <span className="text-white font-medium">{sessions.length}</span>
              </div>
              <div className="flex items-center justify-between bg-gray-800 rounded p-2">
                <span className="text-gray-400">Calendar</span>
                <span className="text-white font-medium">{calendarEvents.length}</span>
              </div>
              <div className="flex items-center justify-between bg-gray-800 rounded p-2">
                <span className="text-gray-400">Payments</span>
                <span className="text-white font-medium">{payments.length}</span>
              </div>
              <div className="flex items-center justify-between bg-gray-800 rounded p-2">
                <span className="text-gray-400">Programs</span>
                <span className="text-white font-medium">{clientPrograms.length}</span>
              </div>
              <div className="flex items-center justify-between bg-gray-800 rounded p-2">
                <span className="text-gray-400">Workouts</span>
                <span className="text-white font-medium">{sessionWorkouts.length}</span>
              </div>
              <div className="flex items-center justify-between bg-gray-800 rounded p-2">
                <span className="text-gray-400">Library Templates</span>
                <span className="text-white font-medium">{workoutLibrary.length}</span>
              </div>
              <div className="flex items-center justify-between bg-gray-800 rounded p-2">
                <span className="text-gray-400">Circuit Templates</span>
                <span className="text-white font-medium">{circuitLibrary.length}</span>
              </div>
              <div className="flex items-center justify-between bg-gray-800 rounded p-2">
                <span className="text-gray-400">Workout History</span>
                <span className="text-white font-medium">{workoutHistory.length}</span>
              </div>
            </div>

            <Separator className="bg-gray-700" />

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
        <Card className="bg-gray-900 border-red-900">
          <CardHeader>
            <CardTitle className="text-red-400 flex items-center gap-2">
              ⚠️ Danger Zone
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="destructive"
              className="w-full bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (confirm('Are you sure you want to delete your account? This cannot be undone.')) {
                  deleteAccount();
                  toast.success('Account deleted');
                  setTimeout(() => window.location.href = '/auth', 500);
                }
              }}
            >
              Delete My Account
            </Button>
            <p className="text-xs text-gray-500 text-center">
              Permanently delete your account and all associated data
            </p>
          </CardContent>
        </Card>

        {/* Developer Options */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
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
    </MainLayout>
  );
}
