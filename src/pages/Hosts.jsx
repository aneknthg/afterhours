import { useNavigate } from 'react-router-dom';

const WHAT_HOSTS_DO = [
  { icon: 'edit_note',   text: 'Create an event with a clear format, location, and group size (max 10)' },
  { icon: 'person_add',  text: 'Review RSVPs and confirm your guest list at least 48 hours before' },
  { icon: 'home',        text: 'Host the gathering at a café, studio, your home, or a booked venue' },
  { icon: 'star',        text: 'Facilitate introductions so no one feels like an outsider' },
];

const REQUIREMENTS = [
  'An Afterhours member in good standing',
  'Based in a city where Afterhours operates',
  'Able to host events of 4–10 people',
  'Committed to the women-only community standard',
];

export default function Hosts() {
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

        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-primary">For hosts</p>
        <h1 className="font-headline text-4xl md:text-5xl font-bold text-on-surface mb-6 leading-tight text-balance">
          Open your <span className="italic">room</span> to the right people.
        </h1>
        <p className="text-on-surface-variant leading-relaxed mb-12 text-lg">
          Hosts are what make Afterhours work. If you love bringing people together around something
          you care about (a meal, a craft, a book), this is for you.
        </p>

        <h2 className="font-headline text-xl font-bold text-on-surface mb-5">What hosts do</h2>
        <ul className="space-y-4 mb-12">
          {WHAT_HOSTS_DO.map(({ icon, text }) => (
            <li key={text} className="flex items-start gap-3">
              <span className="material-symbols-outlined text-primary shrink-0 mt-0.5" style={{ fontSize: 18 }}>{icon}</span>
              <p className="text-on-surface-variant text-sm leading-relaxed">{text}</p>
            </li>
          ))}
        </ul>

        <h2 className="font-headline text-xl font-bold text-on-surface mb-5">Requirements</h2>
        <ul className="space-y-2.5 mb-12">
          {REQUIREMENTS.map((req) => (
            <li key={req} className="flex items-center gap-3 text-sm text-on-surface-variant">
              <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>check_circle</span>
              {req}
            </li>
          ))}
        </ul>

        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6 mb-8">
          <p className="text-sm font-semibold text-on-surface mb-1">Ready to host your first event?</p>
          <p className="text-sm text-on-surface-variant mb-4">
            You can create your first event directly from your account. No application, no approval queue.
          </p>
          <button
            onClick={() => navigate('/auth')}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary font-bold rounded-xl text-sm uppercase tracking-wide hover:brightness-110 transition-all cursor-pointer"
          >
            Get started
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>arrow_forward</span>
          </button>
        </div>

        <p className="text-sm text-on-surface-variant">
          Questions about hosting?{' '}
          <a href="mailto:team@joinafterhours.in" className="text-primary hover:underline">
            team@joinafterhours.in
          </a>
        </p>
      </div>
    </div>
  );
}
