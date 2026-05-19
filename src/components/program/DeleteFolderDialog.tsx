'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTrainerStore } from '@/lib/store';

interface DeleteFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderName: string | null;
  existingFolders: string[];
  blockCount: number; // number of saved blocks currently in this folder
  onDeleted: (name: string) => void;
}

export function DeleteFolderDialog({ open, onOpenChange, folderName, existingFolders, blockCount, onDeleted }: DeleteFolderDialogProps) {
  // Special sentinel for "unfile" (folder set to NULL)
  const UNFILE = '__unfile__';
  const [target, setTarget] = useState<string>(UNFILE);
  const { deleteBlockFolder } = useTrainerStore();

  useEffect(() => {
    if (!open) setTarget(UNFILE);
  }, [open]);

  if (!folderName) return null;

  const handleConfirm = async () => {
    const dest = target === UNFILE ? null : target;
    const result = await deleteBlockFolder(folderName, dest);
    if (result.ok) {
      toast.success(
        dest
          ? `Deleted "${folderName}". ${result.count} block${result.count === 1 ? '' : 's'} moved to "${dest}".`
          : `Deleted "${folderName}". ${result.count} block${result.count === 1 ? '' : 's'} unfiled.`,
        { duration: 4000 }
      );
      onDeleted(folderName);
      onOpenChange(false);
    } else {
      toast.error('Failed to delete folder. Check console.');
    }
  };

  const otherFolders = existingFolders.filter(f => f !== folderName);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-900 border-gray-700 max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-red-400" /> Delete folder
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            {blockCount > 0
              ? `"${folderName}" has ${blockCount} block${blockCount === 1 ? '' : 's'}. Choose where to move them.`
              : `"${folderName}" is empty. It will be removed from the chip list.`}
          </DialogDescription>
        </DialogHeader>
        {blockCount > 0 && (
          <div className="space-y-3">
            <div>
              <Label className="text-gray-300 text-sm">Move blocks to</Label>
              <Select value={target} onValueChange={setTarget}>
                <SelectTrigger className="mt-2 bg-gray-800 border-gray-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNFILE}>Unfiled (no folder)</SelectItem>
                  {otherFolders.map(f => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
        <div className="flex gap-2 mt-2">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="flex-1 bg-red-500 hover:bg-red-600" onClick={handleConfirm}>Delete</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
