import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Unit tests for the invite/claim service.
 *
 * Strategy: mock `getSupabaseAdmin` with an in-memory stub so we can assert
 * the call sequence and the service's branching logic without a real
 * Supabase instance. These are behaviour tests, not coverage-for-coverage.
 */

// Simple fluent builder mimicking the Supabase JS query chain for the few
// tables the service touches. Each call records what it received so tests
// can assert on it.
type MockTable = ReturnType<typeof createMockTable>;

function createMockTable(initial: { rows?: any[]; upsertError?: string; insertError?: string } = {}) {
  const rows = [...(initial.rows ?? [])];
  const ops: Array<{ op: string; payload: any; opts?: any }> = [];
  const api: any = {
    _rows: rows,
    _ops: ops,
    _lastFilter: {} as Record<string, any>,
    select() { return api; },
    eq(col: string, val: any) { api._lastFilter[col] = val; return api; },
    maybeSingle() {
      const match = rows.find((r) => {
        return Object.entries(api._lastFilter).every(([k, v]) => r[k] === v);
      });
      api._lastFilter = {};
      return Promise.resolve({ data: match ?? null, error: null });
    },
    single() {
      const match = rows.find((r) => {
        return Object.entries(api._lastFilter).every(([k, v]) => r[k] === v);
      });
      api._lastFilter = {};
      return Promise.resolve({ data: match ?? null, error: match ? null : { message: 'not found' } });
    },
    insert(row: any) {
      ops.push({ op: 'insert', payload: row });
      if (initial.insertError) return { select: () => ({ single: () => Promise.resolve({ data: null, error: { message: initial.insertError } }) }) } as any;
      const inserted = (Array.isArray(row) ? row : [row]).map((r) =>
        r.id ? r : { ...r, id: (globalThis as any).crypto.randomUUID() }
      );
      rows.push(...inserted);
      return {
        select: () => ({ single: () => Promise.resolve({ data: inserted[0], error: null }) }),
        then: (resolve: any) => resolve({ error: null }),
      } as any;
    },
    upsert(row: any, opts?: any) {
      ops.push({ op: 'upsert', payload: row, opts });
      if (initial.upsertError) return Promise.resolve({ error: { message: initial.upsertError } });
      const inserted = Array.isArray(row) ? row : [row];
      inserted.forEach((r) => {
        const idx = rows.findIndex((x) => x.id === r.id);
        if (idx >= 0) rows[idx] = { ...rows[idx], ...r };
        else rows.push(r);
      });
      return Promise.resolve({ error: null });
    },
    update(row: any) {
      ops.push({ op: 'update', payload: row });
      // Return an object that supports .eq() chaining and awaits to { error: null }
      const thenable: any = { _filter: {} as any };
      thenable.eq = (col: string, val: any) => {
        thenable._filter[col] = val;
        rows.forEach((r) => {
          const ok = Object.entries(thenable._filter).every(([k, v]) => r[k] === v);
          if (ok) Object.assign(r, row);
        });
        return Promise.resolve({ error: null });
      };
      return thenable;
    },
  };
  return api;
}

