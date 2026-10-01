import { useState } from 'react';

export default function CreatePollModal({ onClose, onSubmit }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [multiple, setMultiple] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function addOption() {
    if (options.length >= 12) return;
    setOptions([...options, '']);
  }

  function removeOption(i) {
    if (options.length <= 2) return;
    setOptions(options.filter((_, idx) => idx !== i));
  }

  function setOption(i, val) {
    const next = [...options];
    next[i] = val;
    setOptions(next);
  }

  async function handleSubmit() {
    const q = question.trim();
    const opts = options.map((o) => o.trim()).filter(Boolean);
    if (!q || opts.length < 2) return;
    setSubmitting(true);
    try {
      await onSubmit({ question: q, options: opts, multiple });
      onClose();
    } catch {
      setSubmitting(false);
    }
  }

  function handleKey(e) {
    if (e.key === 'Escape') onClose();
  }

  const valid = question.trim() && options.filter((o) => o.trim()).length >= 2;

  return (
    <div
      className="fixed inset-0 z-[400] flex items-end md:items-center justify-center p-4 bg-background/60 backdrop-blur-sm"
      onKeyDown={handleKey}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-surface-container-low border border-outline-variant/20 rounded-3xl p-5 w-full max-w-sm shadow-card max-h-[90vh] flex flex-col animate-fade-up">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-headline text-lg font-semibold text-on-surface">Create Poll</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto hide-scrollbar flex flex-col gap-4">
          {/* Question */}
          <div>
            <label className="text-[11px] font-semibold text-on-surface-variant/60 uppercase tracking-widest mb-1.5 block">
              Question
            </label>
            <input
              type="text"
              maxLength={240}
              placeholder="Ask something..."
              value={question}
              autoFocus
              onChange={(e) => setQuestion(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-surface-container border border-outline-variant/20 text-on-surface text-[16px] md:text-sm outline-none focus:border-primary/50 placeholder:text-on-surface-variant/40 transition-colors"
            />
          </div>

          {/* Options */}
          <div>
            <label className="text-[11px] font-semibold text-on-surface-variant/60 uppercase tracking-widest mb-1.5 block">
              Options
            </label>
            <div className="flex flex-col gap-2">
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    maxLength={120}
                    placeholder={`Option ${i + 1}`}
                    value={opt}
                    onChange={(e) => setOption(i, e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (i === options.length - 1) addOption(); } }}
                    className="flex-1 px-4 py-2.5 rounded-2xl bg-surface-container border border-outline-variant/20 text-on-surface text-[16px] md:text-sm outline-none focus:border-primary/50 placeholder:text-on-surface-variant/40 transition-colors"
                  />
                  {options.length > 2 && (
                    <button
                      onClick={() => removeOption(i)}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant/40 hover:text-error hover:bg-error-container/10 transition-colors cursor-pointer flex-shrink-0"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                    </button>
                  )}
                </div>
              ))}
              {options.length < 12 && (
                <button
                  onClick={addOption}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-dashed border-outline-variant/30 text-on-surface-variant/50 hover:border-primary/40 hover:text-primary text-sm transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
                  Add option
                </button>
              )}
            </div>
          </div>

          {/* Multiple choice toggle */}
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-sm text-on-surface font-medium">Multiple answers</p>
              <p className="text-[11px] text-on-surface-variant/50">Allow selecting more than one</p>
            </div>
            <button
              onClick={() => setMultiple((v) => !v)}
              className="cursor-pointer flex-shrink-0"
              aria-label="Toggle multiple choice"
            >
              <div className={`relative w-11 h-6 rounded-full transition-colors ${multiple ? 'bg-primary' : 'bg-outline-variant/40'}`}>
                <span className={`absolute top-0.5 bottom-0.5 aspect-square bg-white rounded-full shadow-sm transition-all duration-200 ${multiple ? 'right-0.5' : 'left-0.5'}`} />
              </div>
            </button>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!valid || submitting}
          className={`mt-5 w-full py-3.5 rounded-2xl text-sm font-semibold transition-all ${
            valid && !submitting
              ? 'bg-primary text-on-primary hover:brightness-110 active:scale-[0.98] cursor-pointer shadow-glow'
              : 'bg-surface-container text-on-surface-variant/30 cursor-default'
          }`}
        >
          {submitting ? 'Creating…' : 'Create Poll'}
        </button>
      </div>
    </div>
  );
}
