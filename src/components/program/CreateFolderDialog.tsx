/**
 * v13-D3: Lightweight folder-creation dialog for the Block Library.
 *
 * Folders are stored as free-text on `saved_blocks.folder` — there is no
 * `block_folders` table. A folder "exists" the moment any saved block has
 * that string set. Selecting an existing folder name from another block
 * collapses into the same chip, so creation is just (optionally) moving
 * one block into the new name and surfacing the chip.
 *
 * If a future ask requires colors, ordering, or RLS-isolated folders, we
 * promote to a structured `block_folders` table at that point.
 */

'use client';

import React, { useEffect, useState } from 'react';
import { useTrainerStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FolderPlus } from 'lucide-react';
import { toast } from 'sonner';

interface CreateFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingFolders: string[];
  /** When set, the saved block with this id is moved into the new folder on save. */
  moveTargetBlockId: string | null;
  /** Called with the trimmed folder name after a successful create/move. */
  onCreated: (name: string) => void;
}

const MAX_LEN = 50;

export function CreateFolderDialog({
  open,
  onOpenChange,
  existingFolders,
  moveTargetBlockId,
  onCreated,
}: CreateFolderDialogProps) {
  const [name, setName] = useState('');

  // Reset the input whenever the dialog (re)opens so stale text from a
  // previous open never carries over.
  useEffect(() => {
    if (!open) setName('');
  }, [open]);

  const trimmed = name.trim();
  const exists = !!trimmed
    && existingFolders.some((f) => f.toLowerCase() === trimmed.toLowerCase());
  const tooLong = trimmed.length > MAX_LEN;
  const isDisabled = !trimmed || exists || tooLong;
  const error = exists
    ? 'Folder already exists. Pick another name or cancel.'
    : tooLong
      ? `Max ${MAX_LEN} characters.`
      : null;

  // v17-D3: both branches now route through the canonical
  // trainerStore.createBlockFolder action so the empty-folder case actually
  // persists. Previously the !moveTargetBlockId path only fired a toast,
  // which is why "+ New folder" from the Folders panel appeared to do
  // nothing on refresh (the chip was derived from saved_blocks.folder).
  const handleSave = async () => {
    if (isDisabled) return;
    const store = useTrainerStore.getState();

    if (moveTargetBlockId) {
      // Ensure the folder name is recorded in the canonical order array
      // (so future panels see it even after the block is moved out), then
      // assign it on the block. createBlockFolder is a no-op on duplicates,
      // which is the right behavior here when the user re-uses an existing
      // label (the dialog's existingFolders guard prevents that anyway).
      await store.createBlockFolder(trimmed);
      store.updateBlock(moveTargetBlockId, { folder: trimmed });
      toast.success(`Block moved to "${trimmed}"`);
    } else {
      const res = await store.createBlockFolder(trimmed);
      if (!res.ok) {
        if (res.reason === 'duplicate') {
          toast.error('Folder already exists.');
        } else if (res.reason === 'persist-failed') {
          toast.error('Could not create folder. Check your connection and try again.');
        } else {
          toast.error('Could not create folder.');
        }
        return;
      }
      toast.success(`Folder "${trimmed}" created`);
    }
    onCreated(trimmed);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-900 border-gray-700 max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <FolderPlus className="w-5 h-5 text-sky-400" />
            {moveTargetBlockId ? 'Move block to new folder' : 'Create folder'}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            {moveTargetBlockId
              ? 'Give the new folder a name. The block will be moved into it.'
              : 'Folders are free-text labels on saved blocks. Move blocks into the new folder via the folder icon on each block card.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-gray-300 text-sm">Folder name</Label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Push Day Templates"
              maxLength={MAX_LEN}
              className="mt-2 bg-gray-800 border-gray-700 text-white"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isDisabled) handleSave();
              }}
            />
            {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
          </div>
        </div>

        <div className="flex gap-2 mt-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 bg-sky-500 hover:bg-sky-600"
            disabled={isDisabled}
            onClick={handleSave}
          >
            {moveTargetBlockId ? 'Move' : 'Create'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
