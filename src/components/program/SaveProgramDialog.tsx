'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Save } from 'lucide-react';

interface SaveProgramDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultName: string;
  programData: {
    days: any[];
    daysPerWeek: number;
    durationWeeks: number;
    phase?: string;
    goals?: string[];
    structure?: string;
    autoRepeat?: boolean;
  };
  onSave: (name: string, description: string) => Promise<void>;
}

export function SaveProgramDialog({
  open,
  onOpenChange,
  defaultName,
  programData,
  onSave,
}: SaveProgramDialogProps) {
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Please enter a program name');
      return;
    }
    setSaving(true);
    try {
      await onSave(name.trim(), description.trim());
      toast.success('Program saved to My Templates');
      onOpenChange(false);
      setName(defaultName);
      setDescription('');
    } catch (err) {
      console.error('[SaveProgramDialog] Save failed:', err);
      toast.error('Failed to save program');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Save as Template</DialogTitle>
          <DialogDescription>
            Save this program to your library for quick assignment to other clients.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="program-name">Program Name</Label>
            <Input
              id="program-name"
              placeholder="e.g., Upper Lower Split"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="program-description">Description (optional)</Label>
            <Textarea
              id="program-description"
              placeholder="Brief description of this program..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            <div>• {programData.daysPerWeek} days/week</div>
            <div>• {programData.durationWeeks} weeks</div>
            <div>• {programData.days.length} workout days configured</div>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? (
              <>Saving...</>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Template
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
