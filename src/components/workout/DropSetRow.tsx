'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, ChevronDown } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import type { DropSet } from '@/types';
import { cn } from '@/lib/utils';

interface DropSetRowProps {
  drops: DropSet[];
  onUpdate: (drops: DropSet[]) => void;
  weightUnit?: 'kg' | 'lb';
  disabled?: boolean;
}

export function DropSetRow({ drops, onUpdate, weightUnit = 'kg', disabled = false }: DropSetRowProps) {
  const [isExpanded, setIsExpanded] = useState(drops.length > 0);

  const addDrop = () => {
    const lastDrop = drops[drops.length - 1];
    const newDrop: DropSet = {
      id: uuidv4(),
      weight: lastDrop ? Math.round(lastDrop.weight * 0.8) : 0,
      reps: lastDrop ? lastDrop.reps : 0,
    };
    onUpdate([...drops, newDrop]);
    setIsExpanded(true);
  };

  const updateDrop = (id: string, updates: Partial<DropSet>) => {
    onUpdate(drops.map(d => d.id === id ? { ...d, ...updates } : d));
  };

  const removeDrop = (id: string) => {
    onUpdate(drops.filter(d => d.id !== id));
  };

  if (!isExpanded && drops.length === 0) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="text-xs text-muted-foreground hover:text-primary"
        onClick={addDrop}
        disabled={disabled}
      >
        <Plus className="h-3 w-3 mr-1" />
        + Drop Set
      </Button>
    );
  }

  return (
    <div className="space-y-1 pl-4 border-l-2 border-orange-500/30 ml-2">
      {drops.map((drop, idx) => (
        <div
          key={drop.id}
          className={cn(
            'flex items-center gap-2 py-1 px-2 rounded text-sm',
            'bg-orange-500/10' // Shaded row for drop sets
          )}
        >
          <Badge variant="outline" className="text-xs bg-orange-500/20 border-orange-500/30">
            Drop {idx + 1}
          </Badge>
          
          <div className="flex items-center gap-1">
            <Input
              type="number"
              value={drop.weight || ''}
              onChange={e => updateDrop(drop.id, { weight: parseFloat(e.target.value) || 0 })}
              className="w-16 h-7 text-sm bg-background"
              placeholder="0"
              disabled={disabled}
            />
            <span className="text-xs text-muted-foreground">{weightUnit}</span>
          </div>
          
          <span className="text-muted-foreground">×</span>
          
          <div className="flex items-center gap-1">
            <Input
              type="number"
              value={drop.reps || ''}
              onChange={e => updateDrop(drop.id, { reps: parseInt(e.target.value) || 0 })}
              className="w-14 h-7 text-sm bg-background"
              placeholder="0"
              disabled={disabled}
            />
            <span className="text-xs text-muted-foreground">reps</span>
          </div>
          
          <div className="flex items-center gap-1">
            <Input
              type="number"
              value={drop.rpe || ''}
              onChange={e => updateDrop(drop.id, { rpe: parseInt(e.target.value) || undefined })}
              className="w-12 h-7 text-sm bg-background"
              placeholder="RPE"
              min={1}
              max={10}
              disabled={disabled}
            />
          </div>
          
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={() => removeDrop(drop.id)}
            disabled={disabled}
          >
            <Trash2 className="h-3 w-3 text-destructive" />
          </Button>
        </div>
      ))}
      
      <Button
        variant="ghost"
        size="sm"
        className="text-xs text-muted-foreground hover:text-orange-500"
        onClick={addDrop}
        disabled={disabled}
      >
        <Plus className="h-3 w-3 mr-1" />
        Add Drop
      </Button>
    </div>
  );
}
