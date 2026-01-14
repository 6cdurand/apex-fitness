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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  ArrowLeftRight,
  Dumbbell,
  Target,
  Wrench,
} from 'lucide-react';
import { getSwapSuggestions, getDirectSwaps, EXERCISE_RELATIONS, type ExerciseRelation } from '@/lib/exerciseRelations';
import { cn } from '@/lib/utils';

interface ExerciseSwapModalProps {
  open: boolean;
  onClose: () => void;
  exerciseId: string;
  exerciseName: string;
  onSwap: (newExerciseId: string, newExerciseName: string, keepSets: boolean) => void;
}

export function ExerciseSwapModal({
  open,
  onClose,
  exerciseId,
  exerciseName,
  onSwap,
}: ExerciseSwapModalProps) {
  const [selectedExercise, setSelectedExercise] = useState<ExerciseRelation | null>(null);
  const [keepSets, setKeepSets] = useState(true);
  
  const directSwaps = getDirectSwaps(exerciseId);
  const suggestions = getSwapSuggestions(exerciseId);
  const currentExercise = EXERCISE_RELATIONS[exerciseId];

  const handleSwap = () => {
    if (selectedExercise) {
      onSwap(selectedExercise.id, selectedExercise.name, keepSets);
      onClose();
    }
  };

  const ExerciseCard = ({ exercise, isSelected }: { exercise: ExerciseRelation; isSelected: boolean }) => (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:border-primary',
        isSelected ? 'border-primary bg-primary/5' : ''
      )}
      onClick={() => setSelectedExercise(exercise)}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-medium">{exercise.name}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs">
                {exercise.movementPattern}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {exercise.equipment}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {exercise.primaryMuscles.join(', ')}
            </p>
          </div>
          {isSelected && (
            <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
              <span className="text-primary-foreground text-xs">✓</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5" />
            Swap Exercise
          </DialogTitle>
          <DialogDescription>
            Replace <span className="font-medium text-foreground">{exerciseName}</span> with a similar exercise
          </DialogDescription>
        </DialogHeader>

        {currentExercise && (
          <div className="mb-4 p-3 bg-muted rounded-lg">
            <p className="text-sm font-medium">Current Exercise</p>
            <p className="text-lg">{currentExercise.name}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline">{currentExercise.movementPattern}</Badge>
              <Badge variant="secondary">{currentExercise.equipment}</Badge>
              <span className="text-xs text-muted-foreground">
                {currentExercise.primaryMuscles.join(', ')}
              </span>
            </div>
          </div>
        )}

        <Tabs defaultValue="direct" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="direct" className="text-xs">
              Direct Swaps
            </TabsTrigger>
            <TabsTrigger value="movement" className="text-xs">
              <Dumbbell className="h-3 w-3 mr-1" />
              Movement
            </TabsTrigger>
            <TabsTrigger value="muscle" className="text-xs">
              <Target className="h-3 w-3 mr-1" />
              Muscle
            </TabsTrigger>
            <TabsTrigger value="equipment" className="text-xs">
              <Wrench className="h-3 w-3 mr-1" />
              Equipment
            </TabsTrigger>
          </TabsList>

          <TabsContent value="direct" className="mt-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground mb-3">
                Recommended alternatives for this exercise
              </p>
              {directSwaps.length > 0 ? (
                <div className="grid gap-2">
                  {directSwaps.map(ex => (
                    <ExerciseCard
                      key={ex.id}
                      exercise={ex}
                      isSelected={selectedExercise?.id === ex.id}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No direct swaps available for this exercise
                </p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="movement" className="mt-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground mb-3">
                Same movement pattern ({currentExercise?.movementPattern || 'N/A'})
              </p>
              {suggestions.similarMovement.length > 0 ? (
                <div className="grid gap-2">
                  {suggestions.similarMovement.map(ex => (
                    <ExerciseCard
                      key={ex.id}
                      exercise={ex}
                      isSelected={selectedExercise?.id === ex.id}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No similar movement exercises found
                </p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="muscle" className="mt-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground mb-3">
                Same primary muscles ({currentExercise?.primaryMuscles.join(', ') || 'N/A'})
              </p>
              {suggestions.sameMuscle.length > 0 ? (
                <div className="grid gap-2">
                  {suggestions.sameMuscle.map(ex => (
                    <ExerciseCard
                      key={ex.id}
                      exercise={ex}
                      isSelected={selectedExercise?.id === ex.id}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No same muscle exercises found
                </p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="equipment" className="mt-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground mb-3">
                Different equipment alternatives
              </p>
              {suggestions.equipmentAlternatives.length > 0 ? (
                <div className="grid gap-2">
                  {suggestions.equipmentAlternatives.map(ex => (
                    <ExerciseCard
                      key={ex.id}
                      exercise={ex}
                      isSelected={selectedExercise?.id === ex.id}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No equipment alternatives found
                </p>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {selectedExercise && (
          <div className="mt-4 pt-4 border-t space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="keepSets"
                checked={keepSets}
                onCheckedChange={(checked) => setKeepSets(checked as boolean)}
              />
              <Label htmlFor="keepSets" className="text-sm">
                Keep existing sets and weights
              </Label>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleSwap}>
                <ArrowLeftRight className="h-4 w-4 mr-2" />
                Swap to {selectedExercise.name}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
