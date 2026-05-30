'use client';

/**
 * v17-D4: shared "Create custom exercise" dialog used by every exercise
 * picker's empty-state CTA (active workout, program builder, day builder).
 *
 * Owns the name + category inputs and calls `createCustomExercise` —
 * never persists directly. On success it surfaces the new `Exercise` via
 * `onCreated` so the caller can auto-select it (consume the user's intent
 * from the empty state).
 */
import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import type { Exercise } from '@/types';
import {
  createCustomExercise,
  CUSTOM_EXERCISE_CATEGORIES,
  type CustomExerciseCategory,
} from '@/lib/customExercises';

export interface CreateCustomExerciseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-fill the name field — typically the search term the user just typed. */
  initialName?: string;
  /** Creator id. If absent, the dialog refuses to create. */
  userId: string | null | undefined;
  /** Fired after a successful create with the projected Exercise. */
  onCreated?: (exercise: Exercise) => void;
}

export function CreateCustomExerciseDialog({
  open,
  onOpenChange,
  initialName,
  userId,
  onCreated,
}: CreateCustomExerciseDialogProps) {
  const [name, setName] = useState(initialName || '');
  const [category, setCategory] = useState<CustomExerciseCategory | ''>('');
  const [submitting, setSubmitting] = useState(false);

  // Reset state whenever the dialog opens with a (potentially new) initialName.
  useEffect(() => {
    if (open) {
      setName(initialName || '');
      setCategory('');
      setSubmitting(false);
    }
  }, [open, initialName]);

  const canSubmit = name.trim().length > 0 && !!category && !!userId && !submitting;

  const handleCreate = async () => {
    if (!canSubmit || !userId || !category) return;
    setSubmitting(true);
    try {
      const exercise = await createCustomExercise({
        name: name.trim(),
        category: category as CustomExerciseCategory,
        userId,
      });
      if (!exercise) {
        toast.error('Could not create exercise');
        return;
      }
      toast.success(`"${exercise.name}" created`);
      onCreated?.(exercise);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Create exercise</DialogTitle>
          <DialogDescription>
            This exercise will be saved to your personal library.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="custom-exercise-name">Name</Label>
            <Input
              id="custom-exercise-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. High-cable woodchop"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as CustomExerciseCategory)}>
              <SelectTrigger>
                <SelectValue placeholder="Pick a category" />
              </SelectTrigger>
              <SelectContent>
                {CUSTOM_EXERCISE_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!canSubmit}>
            {submitting ? 'Creating…' : 'Create + use'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