function createMockAdmin(initial: { users?: any[]; invitations?: any[]; identityEvents?: any[]; trainerClients?: any[] } = {}) {
  const tables: Record<string, MockTable> = {
    users: createMockTable({ rows: initial.users ?? [] }),
    client_invitations: createMockTable({ rows: initial.invitations ?? [] }),
    identity_events: createMockTable({ rows: initial.identityEvents ?? [] }),
    trainer_clients: createMockTable({ rows: initial.trainerClients ?? [] }),
  };
  const authState = {
    users: [] as Array<{ id: string; email: string }>,
    recoveryLinksSent: [] as Array<{ email: string }>,
  };
  const rpcCalls: Array<{ fn: string; args: any }> = [];
  return {
    _tables: tables,
    _auth: authState,
    _rpcCalls: rpcCalls,
    from(name: string) {
      if (!tables[name]) tables[name] = createMockTable();
      return tables[name];
    },
    rpc(fn: string, args: any) {
      rpcCalls.push({ fn, args });
      if (fn === 'claim_invitation') {
        const inv = tables.client_invitations._rows.find((r: any) => r.invite_token === args.p_token);
        if (!inv) return Promise.resolve({ data: null, error: { message: 'invite_not_found' } });
        inv.status = 'accepted';
        inv.accepted_at = new Date().toISOString();
        // Transition user.
        const u = tables.users._rows.find((r: any) => r.id === args.p_auth_user_id);
        if (u) u.account_status = 'active';
        return Promise.resolve({
          data: [{ user_id: inv.client_id, trainer_id: inv.trainer_id, email: inv.email, was_claimed: true }],
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    },
    auth: {
      admin: {
        listUsers: async () => ({ data: { users: authState.users }, error: null }),
        createUser: async (args: any) => {
          if (authState.users.some((u) => u.email?.toLowerCase() === args.email.toLowerCase())) {
            return { data: null, error: { message: 'email exists' } };
          }
          const u = { id: args.id ?? crypto.randomUUID(), email: args.email };
          authState.users.push(u);
          return { data: { user: u }, error: null };
        },
        deleteUser: async (id: string) => {
          const idx = authState.users.findIndex((u) => u.id === id);
          if (idx >= 0) authState.users.splice(idx, 1);
          return { data: null, error: null };
        },
        updateUserById: async () => ({ data: null, error: null }),
        generateLink: async (args: any) => {
          authState.recoveryLinksSent.push({ email: args.email });
          return { data: { properties: { action_link: 'https://example.local/recovery' } }, error: null };
        },
      },
    },
    functions: {
      invoke: async () => ({ data: { ok: true }, error: null }),
    },
  };
}

let mockAdmin: ReturnType<typeof createMockAdmin>;

vi.mock('../../supabaseAdmin', () => ({
  getSupabaseAdmin: () => mockAdmin,
}));

// Import after the mock is registered.
import { createProvisionalClient, issueInvitation, claimInvitation } from '../inviteService';

describe('inviteService.createProvisionalClient', () => {
  beforeEach(() => {
    mockAdmin = createMockAdmin();
  });

  it('creates a public.users placeholder row + trainer_clients link', async () => {
    const res = await createProvisionalClient({
      trainerId: '00000000-0000-0000-0000-000000000001',
      displayName: 'Karen Doe',
      email: 'karen@example.com',
    });
    expect(res.clientId).toBeTruthy();
    const usersTable = mockAdmin._tables.users;
    const row = usersTable._rows.find((r: any) => r.id === res.clientId);
    expect(row).toBeDefined();
    expect(row.account_status).toBe('placeholder');
    expect(row.is_trainer).toBe(false);
    expect(row.email).toBe('karen@example.com');
    const tcTable = mockAdmin._tables.trainer_clients;
    expect(tcTable._rows).toHaveLength(1);
    expect(tcTable._rows[0].trainer_id).toBe('00000000-0000-0000-0000-000000000001');
    expect(tcTable._rows[0].client_id).toBe(res.clientId);
  });

  it('is idempotent when called twice with the same email for the same trainer', async () => {
    const args = {
      trainerId: '00000000-0000-0000-0000-000000000001',
      displayName: 'Karen Doe',
      email: 'karen@example.com',
    };
    const a = await createProvisionalClient(args);
    const b = await createProvisionalClient(args);
    expect(a.clientId).toBe(b.clientId);
    // Exactly one trainer_clients row for (trainer, client).
    const rows = mockAdmin._tables.trainer_clients._rows;
    expect(rows).toHaveLength(1);
  });

  it('lowercases and trims email', async () => {
    const res = await createProvisionalClient({
      trainerId: '00000000-0000-0000-0000-000000000001',
      displayName: 'Karen',
      email: '  Karen@Example.com  ',
    });
    const row = mockAdmin._tables.users._rows.find((r: any) => r.id === res.clientId);
    expect(row.email).toBe('karen@example.com');
  });
});

describe('inviteService.issueInvitation', () => {
  beforeEach(() => {
    mockAdmin = createMockAdmin({
      users: [{ id: 'client-1', email: 'karen@example.com', account_status: 'placeholder' }],
      trainerClients: [{ id: 'tc-1', trainer_id: 'trainer-1', client_id: 'client-1' }],
    });
  });

  it('upserts an invitation row with a fresh token and returns the invite URL', async () => {
    const res = await issueInvitation({
      trainerId: 'trainer-1',
      clientId: 'client-1',
      email: 'karen@example.com',
      appUrl: 'https://app.test',
      sendEmail: false,
    });
    expect(res.inviteToken).toHaveLength(43); // 32 bytes → 43 base64url chars
    expect(res.inviteUrl.startsWith('https://app.test/auth?token=')).toBe(true);
    const inv = mockAdmin._tables.client_invitations._rows[0];
    expect(inv.email).toBe('karen@example.com');
    expect(inv.trainer_id).toBe('trainer-1');
    expect(inv.client_id).toBe('client-1');
  });

  it('second call for same (trainer,email) refreshes token (onConflict trainer_id,email)', async () => {
    await issueInvitation({ trainerId: 'trainer-1', clientId: 'client-1', email: 'karen@example.com', sendEmail: false });
    const first = mockAdmin._tables.client_invitations._rows[0].invite_token;
    const res2 = await issueInvitation({ trainerId: 'trainer-1', clientId: 'client-1', email: 'karen@example.com', sendEmail: false });
    expect(res2.inviteToken).not.toBe(first);
  });
});

describe('inviteService.claimInvitation', () => {
  const baseInvite = {
    invite_token: 'tok-123',
    trainer_id: 'trainer-1',
    client_id: 'client-1',
    email: 'karen@example.com',
    status: 'sent',
    expires_at: new Date(Date.now() + 60_000).toISOString(),
  };

  beforeEach(() => {
    mockAdmin = createMockAdmin({
      users: [{ id: 'client-1', email: 'karen@example.com', account_status: 'placeholder' }],
      invitations: [structuredClone(baseInvite)],
    });
  });

  it('creates auth.users with the provisional id and marks invitation accepted', async () => {
    const res = await claimInvitation({ token: 'tok-123', newPassword: 'supersecret' });
    expect(res.userId).toBe('client-1');
    expect(res.trainerId).toBe('trainer-1');
    expect(res.wasClaimedNow).toBe(true);
    // auth.users row created with preserved id.
    expect(mockAdmin._auth.users).toContainEqual({ id: 'client-1', email: 'karen@example.com' });
    // invitation marked accepted.
    expect(mockAdmin._tables.client_invitations._rows[0].status).toBe('accepted');
    // claim_invitation RPC called.
    expect(mockAdmin._rpcCalls[0]).toEqual({ fn: 'claim_invitation', args: { p_token: 'tok-123', p_auth_user_id: 'client-1' } });
  });

  it('is idempotent: re-running after success is a no-op success', async () => {
    await claimInvitation({ token: 'tok-123', newPassword: 'supersecret' });
    const res2 = await claimInvitation({ token: 'tok-123', newPassword: 'supersecret' });
    expect(res2.wasClaimedNow).toBe(false);
    expect(res2.userId).toBe('client-1');
    // Still only one auth.users row.
    expect(mockAdmin._auth.users).toHaveLength(1);
  });

  it('rejects expired invitations', async () => {
    mockAdmin._tables.client_invitations._rows[0].expires_at = new Date(Date.now() - 1000).toISOString();
    await expect(claimInvitation({ token: 'tok-123', newPassword: 'x' })).rejects.toThrow(/invite_expired/);
  });

  it('rejects unknown tokens', async () => {
    await expect(claimInvitation({ token: 'nope', newPassword: 'x' })).rejects.toThrow(/invite_not_found/);
  });
});
