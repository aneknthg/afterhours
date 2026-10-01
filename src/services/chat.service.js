/**
 * chat.service.js — chat logic, moderation, message reporting
 *
 * Place at: src/services/chat.service.js
 */
import { supabase } from '../lib/supabase';

// ── Content moderation ───────────────────────────────────────────────────────
// Client-side keyword filter. Not a replacement for server-side moderation,
// but catches the most obvious issues before they hit the DB.
const BLOCKED_PATTERNS = [
  // Slurs and hate speech (partial list — extend as needed)
  /\bn[i1]gg[ae3]r/i,
  /\bf[a@]gg[o0]t/i,
  /\bk[i1]ke\b/i,
  /\btr[a@]nn[yi1e]/i,
  // Sexual solicitation
  /\bsend\s*nudes?\b/i,
  /\bdick\s*pic/i,
  /\bwanna\s*(hook\s*up|fuck|smash|bang)\b/i,
  // Threats
  /\b(i'?ll|gonna|going\s*to)\s*kill\s*(you|u)\b/i,
  /\bkill\s*your\s*self\b/i,
  // Contact solicitation (phone numbers, social handles in early messages)
  /\b\d{10,}\b/,
  // Direct contact-app links — general URLs and WhatsApp are allowed
  /\bhttps?:\/\/(t\.me|telegram\.me)\//i,
];

const WARN_PATTERNS = [
  /\b(whatsapp|telegram|signal|snap(chat)?)\b/i,
  /\b(insta(gram)?|ig)\s*:?\s*@/i,
  /\b(phone|number|digits)\b/i,
];

/**
 * Check message content for violations.
 * Returns: { allowed: boolean, reason?: string, warning?: string }
 */
export function moderateMessage(text) {
  const trimmed = text.trim();

  if (!trimmed) return { allowed: false, reason: 'Message is empty.' };
  if (trimmed.length > 1000) return { allowed: false, reason: 'Message too long (max 1000 characters).' };

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { allowed: false, reason: 'This message contains content that violates our community guidelines.' };
    }
  }

  let warning = null;
  for (const pattern of WARN_PATTERNS) {
    if (pattern.test(trimmed)) {
      warning = 'Sharing personal contact info early on can be risky. Consider connecting through the platform first.';
      break;
    }
  }

  return { allowed: true, warning };
}

// ── Message operations ───────────────────────────────────────────────────────

