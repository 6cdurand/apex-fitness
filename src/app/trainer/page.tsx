'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, useTrainerStore, useWorkoutStore } from '@/lib/store';
import { MainLayout, PageHeader } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  GraduationCap, 
  Calendar, 
  MessageCircle, 
  Dumbbell,
  ChevronRight,
  Search,
  BadgeCheck,
  Target,
  Clock,
  Star,
  Users
} from 'lucide-react';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { fetchAllTrainersFromSupabase, linkClientToTrainer } from '@/lib/supabaseSync';
import { Loader2 } from 'lucide-react';

export default function MyTrainerPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const { assignedWorkouts } = useTrainerStore();
  const [myTrainer, setMyTrainer] = useState<any>(null);
  const [showFindTrainer, setShowFindTrainer] = useState(false);
  const [availableTrainers, setAvailableTrainers] = useState<any[]>([]);
  const [isLoadingTrainers, setIsLoadingTrainers] = useState(false);
  const [trainerSearchQuery, setTrainerSearchQuery] = useState('');
  const [selectedTrainer, setSelectedTrainer] = useState<any>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/auth');
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (user?.trainerId) {
      const storedUsers = JSON.parse(localStorage.getItem('apex-users') || '[]');
      const trainer = storedUsers.find((u: any) => u.id === user.trainerId);
      if (trainer) {
        setMyTrainer(trainer);
      } else {
        // Trainer might be in Supabase but not local, fetch from Supabase
        fetchAllTrainersFromSupabase().then(trainers => {
          const t = trainers.find(tr => tr.id === user.trainerId);
          if (t) setMyTrainer(t);
        });
      }
    }
  }, [user?.trainerId]);

  // Fetch trainers when dialog opens
  useEffect(() => {
    if (showFindTrainer && availableTrainers.length === 0) {
      setIsLoadingTrainers(true);
      fetchAllTrainersFromSupabase()
        .then(trainers => {
          setAvailableTrainers(trainers);
          console.log('[Trainer] Found', trainers.length, 'trainers');
        })
        .finally(() => setIsLoadingTrainers(false));
    }
  }, [showFindTrainer, availableTrainers.length]);

  const filteredTrainers = trainerSearchQuery.trim()
    ? availableTrainers.filter(t => 
        t.displayName?.toLowerCase().includes(trainerSearchQuery.toLowerCase()) ||
        t.username?.toLowerCase().includes(trainerSearchQuery.toLowerCase())
      )
    : availableTrainers;

  const handleConnectToTrainer = async () => {
    if (!selectedTrainer || !user?.id) return;
    
    // Update user's trainerId in Supabase
    await linkClientToTrainer(user.id, selectedTrainer.id);
    
    // Update local user using updateUser from auth store
    const { updateUser } = useAuthStore.getState();
    updateUser({ trainerId: selectedTrainer.id } as any);
    
    // Also update localStorage
    const storedUsers = JSON.parse(localStorage.getItem('apex-users') || '[]');
    const updatedUsers = storedUsers.map((u: any) => 
      u.id === user.id ? { ...u, trainerId: selectedTrainer.id } : u
    );
    localStorage.setItem('apex-users', JSON.stringify(updatedUsers));
    
    setMyTrainer(selectedTrainer);
    setShowFindTrainer(false);
    setSelectedTrainer(null);
    toast.success(`Connected to ${selectedTrainer.displayName || selectedTrainer.username}!`);
  };

  if (!isAuthenticated) return null;

  const upcomingWorkouts = assignedWorkouts
    .filter(w => w.userId === user?.id && w.status === 'active')
    .slice(0, 3);

  return (
    <MainLayout>
      <PageHeader 
        title="My Trainer" 
        subtitle="Your personal training dashboard"
      />

      <ScrollArea className="flex-1">
        <div className="px-4 py-6 space-y-6">
          {/* Current Trainer Section */}
          {myTrainer ? (
            <Card className="bg-gray-900 border-gray-800 overflow-hidden">
              <CardContent className="p-0">
                <div className="bg-gradient-to-r from-rose-500 to-rose-600 p-4">
                  <div className="flex items-center gap-4">
                    <Avatar className="w-16 h-16 border-2 border-white/20">
                      <AvatarImage src={myTrainer.profilePhoto} />
                      <AvatarFallback className="bg-rose-700 text-white text-xl">
                        {myTrainer.displayName?.[0] || myTrainer.username?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-white">
                          {myTrainer.displayName || myTrainer.username}
                        </h3>
                        {myTrainer.isVerifiedTrainer && (
                          <BadgeCheck className="w-5 h-5 text-white" />
                        )}
                      </div>
                      <p className="text-rose-100 text-sm">Personal Trainer</p>
                      {myTrainer.trainerSpecializations && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {myTrainer.trainerSpecializations.slice(0, 3).map((spec: string) => (
                            <Badge key={spec} className="bg-white/20 text-white text-xs">
                              {spec}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 divide-x divide-gray-800">
                  <Button variant="ghost" className="rounded-none py-4 text-gray-300 hover:bg-gray-800">
                    <MessageCircle className="w-5 h-5 mr-2" />
                    Message
                  </Button>
                  <Button variant="ghost" className="rounded-none py-4 text-gray-300 hover:bg-gray-800">
                    <Calendar className="w-5 h-5 mr-2" />
                    Schedule
                  </Button>
                  <Button variant="ghost" className="rounded-none py-4 text-gray-300 hover:bg-gray-800">
                    <Users className="w-5 h-5 mr-2" />
                    Profile
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-gray-900 border-gray-800">
              <CardContent className="py-12 text-center">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-800 flex items-center justify-center">
                  <GraduationCap className="w-10 h-10 text-gray-600" />
                </div>
                <h3 className="font-semibold text-gray-400 mb-2">No Trainer Connected</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Find a personal trainer to guide your fitness journey
                </p>
                <Button 
                  className="bg-rose-500 hover:bg-rose-600"
                  onClick={() => setShowFindTrainer(true)}
                >
                  <Search className="w-4 h-4 mr-2" />
                  Find a Trainer
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Today's Focus / Upcoming Workout */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-emerald-400" />
              Today&apos;s Focus
            </h2>
            {upcomingWorkouts.length > 0 ? (
              <Card className="bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border-emerald-500/30">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-white">{upcomingWorkouts[0].name}</h3>
                      <p className="text-sm text-gray-400">
                        {upcomingWorkouts[0].exercises.length} exercises
                      </p>
                    </div>
                    <Button className="bg-emerald-500 hover:bg-emerald-600">
                      Start Workout
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {upcomingWorkouts[0].exercises.slice(0, 4).map((ex) => (
                      <Badge key={ex.id} variant="outline" className="border-emerald-500/50 text-emerald-400">
                        {ex.exercise.name}
                      </Badge>
                    ))}
                    {upcomingWorkouts[0].exercises.length > 4 && (
                      <Badge variant="outline" className="border-gray-700 text-gray-400">
                        +{upcomingWorkouts[0].exercises.length - 4} more
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-gray-900 border-gray-800">
                <CardContent className="py-8 text-center">
                  <Dumbbell className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400 mb-1">No workouts scheduled</p>
                  <p className="text-sm text-gray-500">
                    {myTrainer ? 'Your trainer will assign workouts soon' : 'Connect with a trainer to get started'}
                  </p>
                </CardContent>
              </Card>
            )}
          </section>

          {/* Upcoming Workouts */}
          {upcomingWorkouts.length > 1 && (
            <section>
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-400" />
                Upcoming Workouts
              </h2>
              <div className="space-y-3">
                {upcomingWorkouts.slice(1).map((workout) => (
                  <Card key={workout.id} className="bg-gray-900 border-gray-800">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium text-white">{workout.name}</h3>
                          <p className="text-sm text-gray-500">
                            {workout.scheduledDate 
                              ? format(new Date(workout.scheduledDate), 'EEEE, MMM d')
                              : 'Not scheduled'
                            }
                          </p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-500" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {/* Trainer Notes */}
          {myTrainer && (
            <section>
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-400" />
                Trainer Notes
              </h2>
              <Card className="bg-gray-900 border-gray-800">
                <CardContent className="py-8 text-center">
                  <p className="text-gray-400">No notes from your trainer yet</p>
                </CardContent>
              </Card>
            </section>
          )}

          {/* Find Trainers Section */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-rose-400" />
                Find Trainers
              </h2>
            </div>
            <Card className="bg-gray-900 border-gray-800">
              <CardContent className="py-8 text-center">
                <Search className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 mb-1">Browse available trainers</p>
                <p className="text-sm text-gray-500 mb-4">
                  Find the perfect trainer for your goals
                </p>
                <Dialog open={showFindTrainer} onOpenChange={setShowFindTrainer}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="border-gray-700">
                      <Search className="w-4 h-4 mr-2" />
                      Search Trainers
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-gray-900 border-gray-800 max-w-md">
                    <DialogHeader>
                      <DialogTitle className="text-white">Find a Trainer</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <Input
                        type="text"
                        placeholder="Search by name..."
                        value={trainerSearchQuery}
                        onChange={(e) => {
                          setTrainerSearchQuery(e.target.value);
                          setSelectedTrainer(null);
                        }}
                        className="bg-gray-800 border-gray-700 text-white"
                      />
                      
                      {isLoadingTrainers ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                          <span className="ml-2 text-gray-400">Loading trainers...</span>
                        </div>
                      ) : filteredTrainers.length === 0 ? (
                        <p className="text-center text-gray-500 py-4">
                          {availableTrainers.length === 0 ? 'No trainers found' : 'No matching trainers'}
                        </p>
                      ) : (
                        <ScrollArea className="h-48">
                          <div className="space-y-2">
                            {filteredTrainers.map((trainer: any) => (
                              <div
                                key={trainer.id}
                                onClick={() => setSelectedTrainer(trainer)}
                                className={`p-3 rounded-lg border cursor-pointer transition-colors flex items-center gap-3 ${
                                  selectedTrainer?.id === trainer.id
                                    ? 'border-rose-500 bg-rose-500/10'
                                    : 'border-gray-700 hover:border-gray-600 bg-gray-800'
                                }`}
                              >
                                <Avatar className="w-10 h-10">
                                  <AvatarFallback className="bg-rose-600 text-white">
                                    {trainer.displayName?.[0] || trainer.username?.[0]}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium text-white">{trainer.displayName || trainer.username}</p>
                                    {trainer.isVerifiedTrainer && <BadgeCheck className="w-4 h-4 text-blue-400" />}
                                  </div>
                                  <p className="text-sm text-gray-400">@{trainer.username}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      )}
                      
                      <Button 
                        onClick={handleConnectToTrainer}
                        className="w-full bg-rose-500 hover:bg-rose-600"
                        disabled={!selectedTrainer}
                      >
                        Connect with Trainer
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          </section>
        </div>
      </ScrollArea>
    </MainLayout>
  );
}
