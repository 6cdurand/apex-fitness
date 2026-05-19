/**
 * v12-D3 / v13-D1 / v14-D1 + v14-D10: Edit a client's historical_sessions_offset.
 *
 * Semantics (HYBRID model — effective auto resolved via getEffectiveAutoCount):
 * - Effective auto ON (per-client override TRUE, OR per-client NULL + trainer default ON):
 *   editing offset shifts total_sessions by (new_offset - old_offset). v13-D1 + v14-D10 BEFORE
 *   trigger applies the rebucket; UI optimistic-updates total to match.
 * - Effective auto OFF (per-client override FALSE, OR per-client NULL + trainer default OFF):
 *   total_sessions = offset directly. Editing offset sets total to the same value.
 * "Effective" = resolve via getEffectiveAutoCount(perClient, trainerDefault) from trainerStore.
 */

'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { History } from 'lucide-react';

interface EditHistoricalOffsetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Current offset value (pre-Catalift sessions). */
  currentOffset: number;
  /** Sessions logged inside Catalift (for breakdown display). */
  loggedSessions: number;
  /** Called with the new offset on Save. Should call updateClient + Supabase sync. */
  onSave: (newOffset: number) => void | Promise<void>;
  /** Optional client display name for the modal heading. */
  clientName?: string;
}

export function EditHistoricalOffsetModal({
  open,
  onOpenChange,
  currentOffset,
  loggedSessions,
  onSave,
  clientName,
}: EditHistoricalOffsetModalProps) {
  const [draft, setDraft] = useState<string>(String(currentOffset || 0));
  const [saving, setSaving] = useState(false);

  // Reset the draft whenever the modal re-opens or the upstream value changes.
  useEffect(() => {
    if (open) {
      setDraft(String(currentOffset || 0));
    }
  }, [open, currentOffset]);

  const parsed = parseInt(draft, 10);
  const isValid = Number.isFinite(parsed) && parsed >= 0;
  const newLifetime = (isValid ? parsed : 0) + loggedSessions;

  const handleSave = async () => {
    if (!isValid) return;
    setSaving(true);
    try {
      await onSave(parsed);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-sky-500" />
            Edit historical sessions
            {clientName ? (
              <span className="text-sm font-normal text-gray-500">— {clientName}</span>
            ) : null}
          </DialogTitle>
          <DialogDescription>
            Sessions you completed with this client <strong>before Catalift</strong>{' '}
            (or off-app). This number is summed with the sessions logged in Catalift
            to give the lifetime total.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="historical-offset">Pre-Catalift sessions</Label>
            <Input
              id="historical-offset"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              autoFocus
            />
            {!isValid ? (
              <p className="text-xs text-red-500">Enter a non-negative whole number.</p>
            ) : null}
          </div>

          <div className="rounded-md bg-gray-50 dark:bg-gray-900/50 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Pre-Catalift</span>
              <span className="font-medium">{isValid ? parsed : 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Logged in Catalift</span>
              <span className="font-medium">{loggedSessions}</span>
            </div>
            <div className="flex justify-between border-t border-gray-200 dark:border-gray-700 mt-2 pt-2">
              <span className="text-gray-700 dark:text-gray-300 font-medium">New lifetime total</span>
              <span className="font-bold text-sky-500">{newLifetime}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!isValid || saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
