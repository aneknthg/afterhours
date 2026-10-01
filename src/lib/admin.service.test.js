import { describe, it, expect, vi, beforeEach } from 'vitest';

// admin.service imports ./supabase, which builds a real client from env vars at
// module load. Stub it: these tests are about how a failing response is turned
// into a message, and never touch the network.
vi.mock('./supabase', () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: { access_token: 'test-token' } } }) },
  },
}));

const { fetchAdminOverview, markEarningsPaid, AdminError } = await import('./admin.service');

/** Makes global fetch answer once with the body admin-payouts would return. */
function respondWith(status, body) {
  global.fetch = vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  }));
}

async function errorFrom(status, body) {
  respondWith(status, body);
  try {
    await fetchAdminOverview();
  } catch (err) {
    return err;
  }
  throw new Error('expected fetchAdminOverview to throw');
}

beforeEach(() => { vi.restoreAllMocks(); });

// ── the regression this file exists for ───────────────────────────────────────
//
// admin-payouts was deployed for four days reading host_payout_accounts.upi_id
// after a migration dropped that column. It returned the failing column in
// `detail` the whole time; the client threw only the generic sentence, so the
// page said "Could not read the payment tables." and nothing else. Without the
// detail these assertions fail and the message is opaque again.

describe('server detail in the thrown message', () => {
  it('names the failing column on the stale-deploy failure', async () => {
    const err = await errorFrom(500, {
      error: 'read_failed',
      detail: 'column host_payout_accounts.upi_id does not exist',
    });
    expect(err.message).toContain('column host_payout_accounts.upi_id does not exist');
  });

  it('keeps the readable summary in front of the detail', async () => {
    const err = await errorFrom(500, { error: 'read_failed', detail: 'boom' });
    expect(err.message).toBe('Could not read the payment tables. (boom)');
  });

  it('exposes detail as a property, not only inside the message', async () => {
    const err = await errorFrom(500, { error: 'update_failed', detail: 'deadlock detected' });
    expect(err).toBeInstanceOf(AdminError);
    expect(err.reason).toBe('update_failed');
    expect(err.detail).toBe('deadlock detected');
  });

  it('carries detail through every failure code that sends one', async () => {
    for (const [reason, detail] of [
      ['read_failed', 'relation "refunds" does not exist'],
      ['mature_failed', 'deadlock detected'],
      ['update_failed', 'permission denied for table host_earnings'],
      ['invalid_request', 'earningIds is required'],
    ]) {
      const err = await errorFrom(500, { error: reason, detail });
      expect(err.message).toContain(detail);
      expect(err.detail).toBe(detail);
    }
  });
});

describe('failures that carry no detail', () => {
  it('leaves forbidden clean, with no empty parentheses', async () => {
    const err = await errorFrom(403, { error: 'forbidden' });
    expect(err.message).toBe('This account does not have access to the admin view.');
    expect(err.detail).toBe('');
  });

  it('ignores a detail that is not a string', async () => {
    const err = await errorFrom(500, { error: 'read_failed', detail: { nested: 1 } });
    expect(err.message).toBe('Could not read the payment tables.');
    expect(err.message).not.toContain('[object Object]');
  });

  it('ignores a whitespace-only detail', async () => {
    const err = await errorFrom(500, { error: 'read_failed', detail: '   ' });
    expect(err.message).toBe('Could not read the payment tables.');
  });

  it('falls back to the raw body for an unrecognised code', async () => {
    const err = await errorFrom(502, '<html>Bad Gateway</html>');
    expect(err.reason).toBe('unknown');
    expect(err.message).toContain('502');
    expect(err.message).not.toContain('undefined');
  });
});

describe('the success path is untouched', () => {
  it('returns the parsed body', async () => {
    respondWith(200, { orders: [], earnings: [] });
    await expect(fetchAdminOverview()).resolves.toEqual({ orders: [], earnings: [] });
  });

  it('surfaces detail from mark_paid too', async () => {
    respondWith(500, { error: 'mature_failed', detail: 'deadlock detected' });
    await expect(markEarningsPaid(['id-1'])).rejects.toThrow('deadlock detected');
  });
});
