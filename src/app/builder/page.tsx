'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, useTrainerStore } from '@/lib/store';
import { MainLayout, PageHeader } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Plus, 
  Dumbbell, 
  ChevronRight,
  FileText,
  Layers,
  Zap,
  CalendarDays,
  Users,
  Trash2,
} from 'lucide-react';
import { getClientDisplayInfo } from '@/lib/clientUtils';
import { toast } from 'sonner';

export default function BuilderPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const { workoutLibrary, savedBlocks, circuitLibrary, clients, clientPrograms, deleteClientProgram } = useTrainerStore();
  const [programToDelete, setProgramToDelete] = useState<{ id: string; name: string; clientName: string } | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/auth');
    } else if (user?.mode !== 'trainer') {
      router.replace('/program');
    }
  }, [isAuthenticated, user?.mode, router]);

  if (!isAuthenticated || user?.mode !== 'trainer') return null;

  return (
    <MainLayout>
      <PageHeader title="Builder" subtitle="Create workouts & blocks" />

      <div className="px-4 py-4 space-y-5">
        {/* Create Actions */}
        <div className="space-y-3">
          <Card
            className="bg-gradient-to-r from-sky-500/20 to-blue-500/20 border-sky-500/30 cursor-pointer hover:border-sky-500/50 transition-all"
            onClick={() => router.push('/workout/builder?mode=create')}
          >
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-sky-500/30 flex items-center justify-center">
                  <Plus className="w-6 h-6 text-sky-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Build New Workout</h3>
                  <p className="text-sm text-gray-500">Create with blocks, exercises & circuits</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </CardContent>
          </Card>

          {/* v14-D25: Create Program now routes through /program/select so the
              trainer can pick "Start from Scratch" or "Use a Template"
              (system templates + saved programs). Previously this dropped
              straight into an empty /program/builder which left saved
              programs with no visible home. */}
          <Card
            className="bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border-emerald-500/30 cursor-pointer hover:border-emerald-500/50 transition-all"
            onClick={() => router.push('/program/select')}
          >
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-emerald-500/30 flex items-center justify-center">
                  <CalendarDays className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Create Program</h3>
                  <p className="text-sm text-gray-500">Multi-day plan — start fresh or use a template</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </CardContent>
          </Card>
        </div>

        {/* Active Client Programs */}
        {clientPrograms.filter(p => p.status === 'active').length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-400 flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-emerald-400" />
                Active Programs
              </h2>
              <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-400 text-xs">
                {clientPrograms.filter(p => p.status === 'active').length}
              </Badge>
            </div>
            <div className="space-y-2">
              {clientPrograms.filter(p => p.status === 'active').map((program) => {
                const clientInfo = getClientDisplayInfo(program.clientId);
                return (
                  <Card
                    key={program.id}
                    className="bg-white border-gray-200 shadow-sm cursor-pointer hover:border-emerald-500/30 transition-colors"
                    onClick={() => router.push(`/clients/${program.clientId}?tab=program`)}
                  >
                    <CardContent className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                          <Users className="w-4 h-4 text-emerald-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 text-sm truncate">{program.templateName}</p>
                          <p className="text-xs text-gray-500 truncate">
                            {clientInfo?.displayName || 'Client'} • {program.weeklyPlan?.length || 0} days/week • {program.phase}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <Badge className="bg-emerald-500/20 text-emerald-400 text-xs">Active</Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-gray-400 hover:text-red-500 hover:bg-red-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            setProgramToDelete({
                              id: program.id,
                              name: program.templateName,
                              clientName: clientInfo?.displayName || 'Client',
                            });
                          }}
                          aria-label="Delete program"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        {/* Workout Library */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-400 flex items-center gap-2">
              <Dumbbell className="w-4 h-4" />
              Workout Library
            </h2>
            <Badge variant="secondary" className="bg-sky-500/20 text-sky-400 text-xs">
              {workoutLibrary.length}
            </Badge>
          </div>

          {workoutLibrary.length === 0 ? (
            <Card className="bg-white border-gray-200 shadow-sm">
              <CardContent className="py-8 text-center">
                <Dumbbell className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No saved workouts yet</p>
                <p className="text-xs text-gray-400 mt-1">Build a workout and save it to your library</p>
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="max-h-[300px]">
              <div className="space-y-2">
                {workoutLibrary.map((workout) => (
                  <Card
                    key={workout.id}
                    className="bg-white border-gray-200 shadow-sm cursor-pointer hover:border-gray-300 transition-colors"
                    onClick={() => router.push(`/workout/builder?workoutId=${workout.id}`)}
                  >
                    <CardContent className="p-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{workout.name}</p>
                        <p className="text-xs text-gray-500">
                          {workout.blocks?.length || 0} blocks
                          {workout.estimatedMinutes ? ` • ~${workout.estimatedMinutes} min` : ''}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-600" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </section>

        {/* Block Library */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-400 flex items-center gap-2">
              <Layers className="w-4 h-4" />
              Saved Blocks
            </h2>
            <Badge variant="secondary" className="bg-purple-500/20 text-purple-400 text-xs">
              {savedBlocks.length}
            </Badge>
          </div>

          {savedBlocks.length === 0 ? (
            <Card className="bg-white border-gray-200 shadow-sm">
              <CardContent className="py-6 text-center">
                <Layers className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No saved blocks</p>
                <p className="text-xs text-gray-400 mt-1">Save blocks from the workout builder</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {savedBlocks.slice(0, 5).map((block) => (
                <Card key={block.id} className="bg-white border-gray-200 shadow-sm">
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        block.type === 'circuit' ? 'bg-purple-500/20' :
                        block.type === 'warmup' ? 'bg-orange-500/20' :
                        block.type === 'cardio' ? 'bg-red-500/20' :
                        'bg-blue-500/20'
                      }`}>
                        <Dumbbell className={`w-4 h-4 ${
                          block.type === 'circuit' ? 'text-purple-400' :
                          block.type === 'warmup' ? 'text-orange-400' :
                          block.type === 'cardio' ? 'text-red-400' :
                          'text-blue-400'
                        }`} />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{block.name}</p>
                        <p className="text-xs text-gray-500 capitalize">{block.type} • {block.exercises?.length || 0} exercises</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {savedBlocks.length > 5 && (
                <p className="text-xs text-gray-500 text-center">+{savedBlocks.length - 5} more blocks</p>
              )}
            </div>
          )}
        </section>

        {/* Circuit Library */}
        {circuitLibrary.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-400 flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Circuit Templates
              </h2>
              <Badge variant="secondary" className="bg-orange-500/20 text-orange-400 text-xs">
                {circuitLibrary.length}
              </Badge>
            </div>
            <div className="space-y-2">
              {circuitLibrary.slice(0, 5).map((circuit) => (
                <Card key={circuit.id} className="bg-white border-gray-200 shadow-sm">
                  <CardContent className="p-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{circuit.name}</p>
                      <p className="text-xs text-gray-500 capitalize">
                        {circuit.circuitStyle} • {circuit.exercises?.length || 0} exercises
                        {circuit.rounds ? ` • ${circuit.rounds} rounds` : ''}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Delete program confirmation */}
      <AlertDialog open={!!programToDelete} onOpenChange={(open) => { if (!open) setProgramToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete program?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove <span className="font-semibold">{programToDelete?.name}</span> from {programToDelete?.clientName}'s app — they'll no longer see it in their program tab, Today page, or calendar.
              <br /><br />
              Past workouts already completed stay in their history. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600 text-white"
              onClick={() => {
                if (programToDelete) {
                  deleteClientProgram(programToDelete.id);
                  toast.success(`Deleted ${programToDelete.name}`);
                  setProgramToDelete(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
