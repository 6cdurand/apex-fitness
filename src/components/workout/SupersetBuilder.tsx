'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Link2,
  Unlink,
  Plus,
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import type { WorkoutExercise, SupersetGroupType } from '@/types';
import { cn } from '@/lib/utils';

interface SupersetBuilderProps {
  open: boolean;
  onClose: () => void;
  exercise: { id: string; name: string };
  availableExercises: { id: string; name: string }[];
  onCreateSuperset: (
    exerciseIds: string[],
    groupType: SupersetGroupType,
    miniRestSeconds?: number
  ) => void;
}

export function SupersetBuilder({
  open,
  onClose,
  exercise,
  availableExercises,
  onCreateSuperset,
}: SupersetBuilderProps) {
  const [selectedExercises, setSelectedExercises] = useState<string[]>([]);
  const [groupType, setGroupType] = useState<SupersetGroupType>('superset');
  const [miniRest, setMiniRest] = useState<number>(0);

  const handleToggleExercise = (exerciseId: string) => {
    setSelectedExercises(prev =>
      prev.includes(exerciseId)
        ? prev.filter(id => id !== exerciseId)
        : [...prev, exerciseId]
    );
  };

  const handleCreate = () => {
    if (selectedExercises.length > 0) {
      onCreateSuperset(
        [exercise.id, ...selectedExercises],
        groupType,
        miniRest > 0 ? miniRest : undefined
      );
      onClose();
    }
  };

  // Determine group type based on selection count
  const getGroupTypeLabel = () => {
    const total = selectedExercises.length + 1;
    if (total === 2) return 'Superset';
    if (total === 3) return 'Triset';
    return 'Giant Set';
  };

  // Generate group labels (A1, A2, etc.)
  const getGroupLabel = (index: number) => {
    return `A${index + 1}`;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Create Superset
          </DialogTitle>
          <DialogDescription>
            Link exercises to perform back-to-back with minimal rest
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Primary exercise */}
          <div>
            <Label className="text-sm text-muted-foreground">Primary Exercise</Label>
            <Card className="mt-2 border-primary">
              <CardContent className="p-3 flex items-center gap-3">
                <Badge className="bg-primary">{getGroupLabel(0)}</Badge>
                <span className="font-medium">{exercise.name}</span>
              </CardContent>
            </Card>
          </div>

          {/* Select additional exercises */}
          <div>
            <Label className="text-sm text-muted-foreground">
              Select exercises to superset with
            </Label>
            <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
              {availableExercises
                .filter(ex => ex.id !== exercise.id)
                .map((ex, idx) => {
                  const isSelected = selectedExercises.includes(ex.id);
                  const selectionIndex = selectedExercises.indexOf(ex.id);
                  
                  return (
                    <Card
                      key={ex.id}
                      className={cn(
                        'cursor-pointer transition-all hover:border-primary',
                        isSelected ? 'border-primary bg-primary/5' : ''
                      )}
                      onClick={() => handleToggleExercise(ex.id)}
                    >
                      <CardContent className="p-3 flex items-center gap-3">
                        <Checkbox checked={isSelected} />
                        {isSelected && (
                          <Badge variant="secondary">
                            {getGroupLabel(selectionIndex + 1)}
                          </Badge>
                        )}
                        <span className={cn(isSelected && 'font-medium')}>
                          {ex.name}
                        </span>
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          </div>

          {/* Group type and mini-rest */}
          {selectedExercises.length > 0 && (
            <>
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Group Type:</span>
                  <Badge variant="outline" className="text-primary">
                    {getGroupTypeLabel()} ({selectedExercises.length + 1} exercises)
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Mini-rest between exercises (optional)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={miniRest || ''}
                    onChange={e => setMiniRest(parseInt(e.target.value) || 0)}
                    placeholder="0"
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">seconds</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Leave at 0 for no rest between exercises in the superset.
                  The main rest timer will trigger after completing all exercises in the group.
                </p>
              </div>
            </>
          )}

          {/* Preview */}
          {selectedExercises.length > 0 && (
            <div className="p-3 border rounded-lg space-y-1">
              <p className="text-sm font-medium mb-2">Preview:</p>
              <div className="flex items-center gap-2">
                <Badge className="bg-primary">{getGroupLabel(0)}</Badge>
                <span className="text-sm">{exercise.name}</span>
              </div>
              {selectedExercises.map((exId, idx) => {
                const ex = availableExercises.find(e => e.id === exId);
                return (
                  <div key={exId} className="flex items-center gap-2">
                    {miniRest > 0 && (
                      <span className="text-xs text-muted-foreground ml-4">↓ {miniRest}s rest</span>
                    )}
                    <Badge variant="secondary">{getGroupLabel(idx + 1)}</Badge>
                    <span className="text-sm">{ex?.name}</span>
                  </div>
                );
              })}
              <p className="text-xs text-muted-foreground mt-2 pt-2 border-t">
                → Main rest timer after completing group
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={selectedExercises.length === 0}
          >
            <Link2 className="h-4 w-4 mr-2" />
            Create {getGroupTypeLabel()}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Component to display a superset group
interface SupersetGroupDisplayProps {
  exercises: Array<{ id: string; name: string; groupOrder?: string }>;
  groupType: SupersetGroupType;
  onUngroup?: () => void;
}

export function SupersetGroupDisplay({ exercises, groupType, onUngroup }: SupersetGroupDisplayProps) {
  const getGroupTypeLabel = () => {
    switch (groupType) {
      case 'superset': return 'Superset';
      case 'triset': return 'Triset';
      case 'giant_set': return 'Giant Set';
    }
  };

  return (
    <div className="relative">
      {/* Vertical line connecting exercises */}
      <div className="absolute left-3 top-6 bottom-6 w-0.5 bg-primary/30" />
      
      {/* Group header */}
      <div className="flex items-center justify-between mb-2">
        <Badge variant="outline" className="text-primary border-primary">
          <Link2 className="h-3 w-3 mr-1" />
          {getGroupTypeLabel()}
        </Badge>
        {onUngroup && (
          <Button size="sm" variant="ghost" onClick={onUngroup}>
            <Unlink className="h-3 w-3 mr-1" />
            Ungroup
          </Button>
        )}
      </div>

      {/* Exercises */}
      <div className="space-y-1 pl-6">
        {exercises.map((ex, idx) => (
          <div key={ex.id} className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {ex.groupOrder || `A${idx + 1}`}
            </Badge>
            <span className="text-sm">{ex.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
