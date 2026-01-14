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

export default function MyTrainerPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const { assignedWorkouts } = useTrainerStore();
  const [myTrainer, setMyTrainer] = useState<any>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/auth');
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (user?.trainerId) {
      const storedUsers = JSON.parse(localStorage.getItem('apex-users') || '[]');
      const trainer = storedUsers.find((u: any) => u.id === user.trainerId);
      setMyTrainer(trainer);
    }
  }, [user?.trainerId]);

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
                <Button className="bg-rose-500 hover:bg-rose-600">
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
              <Button variant="ghost" size="sm" className="text-gray-400">
                See All
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
            <Card className="bg-gray-900 border-gray-800">
              <CardContent className="py-8 text-center">
                <Search className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 mb-1">Browse available trainers</p>
                <p className="text-sm text-gray-500 mb-4">
                  Find the perfect trainer for your goals
                </p>
                <Button variant="outline" className="border-gray-700">
                  <Search className="w-4 h-4 mr-2" />
                  Search Trainers
                </Button>
              </CardContent>
            </Card>
          </section>
        </div>
      </ScrollArea>
    </MainLayout>
  );
}
