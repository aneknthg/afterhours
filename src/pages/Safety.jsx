import { useNavigate } from 'react-router-dom';

// What we do. Kept to what the platform actually enforces, so nothing here
// promises more than the product delivers.
const PILLARS = [
  {
    icon: 'verified_user',
    title: 'Verified at sign-up',
    body: "Only women can RSVP to an event and interact with other users at Afterhours. This is ensured by a facial recognition verification system which only permits women to use the platform. Passing that check is what opens up the social side. It isn't perfect, so if it ever rejects you by mistake, email us and we'll sort it out by hand.",
  },
  {
    icon: 'visibility_off',
    title: 'No public guest lists',
    body: "Who's attending an event is visible only to other confirmed attendees of that event, not to the general public or to people who browse but don't RSVP.",
  },
  {
    icon: 'flag',
    title: 'Easy reporting',
    body: 'Every profile and every event has a one-tap report button. Reports go directly to our team. We aim to review all reports within 24 hours and take action accordingly.',
  },
  {
    icon: 'lock',
    title: 'Your data, your control',
    body: "We don't share your contact details with anyone. Your email is never shown publicly. You can delete your account and all associated data at any time.",
  },
];

// What we suggest you do. Advice rather than enforcement, which is why it sits
// in its own section instead of mixed in with the pillars above.
const GUIDELINES = [
  {
    title: 'Look through the event.',
    body: "Don't go to any event blind. Know where you're going, what the event involves, and who is hosting it before you RSVP. In case of any doubts, you can always reach out to us.",
  },
  {
    title: "Check who's going.",
    body: 'You can see other confirmed attendees and their profiles before an event. Take a look, but remember that a profile can only tell you so much about someone.',
  },
  {
    title: 'Be aware of any last minute changes to the event.',
    body: "There are a lot of reasons for the venue or timings of the event to change, but if you feel unsure or unsafe about it, then you don't have to go to that event. And if it seems shady, feel free to report it to us.",
  },
  {
    title: "Tell someone where you're going.",
    body: "Especially if you're going alone and you're meeting people you haven't met before, consider sharing the event details and location with a friend or a family member.",
  },
  {
    title: "While you're there",
    body: "You don't owe anyone your time, attention, contact details, or company. If a conversation makes you uncomfortable, you can leave it. If an event doesn't feel right, you can leave the event. If you need help, reach out to the event host, venue staff, or someone you trust.",
  },
  {
    title: "If something doesn't feel right",
    body: "You can block or report another member directly through Afterhours. Reports help us understand what's happening on the platform and take action where appropriate. We may suspend or remove accounts that violate our community guidelines or create a safety concern.",
  },
];

export default function Safety() {
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

        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-primary">How we protect you</p>
        <h1 className="font-headline text-4xl md:text-5xl font-bold text-on-surface mb-6 leading-tight text-balance">
          Safety at <span className="italic">Afterhours.</span>
        </h1>

        <div className="space-y-4 text-on-surface-variant leading-relaxed mb-16 text-lg">
          <p>Safety isn&rsquo;t a setting. It&rsquo;s part of how Afterhours works.</p>
          <p>
            We want Afterhours to make meeting new people feel easier, more comfortable,
            and a little less uncertain. We built the platform with that idea in mind.
          </p>
          <p>
            But Afterhours is a platform for discovering and joining events. Most events
            are hosted by other users on the platform, and so we have supervision but no
            control over the conduction of the event.
          </p>
          <p>
            So aside from what&rsquo;s out of our hands, we are doing everything we can to
            ensure that you feel safe using Afterhours. Here&rsquo;s how:
          </p>
        </div>

        <div className="space-y-8">
          {PILLARS.map(({ icon, title, body }) => (
            <div key={title} className="flex gap-5">
              <div className="shrink-0 grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary mt-0.5">
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{icon}</span>
              </div>
              <div>
                <h2 className="font-headline text-lg font-bold text-on-surface mb-1.5">{title}</h2>
                <p className="text-on-surface-variant text-sm leading-relaxed">{body}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-20 pt-10 border-t border-outline-variant">
          <h2 className="font-headline text-2xl font-bold text-on-surface mb-3">
            While we do our part
          </h2>
          <p className="text-on-surface-variant leading-relaxed mb-10">
            Here are some guidelines we&rsquo;d suggest you follow. A few simple things can
            make a difference:
          </p>

          <div className="space-y-7">
            {GUIDELINES.map(({ title, body }) => (
              <div key={title}>
                <h3 className="font-headline text-base font-bold text-on-surface mb-1.5">{title}</h3>
                <p className="text-on-surface-variant text-sm leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 rounded-2xl border border-outline-variant bg-surface-container/50 p-6">
          <p className="text-sm font-semibold text-on-surface mb-2">In an emergency</p>
          <p className="text-sm text-on-surface-variant">
            If you&rsquo;re in immediate danger or need medical or emergency assistance,
            contact the appropriate local emergency services or venue staff first.
            Afterhours isn&rsquo;t an emergency service.
          </p>
        </div>

        <div className="mt-12">
          <h2 className="font-headline text-2xl font-bold text-on-surface mb-3">
            A note about events
          </h2>
          <div className="space-y-4 text-on-surface-variant text-sm leading-relaxed">
            <p>
              Afterhours helps you discover and connect around events, but we are not the
              host, organiser, or venue for every event listed on the platform.
            </p>
            <p>
              The event host or venue is in charge of the conduction of the event,
              including the physical space, staff, activities, and on-the-ground safety.
            </p>
            <p>
              We take reports and concerns about our platform seriously and will do what we
              reasonably can when something is brought to our attention. But we can&rsquo;t
              guarantee the safety, conduct, quality, or experience of an event hosted by
              someone else.
            </p>
          </div>
        </div>

        <div className="mt-16 rounded-2xl border border-outline-variant bg-surface-container/50 p-6">
          <p className="text-sm font-semibold text-on-surface mb-2">Something doesn&rsquo;t feel right?</p>
          <p className="text-sm text-on-surface-variant mb-4">
            If something happened at an Afterhours event that made you feel unsafe,
            reach out. Every report goes to a real person.
          </p>
          <a
            href="mailto:team@joinafterhours.in"
            className="text-primary hover:underline text-sm font-medium"
          >
            team@joinafterhours.in
          </a>
        </div>
      </div>
    </div>
  );
}
