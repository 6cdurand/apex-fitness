'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { updateUserInSupabase } from '@/lib/supabaseSync';
import { User, Dumbbell, ArrowRight } from 'lucide-react';
import { Gender } from '@/types';

export default function ClientOnboardingPage() {
  const router = useRouter();
  const { user, isAuthenticated, updateUser } = useAuthStore();
  
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [gender, setGender] = useState<Gender>(user?.gender || 'other');
  const [height, setHeight] = useState(user?.height?.toString() || '');
  const [weight, setWeight] = useState(user?.weight?.toString() || '');

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/auth');
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (user) {
      if (user.displayName) setDisplayName(user.displayName);
      if (user.gender) setGender(user.gender);
      if (user.height) setHeight(user.height.toString());
      if (user.weight) setWeight(user.weight.toString());
    }
  }, [user]);

  const handleSubmit = async () => {
    if (!user) return;

    const updates: any = {
      displayName: displayName.trim() || user.displayName,
      gender,
      height: height ? parseFloat(height) : undefined,
      weight: weight ? parseFloat(weight) : undefined,
    };

    // Update local store
    updateUser(updates);

    // Mark account as active in Supabase (no longer a placeholder)
    await updateUserInSupabase(user.id, {
      ...updates,
      accountStatus: 'active',
    } as any);

    // Also update localStorage
    const storedUsers = JSON.parse(localStorage.getItem('apex-users') || '[]');
    const idx = storedUsers.findIndex((u: any) => u.id === user.id);
    if (idx !== -1) {
      storedUsers[idx] = { ...storedUsers[idx], ...updates, accountStatus: 'active' };
      localStorage.setItem('apex-users', JSON.stringify(storedUsers));
    }

    toast.success('Profile set up! Welcome to Catalift!');
    router.push('/today');
  };

  if (!isAuthenticated || !user) return null;

  return (
    <MainLayout>
      <div className="px-4 py-8 max-w-md mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 mx-auto rounded-full bg-sky-500/20 flex items-center justify-center">
            <Dumbbell className="w-8 h-8 text-sky-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome to Catalift!</h1>
          <p className="text-gray-500 text-sm">
            Let&apos;s set up your profile so your trainer can personalise your program.
          </p>
        </div>

        {/* Form */}
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="p-5 space-y-4">
            <div className="space-y-2">
              <Label className="text-gray-700">Display Name</Label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="bg-gray-50 border-gray-200 text-gray-900"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-gray-700">Gender</Label>
              <Select value={gender} onValueChange={(v) => setGender(v as Gender)}>
                <SelectTrigger className="bg-gray-50 border-gray-200 text-gray-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Prefer not to say</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-gray-700">Height (cm)</Label>
                <Input
                  type="number"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  placeholder="175"
                  className="bg-gray-50 border-gray-200 text-gray-900"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-700">Weight (kg)</Label>
                <Input
                  type="number"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="70"
                  className="bg-gray-50 border-gray-200 text-gray-900"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Button
          onClick={handleSubmit}
          className="w-full bg-sky-500 hover:bg-sky-600 h-12 text-base"
        >
          Continue
          <ArrowRight className="w-5 h-5 ml-2" />
        </Button>

        <button
          onClick={() => router.push('/today')}
          className="w-full text-center text-sm text-gray-400 hover:text-gray-600"
        >
          Skip for now
        </button>
      </div>
    </MainLayout>
  );
}
