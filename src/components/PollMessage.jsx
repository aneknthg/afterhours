import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';

export default function PollMessage({ message }) {
  const { user } = useAuth();
  const poll = message.poll;
  const [votes, setVotes] = useState([]);
  const [myVotes, setMyVotes] = useState(new Set());
  const [voting, setVoting] = useState(false);

  useEffect(() => {
    if (!poll || !message.id) return;

    function loadVotes() {
      supabase
        .from('poll_votes')
        .select('user_id, option_index')
        .eq('message_id', message.id)
        .then(({ data }) => {
          const v = data || [];
          setVotes(v);
          setMyVotes(new Set(v.filter((r) => r.user_id === user?.id).map((r) => r.option_index)));
        });
    }

    loadVotes();

    const ch = supabase
      .channel(`poll:${message.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_votes', filter: `message_id=eq.${message.id}` }, loadVotes)
      .subscribe();

    return () => supabase.removeChannel(ch);
  }, [message.id, user?.id, poll]);

  async function castVote(optionIndex) {
    if (!user?.id || voting) return;
    setVoting(true);
    try {
      if (myVotes.has(optionIndex)) {
        await supabase
          .from('poll_votes')
          .delete()
          .eq('message_id', message.id)
          .eq('user_id', user.id)
          .eq('option_index', optionIndex);
      } else {
        if (!poll.multiple) {
          await supabase
            .from('poll_votes')
            .delete()
            .eq('message_id', message.id)
            .eq('user_id', user.id);
        }
        await supabase
          .from('poll_votes')
          .insert({ message_id: message.id, user_id: user.id, option_index: optionIndex });
      }
    } finally {
      setVoting(false);
    }
  }

  if (!poll) return null;

  const totalVotes = votes.length;
  const optionCounts = poll.options.map((_, i) => votes.filter((v) => v.option_index === i).length);
  const hasVoted = myVotes.size > 0;

  return (
    <div className="min-w-[220px] max-w-[280px] py-0.5">
      <div className="flex items-start gap-2 mb-3">
        <span className="material-symbols-outlined text-primary flex-shrink-0 mt-0.5" style={{ fontSize: 16 }}>bar_chart</span>
        <p className="text-sm font-semibold text-on-surface leading-snug">{poll.question}</p>
      </div>
      <div className="flex flex-col gap-1.5">
        {poll.options.map((option, i) => {
          const count = optionCounts[i];
          const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
          const isVoted = myVotes.has(i);
          return (
            <button
              key={i}
              onClick={() => castVote(i)}
              disabled={voting}
              className={`relative w-full text-left px-3 py-2.5 rounded-xl border transition-all overflow-hidden cursor-pointer ${
                isVoted
                  ? 'border-primary/50 text-primary'
                  : 'border-outline-variant/30 text-on-surface hover:border-primary/25'
              }`}
            >
              {/* Background fill bar */}
              {hasVoted && (
                <div
                  className={`absolute inset-y-0 left-0 rounded-xl transition-all duration-500 ${isVoted ? 'bg-primary/20' : 'bg-surface-container-high/60'}`}
                  style={{ width: `${pct}%` }}
                />
              )}
              {!hasVoted && (
                <div className="absolute inset-0 rounded-xl bg-surface-container/40" />
              )}
              <div className="relative flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  {isVoted && (
                    <span className="material-symbols-outlined text-primary flex-shrink-0" style={{ fontSize: 14 }}>check_circle</span>
                  )}
                  {!isVoted && hasVoted && (
                    <span className="material-symbols-outlined text-on-surface-variant/30 flex-shrink-0" style={{ fontSize: 14 }}>radio_button_unchecked</span>
                  )}
                  {!hasVoted && (
                    <span className="material-symbols-outlined text-on-surface-variant/30 flex-shrink-0" style={{ fontSize: 14 }}>
                      {poll.multiple ? 'check_box_outline_blank' : 'radio_button_unchecked'}
                    </span>
                  )}
                  <span className="text-sm truncate">{option}</span>
                </div>
                {hasVoted && (
                  <span className={`text-xs font-semibold flex-shrink-0 ${isVoted ? 'text-primary' : 'text-on-surface-variant/50'}`}>
                    {pct}%
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2 mt-2 px-0.5">
        <span className="text-[10px] text-on-surface-variant/40 font-medium">
          {totalVotes === 0 ? 'No votes yet' : `${totalVotes} vote${totalVotes !== 1 ? 's' : ''}`}
        </span>
        {poll.multiple && (
          <span className="text-[10px] text-on-surface-variant/30">· Select multiple</span>
        )}
      </div>
    </div>
  );
}
