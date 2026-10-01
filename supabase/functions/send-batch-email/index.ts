/**
 * send-batch-email/index.ts — Supabase Edge Function
 *
 * Manually-triggered batch sender for one-off campaigns (e.g. welcome emails
 * to a cohort of newly verified users). Not wired to any DB trigger.
 *
 * Deploy:
 *   supabase functions deploy send-batch-email
 *
 * Invoke (reuses the WEBHOOK_SECRET already set for notify-rsvp):
 *   curl -X POST https://<ref>.supabase.co/functions/v1/send-batch-email \
 *     -H "x-webhook-secret: $WEBHOOK_SECRET" \
 *     -H "Content-Type: application/json" \
 *     -d '{"subject":"...","bodyTemplate":"Hi {{first_name}},...","recipients":[{"email":"a@x.com","firstName":"A"}]}'
 *
 * bodyTemplate supports a single {{first_name}} placeholder, substituted per recipient.
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { sendEmail } from '../_shared/email.ts';

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

interface Recipient {
  email: string;
  firstName: string;
}

serve(async (req: Request) => {
  const incomingSecret = req.headers.get('x-webhook-secret') ?? '';
  const expectedSecret = Deno.env.get('WEBHOOK_SECRET') ?? '';
  if (!expectedSecret || !timingSafeEqual(incomingSecret, expectedSecret)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { subject, bodyTemplate, recipients } = await req.json() as {
    subject: string;
    bodyTemplate: string;
    recipients: Recipient[];
  };

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const results = [];
  for (const r of recipients) {
    const body = bodyTemplate.replaceAll('{{first_name}}', r.firstName);
    let lastErr: unknown = null;
    let ok = false;
    // Resend's rate limit is tight enough that a tight loop drops requests
    // silently from the caller's perspective — pace requests and retry once.
    for (let attempt = 0; attempt < 2 && !ok; attempt++) {
      if (attempt > 0) await sleep(1000);
      try {
        await sendEmail(r.email, subject, body);
        ok = true;
      } catch (err) {
        lastErr = err;
      }
    }
    results.push(ok ? { email: r.email, ok: true } : { email: r.email, ok: false, error: String(lastErr) });
    await sleep(600);
  }

  return new Response(JSON.stringify({ sent: results.length, results }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
