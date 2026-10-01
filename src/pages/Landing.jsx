import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SocialLinks, { AppleMark, PlayMark, APP_STORE_URL, PLAY_STORE_URL } from '../components/SocialLinks';

const TRUST = [
  { icon: 'lock',           label: 'Women-only spaces',     color: 'text-primary', bg: 'bg-primary/10' },
  { icon: 'group',          label: 'Never go alone',        color: 'text-primary', bg: 'bg-primary/10' },
  { icon: 'visibility_off', label: 'No public guest lists', color: 'text-primary', bg: 'bg-primary/10' },
];

const STEPS = [
  { n: '01', title: 'Join when ready',  body: 'A simple profile. No bios to optimise, no photos to filter, just you.' },
  { n: '02', title: "See what's on",    body: "Every listing shows the exact place, time, and host before you RSVP." },
  { n: '03', title: 'Show up',          body: 'A room with women who showed up for the same reason you did.' },
];

const WHY_CARDS = [
  { title: 'Not a dating app',     body: 'No matching, no swiping.' },
  { title: 'Verified, women-only', body: 'No exceptions, no public lists.' },
  { title: 'Host your own',        body: 'From a coffee chat for two to a biryani crawl for twenty.' },
];

const EXAMPLE_LISTINGS = [
  { tag: 'Book club',     when: 'Sat, 6:00 PM',  where: 'A cafe in your neighbourhood', host: 'Hosted by Priya · 6 going' },
  { tag: 'Morning tennis', when: 'Sun, 7:00 AM', where: 'A court near you',             host: 'Hosted by Meera · 3 going' },
  { tag: 'Food walk',      when: 'Fri, 8:00 PM', where: 'Your city’s old market',   host: 'Hosted by Sana · 8 going' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionEyebrow({ children }) {
  return (
    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-primary">
      {children}
    </p>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Landing() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('is-visible');
          observer.unobserve(e.target);
        }
      }),
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  function scrollTo(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <div className="min-h-screen bg-background text-on-surface overflow-x-hidden">

      {/* ── Nav ── */}
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-background/70 backdrop-blur-xl border-b border-outline-variant/50'
            : 'bg-transparent'
        }`}
      >
        <nav className="max-w-screen-xl mx-auto px-6 md:px-12 flex items-center justify-between py-4">
          <img src="/logo-white.png" alt="Afterhours" className="h-10 w-auto" />
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/auth')}
              className="text-xs font-semibold px-4 py-3.5 bg-transparent border border-outline-variant/40 text-on-surface-variant rounded-full hover:border-primary/40 hover:text-on-surface transition-[border-color,color] cursor-pointer"
            >
              Sign in
            </button>
          </div>
        </nav>
      </header>

      {/* ── Hero ── */}
      <section className="relative pt-32 pb-28 md:pt-48 md:pb-40 grain">
        <div className="max-w-screen-xl mx-auto px-6 md:px-12 relative">
          {/* Centered editorial copy — staggered entrance */}
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="font-headline text-5xl md:text-6xl lg:text-[4.5rem] font-bold leading-[1.0] text-balance text-on-surface animate-fade-up anim-delay-1">
              Where women{' '}
              <span className="italic text-gradient-warm">meet for real,</span>
              <br className="hidden sm:block" /> over things they love.
            </h1>

            <p className="mx-auto mt-6 max-w-xl text-lg text-on-surface-variant leading-relaxed animate-fade-up anim-delay-2">
              Discover people. Share moments. Just real women you'd
              actually want to know.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center animate-fade-up anim-delay-3">
              <button
                onClick={() => navigate('/auth')}
                className="group inline-flex items-center justify-center gap-2 px-8 py-4 bg-primary text-on-primary font-bold rounded-xl text-sm uppercase tracking-wide hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-[transform,filter,box-shadow] duration-150 shadow-glow glow-pulse cursor-pointer"
              >
                Join Now
                <span className="material-symbols-outlined transition-transform group-hover:translate-x-1" style={{ fontSize: 16 }}>arrow_forward</span>
              </button>
              <button
                onClick={() => scrollTo('how')}
                className="inline-flex items-center justify-center px-8 py-4 bg-transparent border border-outline-variant/40 text-on-surface-variant font-bold rounded-xl text-sm uppercase tracking-wide hover:border-primary/40 hover:text-on-surface transition-[border-color,color] cursor-pointer"
              >
                How it works
              </button>
            </div>

            <div className="mt-4 flex flex-col sm:flex-row gap-3 justify-center animate-fade-up anim-delay-4">
              {[
                { href: APP_STORE_URL,  label: 'Download on the App Store', mark: <AppleMark className="w-5 h-5 shrink-0" /> },
                { href: PLAY_STORE_URL, label: 'Get it on Google Play',     mark: <PlayMark className="w-5 h-5 shrink-0" /> },
              ].map(({ href, label, mark }) => (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2.5 px-7 py-4 bg-surface-container-high border border-outline-variant/30 text-on-surface font-bold rounded-xl text-sm uppercase tracking-wide hover:bg-surface-container-highest hover:border-outline-variant/60 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-[transform,background-color,border-color] duration-150"
                >
                  {mark}
                  {label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Trust strip ── */}
      <section id="trust" className="border-y border-outline-variant/60 bg-surface-container-lowest/60">
        <div className="max-w-screen-xl mx-auto px-6 md:px-12 py-6">
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {TRUST.map(({ icon, label, color, bg }) => (
              <div key={label} className="flex items-center gap-2.5 text-sm text-on-surface-variant">
                <span className={`grid h-8 w-8 place-items-center rounded-full ${bg} ${color}`}>
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{icon}</span>
                </span>
                <span className="font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Preview — browse before you sign up ── */}
      <section id="preview" className="max-w-screen-xl mx-auto px-6 md:px-12 py-12 md:py-20">
        <div className="text-center max-w-2xl mx-auto mb-10 reveal">
          <SectionEyebrow>See it before you sign up</SectionEyebrow>
          <h2 className="font-headline text-3xl md:text-4xl font-bold leading-[1.05] text-balance text-on-surface">
            What a listing looks like
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {EXAMPLE_LISTINGS.map(({ tag, when, where, host }, i) => (
            <div
              key={tag}
              className={`relative rounded-2xl border border-outline-variant bg-surface-container/50 p-5 backdrop-blur-sm reveal reveal-d${i + 1}`}
            >
              <span className="absolute top-4 right-4 text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant/60 bg-surface-container-high px-2 py-1 rounded-full">
                Example
              </span>
              <span className="inline-block text-xs font-semibold uppercase tracking-wide text-primary mb-3">
                {tag}
              </span>
              <p className="font-headline text-lg font-semibold text-on-surface">{when}</p>
              <p className="text-sm text-on-surface-variant mt-1">{where}</p>
              <p className="text-sm text-on-surface-variant/80 mt-3">{host}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Editorial split — Why Afterhours ── */}
      <section id="about" className="max-w-screen-xl mx-auto px-6 md:px-12 py-12 md:py-32">
        <div className="space-y-12 md:space-y-14">
          <div className="mx-auto max-w-3xl text-center">
            <div className="reveal">
              <SectionEyebrow>Why Afterhours</SectionEyebrow>
              <h2 className="font-headline text-4xl md:text-5xl font-bold leading-[1.05] text-balance text-on-surface">
                Built for <span className="italic text-primary">shared interests. </span>
                real connections, not another contact list.
              </h2>
            </div>

            <ul className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-5 text-left">
              {WHY_CARDS.map(({ title, body }, i) => (
                <li key={title} className={`rounded-2xl border border-outline-variant bg-surface-container/50 p-5 backdrop-blur-sm reveal reveal-d${i + 1}`}>
                  <span className="mb-4 block h-1.5 w-10 rounded-full bg-gradient-warm" />
                  <h3 className="font-headline text-lg font-semibold text-on-surface">{title}</h3>
                  <p className="mt-1.5 text-sm text-on-surface-variant">{body}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" className="max-w-screen-xl mx-auto px-6 md:px-12 py-12 md:py-32 border-t border-outline-variant/20">
        <div className="text-center max-w-2xl mx-auto mb-16 reveal">
          <SectionEyebrow>Simple by design</SectionEyebrow>
          <h2 className="font-headline text-4xl md:text-5xl font-bold leading-[1.05] text-balance text-on-surface">
            Three steps to your first <span className="italic">Afterhours</span>.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {STEPS.map(({ n, title, body }, i) => (
            <div
              key={n}
              className={`group relative rounded-3xl border border-outline-variant bg-surface-container/60 p-8 backdrop-blur-sm hover:border-primary/40 hover:bg-surface-container-high/60 transition-all duration-300 reveal reveal-d${i + 1}`}
            >
              <div className="flex items-baseline gap-4 mb-4">
                <span className="font-headline text-5xl italic text-primary/30 group-hover:text-primary/50 transition-colors">
                  {n}
                </span>
                {i < STEPS.length - 1 && (
                  <span className="hidden md:block flex-1 h-px bg-gradient-to-r from-outline-variant to-transparent" />
                )}
              </div>
              <h3 className="font-headline text-2xl font-bold mb-2 text-on-surface">{title}</h3>
              <p className="text-on-surface-variant text-sm leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="max-w-screen-xl mx-auto px-6 md:px-12 pb-12 md:pb-32">
        <div className="relative overflow-hidden rounded-[2rem] border border-outline-variant bg-surface-container px-8 py-16 md:px-16 md:py-24 text-center grain">
          <div className="absolute inset-0 bg-gradient-glow opacity-90 pointer-events-none" />
          <div className="absolute -top-20 left-1/2 h-72 w-[120%] -translate-x-1/2 bg-primary/15 blur-3xl pointer-events-none" />

          <div className="relative max-w-2xl mx-auto px-4 reveal">
            <h2 className="font-headline text-4xl md:text-6xl font-bold leading-[1.1] text-balance text-on-surface">
              Your next <span className="italic text-gradient-warm">favourite&nbsp;friend</span>{' '}
              is probably free this Thursday.
            </h2>
            <p className="mt-6 text-on-surface-variant max-w-md mx-auto">
              Join the founding circle.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => navigate('/auth')}
                className="group inline-flex items-center justify-center gap-2 px-8 py-4 bg-primary text-on-primary font-bold rounded-xl text-sm uppercase tracking-wide hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-150 shadow-glow cursor-pointer"
              >
                Reserve your seat
                <span className="material-symbols-outlined transition-transform group-hover:translate-x-1" style={{ fontSize: 16 }}>arrow_forward</span>
              </button>
            </div>
            <p className="mt-5 text-xs text-on-surface-variant/70">
              Free to join · Verified women only · No credit card
            </p>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-outline-variant/20 bg-surface-container-lowest">
        <div className="max-w-screen-xl mx-auto px-6 md:px-12 py-14">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
            <div className="md:col-span-5">
              <img src="/logo-white.png" alt="Afterhours" className="h-10 w-auto" />
              <p className="mt-3 text-sm text-on-surface-variant max-w-xs leading-relaxed">
                A women-only space for meeting people worth knowing.
              </p>
              <SocialLinks className="mt-5" />
            </div>

            <div className="md:col-span-7 grid grid-cols-3 gap-4 sm:gap-8">
              <div>
                <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.15em] sm:tracking-[0.2em] text-on-surface mb-3 sm:mb-4">Discover</p>
                <ul className="space-y-1 text-sm text-on-surface-variant">
                  <li><button onClick={() => navigate('/discover')} className="py-3 hover:text-on-surface transition-colors cursor-pointer">Events</button></li>
                  <li><button onClick={() => navigate('/hosts')} className="py-3 hover:text-on-surface transition-colors cursor-pointer">Hosts</button></li>
                  <li><button onClick={() => navigate('/cities')} className="py-3 hover:text-on-surface transition-colors cursor-pointer">Cities</button></li>
                </ul>
              </div>
              <div>
                <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.15em] sm:tracking-[0.2em] text-on-surface mb-3 sm:mb-4">Company</p>
                <ul className="space-y-1 text-sm text-on-surface-variant">
                  <li><button onClick={() => navigate('/about')} className="py-3 hover:text-on-surface transition-colors cursor-pointer">About</button></li>
                  <li><button onClick={() => navigate('/manifesto')} className="py-3 hover:text-on-surface transition-colors cursor-pointer">Manifesto</button></li>
                  <li><button onClick={() => navigate('/press')} className="py-3 hover:text-on-surface transition-colors cursor-pointer">Press</button></li>
                </ul>
              </div>
              <div>
                <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.15em] sm:tracking-[0.2em] text-on-surface mb-3 sm:mb-4">Trust</p>
                <ul className="space-y-1 text-sm text-on-surface-variant">
                  <li><button onClick={() => navigate('/safety')} className="py-3 hover:text-on-surface transition-colors cursor-pointer">Safety</button></li>
                  <li><button onClick={() => navigate('/privacy')} className="py-3 hover:text-on-surface transition-colors cursor-pointer">Privacy</button></li>
                  <li><button onClick={() => navigate('/terms')} className="py-3 hover:text-on-surface transition-colors cursor-pointer">Terms</button></li>
                </ul>
              </div>
            </div>
          </div>

        </div>
      </footer>

    </div>
  );
}
