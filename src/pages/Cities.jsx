import { useNavigate } from 'react-router-dom';
import { CITIES, POPULAR_CITIES } from '../lib/city';

// Every city a member can pick is a live city, so this page reads from the same
// list as the city picker instead of keeping its own copy that can drift.
const OTHER_CITIES = CITIES.filter((c) => !POPULAR_CITIES.includes(c));

export default function Cities() {
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

        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-primary">Where we are</p>
        <h1 className="font-headline text-4xl md:text-5xl font-bold text-on-surface mb-6 leading-tight text-balance">
          Afterhours <span className="italic">cities.</span>
        </h1>
        <p className="text-on-surface-variant leading-relaxed mb-12 text-lg">
          Afterhours is live across India. Pick your city when you join and you'll see
          events and women near you. Nothing on yet? Host the first one.
        </p>

        <h2 className="font-headline text-xl font-bold text-on-surface mb-5">Now live</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
          {POPULAR_CITIES.map((city) => (
            <div
              key={city}
              className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 px-5 py-4"
            >
              <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/15 text-primary">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>location_on</span>
              </span>
              <span className="font-semibold text-on-surface">{city}</span>
            </div>
          ))}
        </div>

        <h2 className="font-headline text-xl font-bold text-on-surface mb-4">Also live in</h2>
        <p className="text-sm text-on-surface-variant leading-relaxed mb-12">
          {OTHER_CITIES.join(' · ')}
        </p>

        <div className="rounded-2xl border border-outline-variant bg-surface-container/50 p-6">
          <p className="text-sm font-semibold text-on-surface mb-2">Your city, your first event</p>
          <p className="text-sm text-on-surface-variant mb-4">
            Every city starts with one person putting something on the calendar.
            Join, pick your city, and see what's on or host something yourself.
          </p>
          <button
            onClick={() => navigate('/auth')}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary font-bold rounded-xl text-sm uppercase tracking-wide hover:brightness-110 transition-all cursor-pointer"
          >
            Join now
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>arrow_forward</span>
          </button>
        </div>
      </div>
    </div>
  );
}
