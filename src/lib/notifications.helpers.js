/**
 * notifications.helpers.js — the two pieces the unread badge needs that are
 * not I/O.
 *
 * Both exist because of the same bug: opening the notifications feed wrote
 * read=true to the server and then rendered the snapshot it had taken before
 * the write, so the row tint and the header badge both kept showing unread
 * until a manual reload.
 */

/**
 * Dispatched by the Notifications page once its mark-read writes have landed;
 * the Header listens and recounts.
 *
 * The Header owns the badge but has no reference to the page, and its recount
 * runs on route change — which fires while the writes are still in flight, so
 * it reads pre-write state and sits stale until the next 30s poll. One window
 * event rather than a context: exactly one producer, one consumer, neither in
 * the other's tree.
 */
export const NOTIFICATIONS_READ_EVENT = 'afterhours:notifications-read';

/**
 * Returns `items` with every unread sent-to-me notification flipped to read.
 *
 * Only rows carrying a `notifId` are user_notifications rows; RSVP and
 * connection requests have no read flag and stay untouched, because they are
 * unread until actioned rather than until seen.
 *
 * Returns the original array when nothing is unread, so an unchanged feed does
 * not produce a new array identity and re-render the list for no reason.
 */
export function markUnreadAsRead(items) {
  if (!Array.isArray(items)) return items;
  const hasUnread = items.some((i) => i && i.notifId && !i.read);
  if (!hasUnread) return items;
  return items.map((i) => (i && i.notifId && !i.read ? { ...i, read: true } : i));
}

/** The unread rows a caller still has to write to the server. */
export function unreadNotifIds(items) {
  if (!Array.isArray(items)) return [];
  return items.filter((i) => i && i.notifId && !i.read).map((i) => i.notifId);
}
