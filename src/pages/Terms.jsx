import { useNavigate } from 'react-router-dom';

function Section({ title, children }) {
  return (
    <div className="mb-10">
      <h2 className="font-headline text-xl font-bold text-on-surface mb-3">{title}</h2>
      <div className="text-on-surface-variant text-sm leading-relaxed space-y-3">{children}</div>
    </div>
  );
}

export default function Terms() {
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

        <h1 className="font-headline text-4xl font-bold text-on-surface mb-2">Terms of Use</h1>
        <p className="text-on-surface-variant text-sm mb-12">Last updated: August 2026</p>

        <Section title="1. Who We Are">
          <p>Afterhours is a private community platform for women to discover and attend small, interest-based meetups. By creating an account you confirm that you identify as a woman, that you are at least 18 years old, and that you agree to these terms.</p>
        </Section>

        <Section title="2. Your Account">
          <p>Membership is limited to women aged 18 and over. We ask for your date of birth when you sign up and check it before your account is created. If we find an account belongs to someone under 18, we remove it and the data held for it.</p>
          <p>You are responsible for maintaining the confidentiality of your login credentials. You must not share your account or create accounts on behalf of others. We reserve the right to suspend accounts that violate our community guidelines.</p>
        </Section>

        <Section title="3. Community Standards">
          <p>Afterhours is built on trust. All members are expected to treat each other with respect. Harassment, discrimination, hate speech, or any behaviour that makes another member feel unsafe will result in immediate removal from the platform.</p>
          <p>Event hosts are responsible for ensuring their gatherings are safe, as described, and welcoming to all attendees.</p>
        </Section>

        <Section title="4. Content">
          <p>You retain ownership of any content you post on Afterhours (event descriptions, profile information, chat messages). By posting, you grant us a non-exclusive licence to display that content within the platform.</p>
          <p>We reserve the right to remove any content that violates our community standards or applicable law.</p>
        </Section>

        <Section title="5. Limitation of Liability">
          <p>Afterhours provides a platform for community members to connect. We are not responsible for the conduct of members at events, the accuracy of event descriptions, or any loss or damage arising from attendance at a listed event.</p>
        </Section>

        <Section title="6. Changes to These Terms">
          <p>We may update these terms from time to time. We will notify you of significant changes by email or an in-app notice. Continued use of the platform after changes constitutes acceptance of the updated terms.</p>
        </Section>

        <Section title="7. Contact">
          <p>For questions about these terms, please contact us at <a href="mailto:team@joinafterhours.in" className="text-primary hover:underline">team@joinafterhours.in</a>.</p>
        </Section>
      </div>
    </div>
  );
}
