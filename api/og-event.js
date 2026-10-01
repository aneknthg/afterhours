/**
 * Link previews for shared event URLs.
 *
 * WhatsApp, iMessage, Instagram and Slack do not run JavaScript. They fetch the
 * URL and read whatever HTML comes back, and this site is a Vite SPA behind a
 * catch-all rewrite, so every event link previewed as a bare grey URL. This
 * function sits in front of /event/:id, reads the event, and injects real
 * Open Graph tags into the shell before it goes out.
 *
 * It serves the same document to people and to crawlers. User-agent sniffing
 * would be less code, but a user-agent list rots silently: a crawler you have
 * not heard of previews as nothing and nothing anywhere reports it.
 *
 * Reads public_events, never events. The teaser view carries no venue or
 * extras, so an event's address cannot leak into a preview card that gets
 * forwarded on.
 *
 * Runtime env (Vercel project settings, not the VITE_ build vars):
 *   SUPABASE_URL, SUPABASE_ANON_KEY
 * The VITE_ names are accepted as a fallback for local `vercel dev`.
 */

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const SITE = 'https://www.joinafterhours.in';
const FALLBACK_IMAGE = `${SITE}/favicon-512.png`;

/**
 * Event titles are user-authored and land inside an HTML attribute. Both quote
 * forms have to go: a title containing a double quote would otherwise close
 * the content attribute and let the rest inject markup into our head.
 */
function escapeAttr(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function describe(event) {
  const parts = [];
  const when = event.starts_at || event.date;
  if (when) {
    const d = new Date(when);
    if (!Number.isNaN(d.getTime())) {
      parts.push(
        d.toLocaleDateString('en-IN', {
          weekday: 'short', day: 'numeric', month: 'short',
          hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata',
        })
      );
    }
  }
  if (event.city) parts.push(event.city);
  parts.push('Women only, verified members.');
  return parts.join(' · ');
}

async function fetchEvent(id) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  const url =
    `${SUPABASE_URL}/rest/v1/public_events` +
    `?select=id,title,city,date,starts_at,image_url&id=eq.${encodeURIComponent(id)}&limit=1`;
  try {
    const res = await fetch(url, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    });
    if (!res.ok) return null;
    const rows = await res.json();
    return Array.isArray(rows) && rows[0] ? rows[0] : null;
  } catch {
    return null;
  }
}

/**
 * The built shell, fetched from this same deployment. Reading it off the
 * function's filesystem would be faster but depends on how Vercel lays out the
 * bundle; the script and style filenames are content-hashed per build, so
 * hand-writing a shell here would go stale on the next deploy and serve a
 * blank page to every human who opened a shared link.
 */
async function fetchShell(host) {
  const res = await fetch(`https://${host}/index.html`, {
    headers: { 'user-agent': 'afterhours-og-injector' },
  });
  if (!res.ok) throw new Error(`shell fetch failed: ${res.status}`);
  return res.text();
}

function buildTags(event, id) {
  const title = event ? `${event.title} · Afterhours` : 'Afterhours';
  const description = event
    ? describe(event)
    : 'A women-only community for finding events, meeting people, and going out safely after hours.';
  const image = (event && event.image_url) || FALLBACK_IMAGE;
  const url = `${SITE}/event/${encodeURIComponent(id)}`;

  return [
    // Not a duplicate of og:description. The handler strips the shell's static
    // description, and search engines read this one, not the og: tag, for the
    // snippet under a result. Without it every event page ships with none.
    `<meta name="description" content="${escapeAttr(description)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="Afterhours">`,
    `<meta property="og:title" content="${escapeAttr(title)}">`,
    `<meta property="og:description" content="${escapeAttr(description)}">`,
    `<meta property="og:image" content="${escapeAttr(image)}">`,
    `<meta property="og:url" content="${escapeAttr(url)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escapeAttr(title)}">`,
    `<meta name="twitter:description" content="${escapeAttr(description)}">`,
    `<meta name="twitter:image" content="${escapeAttr(image)}">`,
    `<title>${escapeAttr(title)}</title>`,
  ].join('\n    ');
}

export default async function handler(req, res) {
  const id = (req.query && req.query.id) || '';
  const host = req.headers['x-forwarded-host'] || req.headers.host;

  let shell;
  try {
    shell = await fetchShell(host);
  } catch {
    // Never fail the page over a preview. Falling through to the catch-all
    // rewrite gives the visitor the normal SPA, just without rich tags.
    res.setHeader('Location', `/index.html`);
    res.status(302).end();
    return;
  }

  const event = await fetchEvent(id);

  // The shell ships a static <title> and description; drop them so the
  // event's own values are the only ones a crawler sees.
  const cleaned = shell
    .replace(/<title>[\s\S]*?<\/title>/i, '')
    .replace(/<meta\s+name="description"[^>]*>/i, '');

  const html = cleaned.replace(/<\/head>/i, `    ${buildTags(event, id)}\n  </head>`);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // Short shared cache so an edited event title refreshes within the hour,
  // while a link doing the rounds in a group chat is not re-rendered per tap.
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=600, stale-while-revalidate=3600');
  res.status(200).send(html);
}
