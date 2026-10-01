/**
 * _shared/founders-email.ts — the founders' welcome email, sent once a member
 * passes identity verification. Builds both the HTML and the plain-text
 * fallback from the same copy so they can never drift.
 *
 * Copy is unchanged from the original plain-text email — this only adds a
 * logo header and basic typography. Used by verify-identity (production
 * trigger) and send-batch-email (manual resends to a cohort). Logo is served
 * from the live site, not attached — inboxes cache remote images fine and it
 * keeps the message small.
 */

// Flattened black-background + white-logo banner, baked into one image.
// Gmail's mobile app auto-dark-mode rewrites CSS-declared background-colors
// (it flipped a #000000 table cell to white even with prefers-color-scheme
// and near-black/near-white overrides in place) but never touches pixel
// data inside an image, so the banner has to be a picture, not a styled cell.
const BANNER_URL = 'https://wbessgnycozfhjoucypc.supabase.co/storage/v1/object/public/avatars/_email-assets/founders-banner.png';
const INK = '#2b1420';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function buildFoundersWelcomeEmail(params: { name: string; cityLine?: string }): {
  subject: string;
  text: string;
  html: string;
} {
  const name = params.name;
  const cityLine = params.cityLine?.trim();

  const subject = `Welcome to Afterhours, ${name}`;

  const textParagraphs = [
    `Hi ${name},`,
    ...(cityLine ? [cityLine] : []),
    `We built Afterhours because going out alone, or trying to meet people as an adult woman, is harder than it should be. Every city has women who want to do more and go further. They just don't know each other yet.`,
    `You're one of our first members. If there's something you've been wanting to do, a dinner, a class, a run, post it as an event and we'll help get eyes on it. If you're still getting a feel for the place, start by exploring what's nearby.`,
    `Have a thought, a complaint, or an idea? Just reply. I read everything.`,
    `Welcome.`,
    `Sadhika\nCo-founder, Afterhours`,
  ];
  const text = textParagraphs.join('\n\n');

  const p = (body: string) =>
    `<p class="ink" style="margin:0 0 18px;font-size:16px;line-height:1.6;color:${INK};">${body}</p>`;

  const htmlParagraphs = [
    p(`Hi ${escapeHtml(name)},`),
    ...(cityLine ? [p(escapeHtml(cityLine))] : []),
    p(
      `We built Afterhours because going out alone, or trying to meet people as an adult woman, is harder than it should be. Every city has women who want to do more and go further. They just don't know each other yet.`,
    ),
    p(
      `You're one of our first members. If there's something you've been wanting to do, a dinner, a class, a run, post it as an event and we'll help get eyes on it. If you're still getting a feel for the place, start by exploring what's nearby.`,
    ),
    p(`Have a thought, a complaint, or an idea? Just reply. I read everything.`),
    p(`Welcome.`),
    `<p class="ink" style="margin:18px 0 0;font-size:16px;line-height:1.5;color:${INK};">Sadhika<br>Co-founder, Afterhours</p>`,
  ].join('\n');

  // Gmail's app auto-dark-mode rewrites CSS-declared colors on open (it flips
  // white card backgrounds dark and ink text light) but leaves image pixels
  // alone, so the .ink overrides below keep body copy legible either way and
  // the banner itself is a flattened image rather than a styled cell.
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(subject)}</title>
<style>
  @media (prefers-color-scheme: dark) {
    .email-bg { background-color:#f2f2f2 !important; }
    .card-bg { background-color:#ffffff !important; }
    .ink { color:${INK} !important; }
  }
  [data-ogsc] .email-bg { background-color:#f2f2f2 !important; }
  [data-ogsc] .card-bg { background-color:#ffffff !important; }
  [data-ogsc] .ink { color:${INK} !important; }
</style>
</head>
<body style="margin:0;padding:0;background-color:#f2f2f2;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="email-bg" style="background-color:#f2f2f2;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" class="card-bg" bgcolor="#ffffff" style="width:560px;max-width:100%;background-color:#ffffff;">
        <tr>
          <td style="line-height:0;font-size:0;">
            <img src="${BANNER_URL}" width="560" height="140" alt="Afterhours" style="display:block;width:100%;max-width:560px;height:auto;border:0;">
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px 40px;">
            ${htmlParagraphs}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  return { subject, text, html };
}
