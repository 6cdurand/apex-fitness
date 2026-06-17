'use client';

/**
 * /program/select — v14-D25
 *
 * Intermediate "what kind of program" picker that the /builder "Create
 * Program" card now routes through. The previous flow dumped the trainer
 * straight into an empty /program/builder, which made the built-in
 * programTemplates and trainer-saved savedPrograms invisible.
 *
 * Mode A (`choose`): two large cards — Start from Scratch vs Use a
 *   Template. Picking "Start from Scratch" pushes to /program/builder
 *   with no query params, identical to the old flow.
 * Mode B (`templates`): tabbed picker with System Templates (built-in
 *   programTemplates from src/lib/programTemplates.ts) and My Saved
 *   (trainerStore.savedPrograms). Picking either pushes to
 *   /program/builder?templateId=<id>; the builder's templateId branch
 *   (added in this same sprint) prefills name/goal/phase/days from
 *   whichever template was picked.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout, PageHeader } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuthStore, useTrainerStore } from '@/lib/store';
import { useRequireAuth } from '@/lib/hooks/useRequireAuth';
import { programTemplates } from '@/lib/programTemplates';
import {
  Plus,
  FileText,
  ChevronRight,
  Sparkles,
  BookmarkCheck,
  CalendarDays,
} from 'lucide-react';

export default function ProgramSelectPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const { savedPrograms } = useTrainerStore();
  const [mode, setMode] = useState<'choose' | 'templates'>('choose');
  const [tab, setTab] = useState<'system' | 'mine'>('system');

  const { hydrated } = useRequireAuth();

  useEffect(() => {
    if (hydrated && isAuthenticated && user?.mode !== 'trainer') {
      router.replace('/auth');
    }
  }, [hydrated, isAuthenticated, user?.mode, router]);

  if (!isAuthenticated || user?.mode !== 'trainer') {
    return null;
  }

  // ── Mode A: top-level chooser ─────────────────────────────────────
  if (mode === 'choose') {
    return (
      <MainLayout>
        <PageHeader
          title="Create Program"
          subtitle="Start fresh or use a template"
          showBack
        />
        <div className="px-4 py-4 space-y-3">
          <Card
            className="bg-gradient-to-r from-sky-500/20 to-blue-500/20 border-sky-500/30 cursor-pointer hover:border-sky-500/50 transition-all"
            onClick={() => router.push('/program/builder')}
          >
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-sky-500/30 flex items-center justify-center">
                  <Plus className="w-6 h-6 text-sky-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Start from Scratch</h3>
                  <p className="text-sm text-gray-500">
                    Build a program day-by-day from blank
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </CardContent>
          </Card>

          <Card
            className="bg-gradient-to-r from-purple-500/20 to-fuchsia-500/20 border-purple-500/30 cursor-pointer hover:border-purple-500/50 transition-all"
            onClick={() => setMode('templates')}
          >
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-purple-500/30 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Use a Template</h3>
                  <p className="text-sm text-gray-500">
                    Pick from system templates or your saved programs ({savedPrograms.length})
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  // ── Mode B: template picker ───────────────────────────────────────
  return (
    <MainLayout>
      <PageHeader
        title="Pick a Template"
        subtitle="System templates or your saved programs"
        showBack
        onBack={() => setMode('choose')}
      />
      <div className="px-4 py-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'system' | 'mine')}>
          <TabsList className="grid grid-cols-2 mb-4">
            <TabsTrigger value="system">
              <Sparkles className="w-4 h-4 mr-1.5" /> System Templates
            </TabsTrigger>
            <TabsTrigger value="mine">
              <BookmarkCheck className="w-4 h-4 mr-1.5" /> My Saved ({savedPrograms.length})
            </TabsTrigger>
          </TabsList>

          {/* SYSTEM TEMPLATES */}
          <TabsContent value="system" className="space-y-2">
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-2">
                {programTemplates.map((tpl) => {
                  const freq = tpl.frequencyOptions?.[0];
                  const phaseLabel = tpl.phases?.join(', ') ?? '—';
                  return (
                    <Card
                      key={tpl.id}
                      className="bg-white border-gray-200 shadow-sm cursor-pointer hover:border-sky-500/50 transition-colors"
                      onClick={() =>
                        router.push(`/program/builder?templateId=${tpl.id}`)
                      }
                    >
                      <CardContent className="p-3 flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-lg bg-sky-500/20 flex items-center justify-center flex-shrink-0">
                            <CalendarDays className="w-5 h-5 text-sky-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 text-sm truncate">
                              {tpl.name}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              {freq ? `${freq}×/wk` : '—'} • {phaseLabel}
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* MY SAVED PROGRAMS */}
          <TabsContent value="mine" className="space-y-2">
            {savedPrograms.length === 0 ? (
              <Card className="bg-white border-gray-200 shadow-sm">
                <CardContent className="py-10 text-center">
                  <BookmarkCheck className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No saved programs yet</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Save a program from the builder to reuse it
                  </p>
                </CardContent>
              </Card>
            ) : (
              <ScrollArea className="max-h-[60vh]">
                <div className="space-y-2">
                  {savedPrograms.map((prog: any) => (
                    <Card
                      key={prog.id}
                      className="bg-white border-gray-200 shadow-sm cursor-pointer hover:border-purple-500/50 transition-colors"
                      onClick={() =>
                        router.push(`/program/builder?templateId=${prog.id}`)
                      }
                    >
                      <CardContent className="p-3 flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                            <BookmarkCheck className="w-5 h-5 text-purple-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 text-sm truncate">
                              {prog.name}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              {prog.daysPerWeek ?? '?'}×/wk
                              {prog.durationWeeks ? ` • ${prog.durationWeeks} weeks` : ''}
                              {prog.phase ? ` • ${prog.phase}` : ''}
                            </p>
                          </div>
                        </div>
                        <Badge className="bg-purple-500/20 text-purple-400 text-[10px] flex-shrink-0">
                          Saved
                        </Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
