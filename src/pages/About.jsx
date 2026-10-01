import { useNavigate } from 'react-router-dom';

export default function About() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background text-on-surface">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-on-surface-variant hover:text-primary transition-colors text-sm mb-10 group"
        >
          <span className="material-symbols-outlined text-base group-hover:-translate-x-0.5 transition-transform">arrow_back</span>
          Back
        </button>

        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-primary">Our story</p>
        <h1 className="font-headline text-4xl md:text-5xl font-bold text-on-surface mb-6 leading-tight text-balance">
          Built for the <span className="italic">in-between</span>.
        </h1>
        <p className="text-on-surface-variant leading-relaxed mb-12 text-lg">
          Afterhours started with a simple frustration: making friends as an adult woman is surprisingly hard.
          Apps designed for dating, networking, or staying in touch with old friends. But nothing for the
          people you haven't met yet who would immediately get you.
        </p>

        <div className="space-y-8 text-on-surface-variant leading-relaxed">
          <p>
            We launched in Hyderabad in early 2026, quietly, with a small founding circle of women
            who were tired of the same two options: big loud social scenes, or staying home. Every
            event was built around a shared interest — a reason to show up, and something to talk
            about once you got there. Today Afterhours is open to women in cities across India.
          </p>
          <p>
            Every design decision has been made with that in mind. No algorithmic feed telling you
            who you should know. Just an evening, a shared interest, and women who showed up for the
            same reason you did.
          </p>
          <p>
            We're not trying to be the biggest social app. We're trying to be the one that actually
            changes your week.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-3 gap-6 border-t border-outline-variant/30 pt-12">
          {[
            { number: 'Open', label: 'Founding membership' },
            { number: 'Coming', label: 'First events soon' },
            { number: '1',    label: 'City (so far)' },
          ].map(({ number, label }) => (
            <div key={label}>
              <p className="font-headline text-3xl font-bold text-on-surface tabular-nums">{number}</p>
              <p className="text-xs text-on-surface-variant mt-1">{label}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-2xl border border-outline-variant bg-surface-container/50 p-6">
          <p className="text-sm text-on-surface-variant">
            Questions about Afterhours?{' '}
            <a href="mailto:team@joinafterhours.in" className="text-primary hover:underline">
              team@joinafterhours.in
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