export const chatService = {
  /**
   * Send a message (with client-side moderation check).
   *
   * Two layers of moderation:
   *   1. Client-side — fast feedback, reduces round-trips.
   *   2. Server-side — authoritative. A BEFORE INSERT trigger on
   *      messages (see 2026-04-17-security-hardening.sql) re-runs
   *      the banned-pattern check at the DB level. If the client
   *      is bypassed (someone hitting Supabase directly via the
   *      console), the DB will still reject the message.
   *
   * Returns: { sent: boolean, reason?: string, warning?: string }
   */
  async sendMessage({ channel, userId, displayName, content, replyTo = null }) {
    const check = moderateMessage(content);
    if (!check.allowed) {
      return { sent: false, reason: check.reason };
    }

    const payload = {
      channel,
      user_id: userId,
      display_name: displayName,
      content: content.trim(),
    };

    // Add reply_to if replying
    if (replyTo) {
      payload.reply_to = replyTo;
    }

    let { error } = await supabase.from('messages').insert(payload);
    if (error && payload.reply_to) {
      // Fallback if reply_to column doesn't exist yet
      const msg = String(error.message || '').toLowerCase();
      if (msg.includes('reply_to') || msg.includes('column')) {
        delete payload.reply_to;
        const { error: e2 } = await supabase.from('messages').insert(payload);
        error = e2 || null;
      }
    }
    if (error) {
      // Translate server-side rejections into user-facing reasons
      const msg = String(error.message || '').toLowerCase();
      if (msg.includes('community guidelines')) {
        return { sent: false, reason: 'This message contains content that violates our community guidelines.' };
      }
      if (msg.includes('too long')) {
        return { sent: false, reason: 'Message too long (max 1000 characters).' };
      }
      if (msg.includes('empty')) {
        return { sent: false, reason: 'Message is empty.' };
      }
      if (msg.includes('rate limit')) {
        throw new Error("Slow down — you're sending messages too fast.");
      }
      // RLS rejection — user isn't a member of this channel
      if (msg.includes('row-level security') || msg.includes('violates row-level')) {
        return { sent: false, reason: 'You can\'t post in this channel.' };
      }
      throw error;
    }

    return { sent: true, warning: check.warning };
  },

  /**
   * Report a specific message
   */
  async reportMessage({ messageId, reporterId, reason, details = '' }) {
    const { error } = await supabase.from('message_reports').insert({
      message_id: messageId,
      reporter_id: reporterId,
      reason,
      details,
    });
    if (error) {
      // If table doesn't exist yet, fall back to the general reports table
      const { error: fallbackError } = await supabase.from('reports').insert({
        reporter_id: reporterId,
        reason: `Message report: ${reason}`,
        details: `Message ID: ${messageId}. ${details}`,
      });
      if (fallbackError) throw fallbackError;
    }
  },

  /**
   * Edit own message content.
   */
  async editMessage(messageId, userId, newContent) {
    const check = moderateMessage(newContent);
    if (!check.allowed) return { edited: false, reason: check.reason };
    const { error } = await supabase
      .from('messages')
      .update({ content: newContent.trim(), edited_at: new Date().toISOString() })
      .eq('id', messageId)
      .eq('user_id', userId);
    if (error) {
      // Fallback if edited_at column doesn't exist yet
      await supabase
        .from('messages')
        .update({ content: newContent.trim() })
        .eq('id', messageId)
        .eq('user_id', userId);
    }
    return { edited: true };
  },

  /**
   * Delete own message (soft — sets content to [deleted])
   */
  async deleteOwnMessage(messageId, userId) {
    const { error } = await supabase
      .from('messages')
      .update({ content: null, deleted_at: new Date().toISOString() })
      .eq('id', messageId)
      .eq('user_id', userId);
    if (error) {
      // Fallback if deleted_at column doesn't exist yet
      await supabase
        .from('messages')
        .update({ content: null })
        .eq('id', messageId)
        .eq('user_id', userId);
    }
  },

  /**
   * Send a poll message.
   */
  async sendPoll({ channel, userId, displayName, question, options, multiple }) {
    const { error } = await supabase.from('messages').insert({
      channel,
      user_id: userId,
      display_name: displayName,
      content: null,
      poll: { question, options, multiple: !!multiple },
    });
    if (error) throw error;
    return { sent: true };
  },

  /**
   * Fetch messages for a channel with pagination
   */
  async fetchMessages(channel, limit = 80, since = null) {
    let query = supabase
      .from('messages')
      .select('*')
      .eq('channel', channel)
      .order('created_at', { ascending: true })
      .limit(limit);
    if (since) query = query.gte('created_at', since);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  /**
   * Build hobby-based community circles from user's hobbies.
   * Maps hobbies to themed circles.
   *
   * Note: the "General" channel is no longer built here — it is city-specific
   * (see cityGeneralCircle / generalCircleFromChannel) and assembled in Chat.jsx
   * from the user's current city plus the city Generals she has joined.
   */
  buildCommunityCircles(hobbies = [], city) {
    if (!hobbies.length) {
      return [];
    }

    // The channel id carries the city — `community-fitness-hyderabad` — because a
    // single global `community-fitness` put every city in one room, which defeats
    // the point of an interest circle you are meant to be able to turn up to.
    //
    // Returns [] when there is no city, the same way cityGeneralCircle() returns
    // null: a circle with no city has no room to point at, and defaulting to the
    // launch city would drop a Mumbai user into Hyderabad's chat.
    //
    // Every key in CIRCLE_DEFS is a single word, so `community-<hobby>-<citySlug>`
    // stays unambiguous even for a slug that contains a dash ("new-delhi").
    // Keep in sync with buildCommunityCircles in Afterhours-App-main.
    const slug = citySlug(city);
    if (!slug) {
      return [];
    }

    // Map hobby categories to circles
    const HOBBY_TO_CIRCLE = {
      // Sports & Fitness
      'Football': 'fitness', 'Basketball': 'fitness', 'Tennis': 'fitness',
      'Running': 'fitness', 'Yoga': 'fitness', 'Swimming': 'fitness',
      'Cycling': 'fitness', 'Hiking': 'outdoors', 'Martial Arts': 'fitness',
      'Volleyball': 'fitness', 'Cricket': 'fitness', 'Badminton': 'fitness',
      // Arts & Creative
      'Painting': 'creative', 'Photography': 'creative', 'Sketching': 'creative',
      'Pottery': 'creative', 'Graphic Design': 'creative', 'Film Making': 'cinema',
      'Writing': 'bookish', 'Calligraphy': 'creative',
      // Music
      'Guitar': 'music', 'Piano': 'music', 'Singing': 'music',
      'DJing': 'music', 'Drums': 'music', 'Vinyl Collecting': 'music',
      'Jazz': 'music', 'Classical Music': 'music',
      // Food & Drink
      'Cooking': 'foodie', 'Baking': 'foodie', 'Wine Tasting': 'foodie',
      'Mixology': 'foodie', 'Coffee': 'foodie', 'Food Photography': 'foodie',
      // Mind & Culture
      'Reading': 'bookish', 'Book Clubs': 'bookish', 'Philosophy': 'bookish',
      'Chess': 'games', 'Board Games': 'games', 'Meditation': 'wellness',
      'Languages': 'bookish',
      // Tech
      'Coding': 'tech', 'Robotics': 'tech', 'Astronomy': 'outdoors',
      'Gaming': 'games', '3D Printing': 'tech', 'AI / ML': 'tech',
      'Data Science': 'tech', 'UX Design': 'tech', 'Cybersecurity': 'tech',
      // Career & Business
      'Startups': 'career', 'Entrepreneurship': 'career', 'Product': 'career',
      'Marketing': 'career', 'Finance': 'career', 'Investing': 'career',
      'Public Speaking': 'career', 'Consulting': 'career', 'Freelancing': 'career',
      'Leadership': 'career',
      // Outdoors
      'Camping': 'outdoors', 'Rock Climbing': 'outdoors', 'Surfing': 'outdoors',
      'Skateboarding': 'outdoors', 'Gardening': 'outdoors', 'Stargazing': 'outdoors',
    };

    const CIRCLE_DEFS = {
      fitness:  { name: 'Fitness & Sports', icon: 'fitness_center', desc: 'Workouts, matches, and active meetups' },
      creative: { name: 'Creative Studio', icon: 'palette', desc: 'Art, design, and making things' },
      music:    { name: 'Music Room', icon: 'music_note', desc: 'Jams, playlists, and live sessions' },
      foodie:   { name: 'Foodie Corner', icon: 'restaurant', desc: 'Cooking, tasting, and restaurant finds' },
      bookish:  { name: 'Book & Culture Club', icon: 'menu_book', desc: 'Reading, writing, and deep talks' },
      cinema:   { name: 'Cinema Night', icon: 'movie', desc: 'Films, screenings, and recommendations' },
      outdoors: { name: 'Outdoor Adventures', icon: 'hiking', desc: 'Hikes, trips, and nature' },
      games:    { name: 'Game Night', icon: 'sports_esports', desc: 'Board games, chess, and gaming' },
      tech:     { name: 'Tech & Code', icon: 'computer', desc: 'Building, learning, and geeking out' },
      career:   { name: 'Career & Startups', icon: 'work', desc: 'Startups, work, and building a career' },
      wellness: { name: 'Wellness Circle', icon: 'self_improvement', desc: 'Mindfulness, meditation, and self-care' },
    };

    // Find which circles match the user's hobbies
    const matchedCircleIds = new Set();
    for (const hobby of hobbies) {
      const circleId = HOBBY_TO_CIRCLE[hobby];
      if (circleId) matchedCircleIds.add(circleId);
    }

    const circles = [];

    for (const cid of matchedCircleIds) {
      const def = CIRCLE_DEFS[cid];
      if (def) {
        circles.push({
          id: `community-${cid}-${slug}`,
          name: def.name,
          icon: def.icon,
          isEvent: false,
          desc: `${def.desc} · ${(city || '').trim()}`,
        });
      }
    }

    return circles;
  },

  // ── City General membership ────────────────────────────────────────────────

  /**
   * Channels (city Generals) the user has joined. Returns [] if the membership
   * table doesn't exist yet (pre-migration) so the chat page never breaks.
   */
  async fetchJoinedGenerals(userId) {
    if (!userId) return [];
    try {
      const { data, error } = await supabase
        .from('chat_channel_members')
        .select('channel')
        .eq('user_id', userId);
      if (error) return [];
      return (data || []).map((r) => r.channel).filter(isGeneralChannel);
    } catch {
      return [];
    }
  },

  /**
   * Join a city General. Idempotent — re-joining is a no-op.
   */
  async joinGeneral(userId, channel) {
    const { error } = await supabase
      .from('chat_channel_members')
      .upsert({ user_id: userId, channel }, { onConflict: 'user_id,channel', ignoreDuplicates: true });
    if (error) throw error;
  },
};

// ── City General helpers ──────────────────────────────────────────────────────

// "Hyderabad" → "hyderabad", "New Delhi" → "new-delhi"
export function citySlug(city) {
  return (city || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * The city-independent part of a community channel id, for lookups keyed by
 * circle type rather than by room: `community-fitness-hyderabad` →
 * `community-fitness`. Without this, ICE_BREAKERS[circle.id] stopped matching
 * the moment ids gained a city and every interest circle silently fell back to
 * the generic prompts. Mirrors communityTypeKey in Afterhours-App-main.
 */
export function communityTypeKey(channelId) {
  const rest = (channelId || '').replace(/^community-/, '');
  const type = rest.split('-')[0];
  return type ? `community-${type}` : '';
}

export function isGeneralChannel(channelId) {
  return typeof channelId === 'string' && channelId.startsWith('community-general-');
}

// "community-general-new-delhi" → "New Delhi"
export function cityNameFromGeneral(channelId) {
  return channelId
    .replace(/^community-general-/, '')
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// Build the General circle for a given city (uses the original city string for
// a nicely-cased display name). Returns null when the user has no city set.
export function cityGeneralCircle(city) {
  const slug = citySlug(city);
  if (!slug) return null;
  return {
    id: `community-general-${slug}`,
    name: `General · ${city.trim()}`,
    icon: 'chat',
    isEvent: false,
    isCityGeneral: true,
    citySlug: slug,
    desc: `Open to everyone in ${city.trim()}`,
  };
}

// Build a General circle from a stored channel id (used for joined cities other
// than the user's current one, where we only have the channel slug to go on).
export function generalCircleFromChannel(channelId) {
  const cityName = cityNameFromGeneral(channelId);
  return {
    id: channelId,
    name: `General · ${cityName}`,
    icon: 'chat',
    isEvent: false,
    isCityGeneral: true,
    citySlug: channelId.replace(/^community-general-/, ''),
    desc: `Open to everyone in ${cityName}`,
  };
}
