/**
 * Centered empty/zero state: pink-tinted icon chip, serif headline, one-line
 * body, single primary CTA. Reused for Discover's no-city and no-events states.
 *
 * Props:
 *   icon     {string} — Material Symbols icon name
 *   title    {string}
 *   body     {string}
 *   ctaLabel {string} — optional
 *   onCta    {fn}     — optional
 */
export default function EmptyState({ icon, title, body, ctaLabel, onCta }) {
  return (
    <div className="flex flex-col items-center text-center px-8 py-16 max-w-md mx-auto">
      <div className="w-16 h-16 rounded-2xl bg-primary-container/30 flex items-center justify-center mb-5">
        <span className="material-symbols-outlined text-primary text-3xl">{icon}</span>
      </div>
      <h2 className="font-headline text-2xl font-bold text-on-surface mb-2">{title}</h2>
      <p className="text-on-surface-variant text-sm leading-relaxed max-w-xs">{body}</p>
      {ctaLabel && onCta && (
        <button
          onClick={onCta}
          className="mt-6 bg-primary text-on-primary font-semibold text-sm px-7 py-3 rounded-xl hover:brightness-110 active:scale-[0.98] transition-all min-h-[44px]"
        >
          {ctaLabel}
        </button>
      )}
    </div>
  );
}
