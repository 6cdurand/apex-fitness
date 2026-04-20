import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Unit tests for the role normaliser. Drift = mode and is_trainer disagree.
 * Canonical field is is_trainer; mode is presentation-only.
 */

type Row = { id: string; is_trainer: boolean; mode: string | null };

function makeMockAdmin(initialUsers: Row[]) {
  const users = [...initialUsers];
  const events: any[] = [];
  return {
    _users: users,
    _events: events,
    from(name: string) {
      if (name === 'users') {
        const api: any = {
          _filter: {} as any,
          select: () => api,
          eq: (col: string, val: any) => { api._filter[col] = val; return api; },
          maybeSingle: () => {
            const row = users.find((r) => r.id === api._filter.id) ?? null;
            api._filter = {};
            return Promise.resolve({ data: row, error: null });
          },
          update: (patch: any) => ({
            eq: (col: string, val: any) => {
              const row = users.find((r) => (r as any)[col] === val);
              if (row) Object.assign(row, patch);
              return Promise.resolve({ error: null });
            },
          }),
        };
        return api;
      }
      if (name === 'identity_events') {
        return {
          insert: (row: any) => {
            events.push(row);
            return Promise.resolve({ error: null });
          },
        };
      }
      throw new Error(`unexpected table ${name}`);
    },
  };
}

let mock: ReturnType<typeof makeMockAdmin>;

vi.mock('../../supabaseAdmin', () => ({
  getSupabaseAdmin: () => mock,
}));

import { normaliseRole } from '../roleNormalisation';

describe('roleNormalisation', () => {
  beforeEach(() => {
    mock = makeMockAdmin([]);
  });

  it('returns null when user id is unknown', async () => {
    const r = await normaliseRole('missing-id');
    expect(r).toBeNull();
  });

  it('reports no change when is_trainer and mode agree', async () => {
    mock = makeMockAdmin([{ id: 'u1', is_trainer: true, mode: 'trainer' }]);
    const r = await normaliseRole('u1');
    expect(r?.changed).toBe(false);
    expect(r?.isTrainer).toBe(true);
    expect(mock._events).toHaveLength(0);
  });

  it('promotes is_trainer when mode=trainer but flag=false, and logs drift', async () => {
    mock = makeMockAdmin([{ id: 'u1', is_trainer: false, mode: 'trainer' }]);
    const r = await normaliseRole('u1');
    expect(r?.changed).toBe(true);
    expect(r?.isTrainer).toBe(true);
    expect(r?.reason).toBe('mode_trainer_but_flag_false');
    expect(mock._events).toHaveLength(1);
    expect(mock._events[0].event_type).toBe('role_drift_detected');
  });

  it('does NOT demote a trainer flagged account whose mode is user', async () => {
    mock = makeMockAdmin([{ id: 'u1', is_trainer: true, mode: 'user' }]);
    const r = await normaliseRole('u1');
    expect(r?.changed).toBe(false);
    expect(r?.isTrainer).toBe(true);
    expect(mock._events).toHaveLength(0);
  });

  it('handles null mode as a no-op', async () => {
    mock = makeMockAdmin([{ id: 'u1', is_trainer: false, mode: null }]);
    const r = await normaliseRole('u1');
    expect(r?.changed).toBe(false);
    expect(r?.isTrainer).toBe(false);
  });
});
