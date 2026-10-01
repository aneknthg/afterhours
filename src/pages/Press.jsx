import { useNavigate } from 'react-router-dom';

const FACTS = [
  { label: 'Founded',    value: 'January 2026' },
  { label: 'HQ',         value: 'Hyderabad, India' },
  { label: 'Members',    value: 'Accepting founding members' },
  { label: 'Focus',      value: 'Women-only social discovery' },
  { label: 'Stage',      value: 'Seed / private beta' },
];

export default function Press() {
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

        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-primary">Media</p>
        <h1 className="font-headline text-4xl md:text-5xl font-bold text-on-surface mb-6 leading-tight text-balance">
          Press &amp; <span className="italic">Media.</span>
        </h1>
        <p className="text-on-surface-variant leading-relaxed mb-12 text-lg">
          We talk to journalists, researchers, and podcasters covering women's social lives,
          urban loneliness, or what real-world connection looks like now.
        </p>

        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6 mb-12">
          <p className="text-sm font-semibold text-on-surface mb-1">Press enquiries</p>
          <a
            href="mailto:team@joinafterhours.in"
            className="text-primary hover:underline font-medium"
          >
            team@joinafterhours.in
          </a>
          <p className="mt-3 text-xs text-on-surface-variant">
            We try to respond within 48 hours.
          </p>
        </div>

        <h2 className="font-headline text-xl font-bold text-on-surface mb-5">Company facts</h2>
        <div className="divide-y divide-outline-variant/30 mb-12">
          {FACTS.map(({ label, value }) => (
            <div key={label} className="flex justify-between py-3.5 text-sm">
              <span className="text-on-surface-variant">{label}</span>
              <span className="text-on-surface font-medium">{value}</span>
            </div>
          ))}
        </div>

        <h2 className="font-headline text-xl font-bold text-on-surface mb-5">Boilerplate</h2>
        <div className="rounded-2xl border border-outline-variant bg-surface-container/50 p-6 text-sm text-on-surface-variant leading-relaxed">
          <p>
            Afterhours is a women-only platform for discovering and attending small social
            events. Founded in Hyderabad in 2026, it helps women build real friendships through
            shared-interest gatherings, and is now live in cities across India. Safety and privacy are built in, not bolted on.
            The platform is currently in private beta.
          </p>
        </div>

      </div>
    </div>
  );
}
