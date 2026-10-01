import { useNavigate } from 'react-router-dom';

const TENETS = [
  {
    n: '01',
    title: 'Real rooms, real people.',
    body: 'We exist offline. The app is just how you find the room. Everything that matters happens after you close it.',
  },
  {
    n: '02',
    title: 'Safety is not a feature. It\'s the foundation.',
    body: 'Women-only is not a niche. It\'s the prerequisite for the kind of openness we\'re building toward. Every verification, every setting, every policy exists to protect that.',
  },
  {
    n: '03',
    title: 'No performance required.',
    body: 'You don\'t need a curated bio or a flattering photo. You don\'t need credentials or a network. You need to be a woman who wants to spend a Tuesday evening doing something she actually cares about.',
  },
  {
    n: '04',
    title: 'Friendship is infrastructure.',
    body: 'Loneliness is a public health crisis. We\'re building against it, not with a viral product, but with a hundred quiet evenings that change how someone feels about their city.',
  },
  {
    n: '05',
    title: 'We grow slowly on purpose.',
    body: 'We are not optimising for growth metrics. We are optimising for the moment a member texts a friend and says \u201cI think I actually made a friend tonight.\u201d',
  },
];

export default function Manifesto() {
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

        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-primary">What we believe</p>
        <h1 className="font-headline text-4xl md:text-5xl font-bold text-on-surface mb-6 leading-tight text-balance">
          The Afterhours <span className="italic">Manifesto.</span>
        </h1>

        <p className="text-on-surface-variant leading-relaxed mb-16 text-lg">
          We believe adult women deserve a social life that doesn't feel like an obligation,
          a risk, or an algorithm. We built Afterhours around five principles.
        </p>

        <div className="space-y-12">
          {TENETS.map(({ n, title, body }) => (
            <div key={n} className="flex gap-6">
              <span className="font-headline text-3xl italic text-primary/30 shrink-0 leading-none mt-1">{n}</span>
              <div>
                <h2 className="font-headline text-xl font-bold text-on-surface mb-2">{title}</h2>
                <p className="text-on-surface-variant leading-relaxed text-sm">{body}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-20 border-t border-outline-variant/30 pt-12">
          <p className="font-headline text-2xl italic text-on-surface/60 leading-snug">
            "Your next favourite friend is probably free this Thursday."
          </p>
          <div className="mt-8">
            <button
              onClick={() => navigate('/auth')}
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-on-primary font-bold rounded-xl text-sm uppercase tracking-wide hover:brightness-110 transition-all cursor-pointer"
            >
              Join the founding circle
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
