'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { useTrainerStore } from '@/lib/store';

interface RenameFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderName: string | null;
  existingFolders: string[];
  onRenamed: (oldName: string, newName: string) => void;
}

const MAX_LEN = 50;

export function RenameFolderDialog({ open, onOpenChange, folderName, existingFolders, onRenamed }: RenameFolderDialogProps) {
  const [name, setName] = useState('');
  const { renameBlockFolder } = useTrainerStore();

  useEffect(() => {
    if (open && folderName) setName(folderName);
    if (!open) setName('');
  }, [open, folderName]);

  if (!folderName) return null;

  const trimmed = name.trim();
  const isSame = trimmed.toLowerCase() === folderName.toLowerCase();
  const conflicts = !isSame && existingFolders.some(f => f.toLowerCase() === trimmed.toLowerCase());
  const tooLong = trimmed.length > MAX_LEN;
  const disabled = !trimmed || isSame || conflicts || tooLong;
  const error = conflicts ? 'A folder with that name already exists.' :
                 tooLong ? `Max ${MAX_LEN} characters.` :
                 null;

  const handleSave = async () => {
    if (disabled) return;
    const result = await renameBlockFolder(folderName, trimmed);
    if (result.ok) {
      toast.success(`Renamed "${folderName}" → "${trimmed}" (${result.count} block${result.count === 1 ? '' : 's'} updated).`);
      onRenamed(folderName, trimmed);
      onOpenChange(false);
    } else {
      toast.error('Failed to rename folder. Check console.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-900 border-gray-700 max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Pencil className="w-5 h-5 text-sky-400" /> Rename folder
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Renames every block currently in &quot;{folderName}&quot; to the new folder name.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-gray-300 text-sm">New name</Label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={MAX_LEN}
              className="mt-2 bg-gray-800 border-gray-700 text-white"
              onKeyDown={(e) => { if (e.key === 'Enter' && !disabled) handleSave(); }}
            />
            {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
          </div>
        </div>
        <div className="flex gap-2 mt-2">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="flex-1 bg-sky-500 hover:bg-sky-600" disabled={disabled} onClick={handleSave}>Rename</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
