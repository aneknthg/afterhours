import { useNavigate } from 'react-router-dom';

// Published to satisfy Google Play's Child Safety Standards policy, which
// requires Social apps to link externally published standards against child
// sexual abuse and exploitation (CSAE), plus a CSAE point of contact.
//
// Same rule as Safety.jsx: nothing here promises more than the product
// delivers. Each standard below maps to a control that actually exists —
// the 18+ date-of-birth gate in onboarding, the liveness check, in-app
// reporting, and account removal. No response-time commitment is made,
// because there is no staffed triage rota to honour one.
const STANDARDS = [
  {
    icon: 'block',
    title: 'CSAE is prohibited, without exception',
    body:
      'Child sexual abuse and exploitation material, and any content or conduct that sexualises a minor, is forbidden on Afterhours. This covers profiles, photos, event listings, messages and any other content on the platform. There is no context in which it is permitted, and no warning before enforcement.',
  },
  {
    icon: 'no_accounts',
    title: 'Afterhours is for adults only',
    body:
      'Afterhours is an 18+ platform. Date of birth is collected during onboarding and an under-18 date of birth is rejected at sign-up. Accounts we find to belong to a minor are removed, whether or not any other rule was broken.',
  },
  {
    icon: 'verified_user',
    title: 'Every member passes a liveness check',
    body:
      'Before a member can RSVP to an event or message anyone, she completes an on-camera liveness check. It is a deliberate barrier to throwaway and impersonated accounts, which are the accounts most often used to approach minors.',
  },
  {
    icon: 'flag',
    title: 'Anyone can report, from anywhere in the app',
    body:
      'Profiles, events and messages can all be reported from within the app. Reports concerning a minor do not need to come from the person affected, and you do not need an account to raise one with us by email.',
  },
  {
    icon: 'gavel',
    title: 'What we do when we find it',
    body:
      'Confirmed CSAE results in immediate removal of the content and permanent termination of the account, with no appeal. We preserve the associated records and report to the relevant authorities where the law requires it, including under the Protection of Children from Sexual Offences (POCSO) Act and the Information Technology Act and rules made under it.',
  },
  {
    icon: 'mail',
    title: 'Our CSAE point of contact',
    body:
      'Reports and enquiries about child safety, including from law enforcement and child-protection organisations, go to team@joinafterhours.in. Please put CSAE in the subject line so it is not missed among general support mail.',
  },
];

export default function ChildSafety() {
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

        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-primary">Our standards</p>
        <h1 className="font-headline text-4xl md:text-5xl font-bold text-on-surface mb-6 leading-tight text-balance">
          Child safety at <span className="italic">Afterhours.</span>
        </h1>

        <div className="space-y-4 text-on-surface-variant leading-relaxed mb-16 text-lg">
          <p>
            Afterhours is an adults-only platform, and we have no tolerance for child sexual
            abuse and exploitation. This page sets out the standards we hold ourselves to.
          </p>
          <p>
            We publish it because we think anyone deciding whether to trust a platform
            deserves to see its position stated plainly rather than buried in terms of
            service. Everything below describes a control that exists today.
          </p>
        </div>

        <div className="space-y-8">
          {STANDARDS.map(({ icon, title, body }) => (
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

        <div className="mt-16 rounded-2xl border border-on-surface/10 bg-surface/40 p-6">
          <h2 className="font-headline text-lg font-bold text-on-surface mb-2">Reporting to us</h2>
          <p className="text-on-surface-variant text-sm leading-relaxed">
            To report suspected child sexual abuse or exploitation on Afterhours, email{' '}
            <a href="mailto:team@joinafterhours.in?subject=CSAE" className="text-primary hover:underline">
              team@joinafterhours.in
            </a>{' '}
            with CSAE in the subject line, or use the report control on the profile, event
            or conversation in the app.
          </p>
          <p className="text-on-surface-variant text-sm leading-relaxed mt-3">
            If a child is in immediate danger, contact your local emergency services first.
            In India you can also reach Childline on 1098, or report online through the
            National Cyber Crime Reporting Portal at{' '}
            <a
              href="https://cybercrime.gov.in"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              cybercrime.gov.in
            </a>.
          </p>
        </div>

        <p className="mt-10 text-xs text-on-surface-variant/70">
          These standards apply to every part of Afterhours, on the web and in our mobile
          apps. We review them as the platform changes.
        </p>
      </div>
    </div>
  );
}
