/**
 * _shared/email.ts — Resend wrapper shared by edge functions that send transactional email.
 *
 * Required secrets (set once):
 *   supabase secrets set RESEND_API_KEY=re_...
 *   supabase secrets set RESEND_FROM_EMAIL=team@joinafterhours.in
 */

export async function sendEmail(to: string, subject: string, body: string, html?: string): Promise<void> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from   = Deno.env.get('RESEND_FROM_EMAIL') ?? 'team@joinafterhours.in';

  if (!apiKey) {
    console.error('[email] RESEND_API_KEY not set — email to', to, 'was NOT sent');
    return;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(html ? { from, to, subject, text: body, html } : { from, to, subject, text: body }),
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error('[email] Resend error:', res.status, detail);
    throw new Error(`Resend ${res.status}: ${detail}`);
  }
}
