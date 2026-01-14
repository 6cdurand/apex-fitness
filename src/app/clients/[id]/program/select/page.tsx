'use client';

import { useState, useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { useTrainerStore } from '@/lib/store';
import { programTemplates, goalToPhaseRecommendation } from '@/lib/programTemplates';
import { 
  PHASE_CONFIGS, 
  GOAL_CONFIGS,
  getRecommendedTemplates,
  getInjuryWarnings,
  PGIFTemplate,
  getAllPTTemplates,
} from '@/lib/pgifTemplates';
import { TrainingPhase, TrainingGoal, ProgramTemplate, InjuryFlag } from '@/types';
import { 
  ArrowLeft, 
  Check, 
  Filter, 
  Dumbbell, 
  Calendar,
  Target,
  AlertTriangle,
  X,
  ChevronRight,
  Star,
  Clock
} from 'lucide-react';

const PHASES: { value: TrainingPhase | 'all'; label: string; color: string }[] = [
  { value: 'all', label: 'All Phases', color: 'gray' },
  { value: 'foundation', label: '🟢 Foundation / Base', color: 'emerald' },
  { value: 'strength', label: '🔵 Strength', color: 'blue' },
  { value: 'performance', label: '🟣 Performance', color: 'purple' },
  { value: 'return', label: '🟠 Return / Rehab', color: 'orange' },
];

const GOALS: { value: TrainingGoal | 'all'; label: string }[] = [
  { value: 'all', label: 'All Goals' },
  { value: 'fat_loss', label: 'Fat Loss' },
  { value: 'hypertrophy', label: 'Build Muscle' },
  { value: 'strength', label: 'Get Stronger' },
  { value: 'conditioning', label: 'Conditioning' },
  { value: 'mobility', label: 'Mobility' },
  { value: 'general', label: 'General Fitness' },
];

const FREQUENCIES = [
  { value: 0, label: 'Any Frequency' },
  { value: 1, label: '1 day/week' },
  { value: 2, label: '2 days/week' },
  { value: 3, label: '3 days/week' },
  { value: 4, label: '4 days/week' },
  { value: 5, label: '5 days/week' },
  { value: 6, label: '6 days/week' },
];

const STRUCTURES: { value: string; label: string }[] = [
  { value: 'all', label: 'All Structures' },
  { value: 'full_body', label: 'Full Body' },
  { value: 'upper_lower', label: 'Upper/Lower' },
  { value: 'push_pull_legs', label: 'Push/Pull/Legs' },
  { value: 'split', label: 'Body Part Split' },
  { value: 'circuit', label: 'Circuit' },
];

export default function TemplateSelectionPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.id as string;
  
  const { clients, getClientProfile } = useTrainerStore();
  const client = clients.find(c => c.clientId === clientId);
  const clientProfile = getClientProfile(clientId);
  
  const [phaseFilter, setPhaseFilter] = useState<TrainingPhase | 'all'>('all');
  const [goalFilter, setGoalFilter] = useState<TrainingGoal | 'all'>('all');
  const [frequencyFilter, setFrequencyFilter] = useState<number>(0);
  const [structureFilter, setStructureFilter] = useState<string>('all');
  const [classSafeOnly, setClassSafeOnly] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ProgramTemplate | null>(null);
  const [filtersInitialized, setFiltersInitialized] = useState(false);

  // Auto-fill filters from client profile on mount
  useEffect(() => {
    if (clientProfile && !filtersInitialized) {
      setPhaseFilter(clientProfile.currentPhase || 'all');
      setGoalFilter(clientProfile.primaryGoal || 'all');
      setFrequencyFilter(clientProfile.daysPerWeek || 0);
      setFiltersInitialized(true);
    }
  }, [clientProfile, filtersInitialized]);

  // Auto-suggest based on client profile or goals
  const suggestedPhase = useMemo(() => {
    if (clientProfile?.currentPhase) {
      return clientProfile.currentPhase;
    }
    if (client?.goals?.[0]) {
      const recommended = goalToPhaseRecommendation[client.goals[0]];
      return recommended?.[0] || 'foundation';
    }
    return 'foundation';
  }, [clientProfile?.currentPhase, client?.goals]);

  // Filter templates
  const filteredTemplates = useMemo(() => {
    return programTemplates.filter(template => {
      if (phaseFilter !== 'all' && !template.phases.includes(phaseFilter)) return false;
      if (goalFilter !== 'all' && !template.goals.includes(goalFilter)) return false;
      if (frequencyFilter > 0 && !template.frequencyOptions.includes(frequencyFilter)) return false;
      if (structureFilter !== 'all' && template.structure !== structureFilter) return false;
      if (classSafeOnly && !template.classSafe) return false;
      return true;
    });
  }, [phaseFilter, goalFilter, frequencyFilter, structureFilter, classSafeOnly]);

  // Count active filters
  const activeFilterCount = [
    phaseFilter !== 'all',
    goalFilter !== 'all',
    frequencyFilter > 0,
    structureFilter !== 'all',
    classSafeOnly,
  ].filter(Boolean).length;

  const clearFilters = () => {
    setPhaseFilter('all');
    setGoalFilter('all');
    setFrequencyFilter(0);
    setStructureFilter('all');
    setClassSafeOnly(false);
  };

  const handleSelectTemplate = (template: ProgramTemplate) => {
    setSelectedTemplate(template);
  };

  const handleContinue = () => {
    if (selectedTemplate) {
      router.push(`/clients/${clientId}/program/preview?templateId=${selectedTemplate.id}`);
    }
  };

  if (!client) {
    return (
      <div className="container mx-auto p-6">
        <p>Client not found</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <h1 className="text-2xl font-bold">Select Program Template</h1>
        <p className="text-muted-foreground">
          Choose a starting template for {client.client?.displayName || 'this client'}
        </p>
      </div>

      {/* Client Context */}
      {client.goals && client.goals.length > 0 && (
        <Card className="mb-4 bg-muted/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Goals:</span>
                {client.goals.map(goal => (
                  <Badge key={goal} variant="secondary">{goal}</Badge>
                ))}
              </div>
              {client.injuryHistory && (
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm text-muted-foreground">{client.injuryHistory}</span>
                </div>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Suggested starting phase: <Badge>{suggestedPhase}</Badge>
            </p>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="h-4 w-4" /> Filters
              {activeFilterCount > 0 && (
                <Badge variant="secondary">{activeFilterCount}</Badge>
              )}
            </CardTitle>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" /> Clear
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Phase</label>
              <Select value={phaseFilter} onValueChange={(v) => setPhaseFilter(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PHASES.map(phase => (
                    <SelectItem key={phase.value} value={phase.value}>
                      {phase.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-1 block">Goal</label>
              <Select value={goalFilter} onValueChange={(v) => setGoalFilter(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GOALS.map(goal => (
                    <SelectItem key={goal.value} value={goal.value}>
                      {goal.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-1 block">Frequency</label>
              <Select 
                value={String(frequencyFilter)} 
                onValueChange={(v) => setFrequencyFilter(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCIES.map(freq => (
                    <SelectItem key={freq.value} value={String(freq.value)}>
                      {freq.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-1 block">Structure</label>
              <Select value={structureFilter} onValueChange={setStructureFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STRUCTURES.map(struct => (
                    <SelectItem key={struct.value} value={struct.value}>
                      {struct.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="mt-3 flex items-center gap-2">
            <Button
              variant={classSafeOnly ? 'default' : 'outline'}
              size="sm"
              onClick={() => setClassSafeOnly(!classSafeOnly)}
            >
              {classSafeOnly && <Check className="h-3 w-3 mr-1" />}
              Class Safe Only
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Template List */}
      <div className="grid gap-3">
        <p className="text-sm text-muted-foreground">
          {filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''} found
        </p>
        
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-3">
            {filteredTemplates.map(template => (
              <Card 
                key={template.id}
                className={`cursor-pointer transition-all ${
                  selectedTemplate?.id === template.id 
                    ? 'border-primary ring-2 ring-primary/20' 
                    : 'hover:border-primary/50'
                }`}
                onClick={() => handleSelectTemplate(template)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{template.name}</h3>
                        {selectedTemplate?.id === template.id && (
                          <Check className="h-4 w-4 text-primary" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {template.description}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {template.phases.map(phase => (
                          <Badge key={phase} variant="outline" className="text-xs">
                            {phase}
                          </Badge>
                        ))}
                        {template.goals.slice(0, 3).map(goal => (
                          <Badge key={goal} variant="secondary" className="text-xs">
                            {goal.replace('_', ' ')}
                          </Badge>
                        ))}
                        {template.classSafe && (
                          <Badge variant="default" className="text-xs bg-green-600">
                            Class Safe
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {template.frequencyOptions.join('-')}x/week
                      </div>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                        <Dumbbell className="h-3 w-3" />
                        {template.days.length} day{template.days.length !== 1 ? 's' : ''}
                      </div>
                      <Badge variant="outline" className="mt-2 text-xs">
                        {template.structure.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {filteredTemplates.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <p>No templates match your filters</p>
                <Button variant="link" onClick={clearFilters}>Clear filters</Button>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4">
        <div className="container mx-auto max-w-4xl flex items-center justify-between">
          <div>
            {selectedTemplate && (
              <p className="text-sm">
                Selected: <strong>{selectedTemplate.name}</strong>
              </p>
            )}
          </div>
          <Button 
            onClick={handleContinue} 
            disabled={!selectedTemplate}
            size="lg"
          >
            Continue to Preview <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
      
      {/* Bottom padding for fixed action bar */}
      <div className="h-20" />
    </div>
  );
}
