/**
 * PayoutAccountCard.jsx — where a host sets up how she gets paid.
 *
 * Two homes, one component:
 *   context="profile" — the canonical place to add or change details, alongside
 *                       the rest of a person's account settings.
 *   context="create"  — shown in Create Event only once a ticket price is
 *                       entered, so a host charging money is asked for a payout
 *                       destination at the moment it becomes relevant, rather
 *                       than discovering the requirement later.
 *
 * Paid checkout currently works on the web only, so without this a host can
 * sell tickets on joinafterhours.in and leave us no way to send her the money.
 *
 * Quiet when there is nothing to do: a host who has already saved details sees
 * one line and an Edit link, not a form.
 */
import { useState, useEffect, useCallback } from 'react';
import Button from './ui/Button';
import { useToast } from './Toast';
import {
  fetchPayoutAccount, savePayoutAccount, validatePayoutAccount, maskAccountNumber,
} from '../lib/payouts.service';

const EMPTY = { method: 'upi', upi_id: '', account_name: '', account_number: '', ifsc: '' };

export default function PayoutAccountCard({ context = 'profile' }) {
  const showToast = useToast();

  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed]   = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [form, setForm]       = useState(EMPTY);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const acct = await fetchPayoutAccount();
      setAccount(acct);
      // Spreading over EMPTY leaves upi_id and account_number as '' on purpose:
      // the masked row has no such fields. The credentials are encrypted and
      // never come back to the browser, so changing an account means typing it
      // again. Name and IFSC do come back and prefill.
      if (acct) setForm({ ...EMPTY, ...acct });
    } catch {
      // Don't imply "no account set" on a read failure — a host would re-enter
      // details she has already given us, and we'd have no idea which is current.
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    const invalid = validatePayoutAccount(form);
    if (invalid) { setError(invalid); return; }

    setSaving(true);
    setError('');
    try {
      const saved = await savePayoutAccount(form);
      setAccount(saved);
      // Drop the typed credentials rather than leaving them in component state
      // behind a closed form.
      setForm((f) => ({ ...f, upi_id: '', account_number: '' }));
      setEditing(false);
      showToast('Payout details saved.');
    } catch (err) {
      setError(err.message || 'Could not save your details. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  // Create Event nests this inside its own padded settings rows, so the
  // trailing margin is the parent's business there.
  const shell = `rounded-2xl border border-outline-variant/20 bg-surface-container ${context === 'create' ? '' : 'mb-6'}`;

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    if (error) setError('');
  }

  if (loading) {
    return (
      <div className={`${shell} px-5 py-4`}>
        <p className="text-sm text-on-surface-variant">Loading payout details…</p>
      </div>
    );
  }

  if (failed) {
    return (
      <div className={`${shell} px-5 py-4 flex items-center justify-between gap-4`}>
        <p className="text-sm text-on-surface-variant">Couldn't load your payout details.</p>
        <button onClick={load} className="text-xs font-semibold text-primary hover:underline">
          Retry
        </button>
      </div>
    );
  }

  const showForm = editing || !account;

  // ── Saved state ────────────────────────────────────────────────────────────
  if (!showForm) {
    return (
      <div className={`${shell} px-5 py-4`}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-on-surface-variant/60 font-semibold mb-1">
              {context === 'create' ? 'Earnings go to' : 'Getting paid'}
            </p>
            <p className="text-sm text-on-surface font-medium truncate">
              {account.method === 'upi'
                ? account.upi_masked
                : `${account.account_name} · ${maskAccountNumber(account.account_last4)} · ${account.ifsc}`}
            </p>
          </div>
          <button
            onClick={() => { setForm({ ...EMPTY, ...account }); setEditing(true); }}
            className="text-xs font-semibold text-primary hover:underline flex-shrink-0"
          >
            Edit
          </button>
        </div>
      </div>
    );
  }

  // ── Form ───────────────────────────────────────────────────────────────────
  return (
    <div className={`${shell} px-5 py-5`}>
      <p className="text-[11px] uppercase tracking-wider text-on-surface-variant/60 font-semibold mb-1">
        {context === 'create' ? 'Earnings go to' : 'Getting paid'}
      </p>
      <p className="text-sm text-on-surface-variant mb-4 leading-relaxed">
        {account
          ? 'Change where we send your ticket earnings.'
          : context === 'create'
            ? "You're charging for this event, so tell us where to send the money."
            : 'Tell us where to send your ticket earnings. You only need this if you charge for an event.'}
      </p>

      <div className="flex gap-2 mb-4">
        {['upi', 'bank'].map((m) => (
          <button
            key={m}
            onClick={() => set('method', m)}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${
              form.method === m
                ? 'border-primary text-primary bg-primary/5'
                : 'border-outline-variant/25 text-on-surface-variant hover:border-outline-variant/50'
            }`}
          >
            {m === 'upi' ? 'UPI' : 'Bank account'}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {form.method === 'upi' ? (
          <Field
            label="UPI ID"
            value={form.upi_id}
            onChange={(v) => set('upi_id', v)}
            placeholder="yourname@bank"
            autoComplete="off"
          />
        ) : (
          <>
            <Field
              label="Account holder name"
              value={form.account_name}
              onChange={(v) => set('account_name', v)}
              placeholder="As it appears on the account"
            />
            <Field
              label="Account number"
              value={form.account_number}
              onChange={(v) => set('account_number', v)}
              placeholder="000123456789"
              inputMode="numeric"
              autoComplete="off"
            />
            <Field
              label="IFSC"
              value={form.ifsc}
              onChange={(v) => set('ifsc', v.toUpperCase())}
              placeholder="HDFC0001234"
              autoComplete="off"
            />
          </>
        )}
      </div>

      {error && (
        <p className="text-xs text-error bg-error-container/20 rounded-xl px-3 py-2.5 mt-4">{error}</p>
      )}

      <div className="flex gap-2 mt-5">
        <Button variant="primary" size="sm" fullWidth disabled={saving} onClick={handleSave}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
        {account && (
          <Button
            variant="ghost"
            size="sm"
            disabled={saving}
            onClick={() => { setEditing(false); setError(''); setForm({ ...EMPTY, ...account }); }}
          >
            Cancel
          </Button>
        )}
      </div>

      <p className="text-[10px] text-on-surface-variant/50 mt-4 leading-relaxed">
        We send your earnings after the event finishes. This account only
        receives money, we never charge it.
      </p>
    </div>
  );
}

function Field({ label, value, onChange, ...rest }) {
  return (
    <label className="block">
      <span className="text-[11px] text-on-surface-variant/70 font-medium mb-1 block">{label}</span>
      <input
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-surface border border-outline-variant/25 rounded-xl px-3 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:border-primary focus:outline-none transition-colors"
        {...rest}
      />
    </label>
  );
}
