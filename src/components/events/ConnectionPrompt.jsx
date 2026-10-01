/**
 * ConnectionPrompt.jsx — post-event "connect with attendees" prompt
 *
 * Place at: src/components/events/ConnectionPrompt.jsx
 *
 * This appears on EventDetail for past events the user attended.
 * Shows other attendees and lets them send connection requests.
 *
 * Usage:
 *   <ConnectionPrompt eventId={event.id} userId={user.id} eventTitle={event.title} />
 */
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { avatarBg, getInitials } from '../../lib/avatar';
import TrustBadge from '../trust/TrustBadge';
import Card from '../ui/Card';

export default function ConnectionPrompt({ eventId, userId, eventTitle }) {
  const [attendees, setAttendees] = useState([]);
  const [sentRequests, setSentRequests] = useState(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventId || !userId) return;
    loadAttendees();
  }, [eventId, userId]);

  async function loadAttendees() {
    setLoading(true);
    try {
      // Get other attendees (not self)
      const { data: rsvps } = await supabase
        .from('rsvps')
        .select('user_id, profiles:public_profiles!user_id(display_name, trust_level)')
        .eq('event_id', String(eventId))
        .neq('user_id', userId)
        .limit(12);

      const others = (rsvps || []).map(r => ({
        id: r.user_id,
        display_name: r.profiles?.display_name || 'Anonymous',
        trust_level: r.profiles?.trust_level || 0,
      }));

      // Check which connections already exist
      const { data: existing } = await supabase
        .from('connections')
        .select('target_id')
        .eq('requester_id', userId)
        .in('target_id', others.map(a => a.id));

      const alreadySent = new Set((existing || []).map(c => c.target_id));

      setAttendees(others);
      setSentRequests(alreadySent);
    } catch (err) {
      console.error('Connection prompt error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function sendRequest(targetId) {
    try {
      await supabase.from('connections').upsert({
        requester_id: userId,
        target_id: targetId,
        event_id: String(eventId),
        status: 'pending',
      }, { onConflict: 'requester_id,target_id' });

      setSentRequests(prev => new Set([...prev, targetId]));
    } catch (err) {
      console.error('Connection request error:', err);
    }
  }

  if (loading || attendees.length === 0) return null;

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="material-symbols-outlined text-primary text-lg">people</span>
        <div>
          <h3 className="font-headline text-base text-on-surface font-semibold">Connect with attendees</h3>
          <p className="text-xs text-on-surface-variant">
            You were at {eventTitle} with these people
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {attendees.map(a => (
          <div key={a.id} className="flex items-center gap-3 py-2">
            <div className="relative">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${avatarBg(a.display_name)}`}>
                {getInitials(a.display_name)}
              </div>
              {a.trust_level >= 2 && (
                <div className="absolute -bottom-0.5 -right-0.5">
                  <TrustBadge level={a.trust_level} size="sm" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-on-surface truncate">{a.display_name}</p>
              <TrustBadge level={a.trust_level} size="sm" showLabel />
            </div>

            {sentRequests.has(a.id) ? (
              <span className="text-xs text-primary font-bold uppercase tracking-widest flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">check</span>
                Sent
              </span>
            ) : (
              <button
                onClick={() => sendRequest(a.id)}
                className="text-xs text-primary font-bold uppercase tracking-widest hover:underline flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">person_add</span>
                Connect
              </button>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
