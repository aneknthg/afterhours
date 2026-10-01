import { useNavigate } from 'react-router-dom';

function Section({ title, children }) {
  return (
    <div className="mb-10">
      <h2 className="font-headline text-xl font-bold text-on-surface mb-3">{title}</h2>
      <div className="text-on-surface-variant text-sm leading-relaxed space-y-3">{children}</div>
    </div>
  );
}

function SubHeading({ children }) {
  return <p className="font-semibold text-on-surface pt-1">{children}</p>;
}

function List({ items }) {
  return (
    <ul className="list-disc pl-5 space-y-1.5 marker:text-outline-variant">
      {items.map((item) => <li key={item}>{item}</li>)}
    </ul>
  );
}

function Mail({ address }) {
  return <a href={`mailto:${address}`} className="text-primary hover:underline">{address}</a>;
}

export default function Privacy() {
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

        <h1 className="font-headline text-4xl font-bold text-on-surface mb-2">Privacy Policy</h1>
        <p className="text-on-surface-variant text-sm mb-10">Last updated: 19 August 2026</p>

        <div className="text-on-surface-variant text-sm leading-relaxed space-y-3 mb-12">
          <p>Afterhours is a women-exclusive platform that enables users to discover, host, participate in, and engage with hobby, social, educational, networking, and professional meetups and events.</p>
          <p>This Privacy Policy explains how we collect, use, store, disclose, transfer, and otherwise process your personal data when you access or use our website, mobile application, services, events, communications, and related features (collectively, the “Services”).</p>
          <p>We are committed to protecting your privacy and handling your personal data responsibly, securely, and in compliance with applicable laws, including the Digital Personal Data Protection Act, 2023 (“DPDP Act”), and other applicable Indian laws.</p>
          <p>By creating an account, accessing, or using the Services, you acknowledge that you have read and understood this Privacy Policy.</p>
        </div>

        <Section title="1. Why We Have a Privacy Policy">
          <p>1.1. This privacy policy (Privacy Policy) governs the collection, use, disclosure, transfer, retention, and other processing of personal data (collectively, Information) by Afterhours (us, we, our).</p>
          <p>1.2. This Privacy Policy shall be applicable to any person or entity (you, your) that accesses our website joinafterhours.in (“Website”) or has shared any Information with us. We value your privacy, and our organization is committed to safeguarding your information and ensuring its security.</p>
        </Section>

        <Section title="2. Definitions">
          <p>2.1. “Personal Data” means any data about an individual who is identifiable by or in relation to such data.</p>
          <p>2.2. “Processing” includes collection, storage, use, disclosure, transfer, sharing, deletion, or any other operation performed on personal data.</p>
          <p>2.3. “User” means any person who accesses or uses the Platform.</p>
          <p>2.4. “Event Host” means a user who creates or hosts an event through the Platform.</p>
        </Section>

        <Section title="3. What Information We Collect">
          <p>3.1. Personal data means any information relating to an identified or identifiable natural person. We collect your Information when you access our website or communicate with us through email or other digital channels. We collect information directly from users, automatically through the Platform, and from trusted third-party service providers.</p>
          <p>3.2. When you register for an account, we may collect:</p>
          <List items={[
            'Name',
            'Display name or username',
            'Email address',
            'Phone number (optional)',
            'User ID (UUID)',
            'Password credentials (stored securely through authentication providers)',
            'Email verification status',
            'Account status',
            'User role and permissions',
          ]} />
          <p>3.3. Profile Information. You may need to provide:</p>
          <List items={[
            'Profile photograph (mandatory, for the process of verification)',
            'Biography or personal description',
            'Professional information',
            'Interests and hobbies',
            'Location information voluntarily provided',
            'Social media links',
            'Other profile details voluntarily shared by you',
          ]} />
          <p>Certain profile information may be visible to other users.</p>
          <p>3.4. Identity Verification Information: To maintain the safety and integrity of our women-exclusive community, we may collect and process identity verification information. This may include:</p>
          <List items={[
            'Verification photographs or selfies',
            'A short live camera recording captured during the liveness check',
            'An estimated gender classification and its confidence score, derived from facial analysis',
            'Verification status',
            'Identity verification results, including a facial similarity score',
            'Fraud prevention indicators',
          ]} />
          <p>Identity verification is conducted using third-party verification providers, including Amazon Web Services (AWS) and its Rekognition Face Liveness technology. It involves facial analysis: a live camera session confirms that a real person is present, an image captured during that session is compared against your profile photograph to confirm they are the same person, and facial analysis produces an estimated gender classification used to determine eligibility for our women-exclusive community.</p>
          <p>We do not retain the live camera recording or the images captured during the liveness check, and we do not create or store a biometric template or faceprint. What we retain is the outcome: the verification result, the facial similarity score, the estimated gender classification and its confidence score, and session identifiers used to prevent a verification session being reused. Your profile photograph is retained separately as part of your profile, as described above. AWS processes the live session under its own terms as our processor.</p>
          <p>Identity verification is optional. You may use Afterhours without verifying, with limited access to community features, and you are asked for explicit consent before any facial analysis takes place. Verification information is processed solely for identity verification, fraud prevention, security, legal compliance, and community safety purposes, and is never used for advertising, profiling or tracking.</p>
          <p>3.5. We also collect Data when you use the Website or any mobile applications, including data collected automatically such as device ID, IP address, web browser type, page views, operating system, timing and frequency of use of the Website or application, and application/website navigation.</p>
          <p>3.6. We collect and process only the personal data that is necessary and relevant for the purposes stated in this Privacy Policy. We do not retain or request information beyond what is required to deliver our services, fulfill legal obligations, or improve user experience. Unnecessary or outdated data is securely deleted in accordance with our data retention policies.</p>
        </Section>

        <Section title="4. Event Information">
          <p>When using event-related features, we may collect:</p>
          <List items={[
            'Events created',
            'Event descriptions',
            'Event categories',
            'Event dates and locations',
            'Event attendance information',
            'RSVPs',
            'Event participation history',
            'Event photographs and media',
            'Event reviews and ratings',
            'Event engagement metrics',
          ]} />
        </Section>

        <Section title="5. Messaging and Communications">
          <p>When you use communication features, we may collect:</p>
          <List items={[
            'Chat messages',
            'Message content',
            'Message timestamps',
            'Attachments and images shared through chats',
            'Communication metadata',
            'Message reports',
            'Message moderation information',
            'Message rate-limiting information',
          ]} />
          <p>Messages may be retained for safety, fraud prevention, dispute resolution, and legal compliance purposes.</p>
        </Section>

        <Section title="6. Community and Safety Information">
          <p>To maintain a safe platform, we may collect:</p>
          <List items={[
            'User reports',
            'Content reports',
            'Event reports',
            'Message reports',
            'Moderation records',
            'Enforcement actions',
            'Account restrictions',
            'User block lists',
            'Safety investigation records',
          ]} />
        </Section>

        <Section title="7. User Activity Information">
          <p>We may collect information relating to your use of the Platform, including:</p>
          <List items={[
            'Event views',
            'Event bookmarks',
            'Connections with other users',
            'Poll responses and votes',
            'Reviews and ratings',
            'Feature usage',
            'Search activity',
            'User preferences',
            'Notification interactions',
          ]} />
        </Section>

        <Section title="8. Payment Information">
          <p>Where paid events or paid services are offered, we may collect:</p>
          <List items={[
            'Transaction identifiers',
            'Payment confirmations',
            'Billing information',
            'Payment history',
            'Refund information',
          ]} />
          <p>We do not store complete debit card, credit card, or payment authentication information. Card and UPI payments for tickets are processed through a secure third-party payment service provider, and the card or UPI credentials you enter during checkout are collected by that provider and never reach our systems.</p>

          <SubHeading>Host payout details</SubHeading>
          <p>We collect payout details only from hosts who choose to host a paid event. If you only attend events, or only host free events, we never ask for and never hold these details.</p>
          <p>Depending on how you choose to be paid, this means either:</p>
          <List items={[
            'Your UPI ID; or',
            'Your bank account number, the account holder name, and the IFSC of your branch.',
          ]} />
          <p>We hold these details because we settle a host&rsquo;s earnings ourselves rather than through the payment provider, and we cannot transfer money to you without them. They are used for that single purpose — paying you what you have earned, and meeting the tax and record-keeping obligations that come with doing so. We do not use them for any other purpose, and we do not share them with other users, hosts, or attendees. No host payout detail is ever shown on your public profile or to anyone attending your event.</p>
          <p>Access is restricted to your own account: our database permits each host to read and write only her own payout row. You can view, change, or remove your payout details at any time from the Earnings screen in the app, and removing them stops future transfers. Where we are required to retain a record of payments already made to you, we keep the minimum needed to satisfy that obligation.</p>
        </Section>

        <Section title="9. Device and Technical Information">
          <p>We may automatically collect:</p>
          <List items={[
            'IP address',
            'Browser type',
            'Device type',
            'Operating system',
            'Device identifiers',
            'Application version',
            'Log data',
            'Error reports',
            'Diagnostic information',
            'Usage analytics',
          ]} />
        </Section>

        <Section title="10. Notifications">
          <p>We may collect and process:</p>
          <List items={[
            'Push notification tokens',
            'Notification preferences',
            'Notification delivery information',
            'Notification interaction data',
          ]} />
        </Section>

        <Section title="11. How We Use Your Information">
          <p>We process personal data for the following purposes:</p>
          <List items={[
            'Creating and maintaining accounts',
            'Authenticating users',
            'Identity verification',
            'Enforcing women-exclusive access requirements',
            'Facilitating event participation',
            'Enabling messaging features',
            'Providing customer support',
            'Preventing fraud and abuse',
            'Conducting investigations',
            'Resolving disputes',
            'Improving platform functionality',
            'Personalizing user experience',
            'Sending service-related communications',
            'Sending event-related notifications',
            'Enforcing platform policies',
            'Protecting users and community safety',
            'Complying with legal obligations',
            'Exercising legal rights and defenses',
          ]} />
        </Section>

        <Section title="12. Legal Basis for Processing">
          <p>We process personal data based on:</p>
          <List items={[
            'Consent provided by users',
            'Purposes reasonably necessary for providing the Services requested by users',
            'Compliance with legal obligations',
            'Fraud prevention and security purposes',
            'Grievance handling and dispute resolution',
            'Protection of users and community safety',
            'Other lawful grounds permitted under applicable law',
          ]} />
        </Section>

        <Section title="13. Public Information">
          <p>Certain information may be visible to other users, including:</p>
          <List items={[
            'Display name',
            'Profile picture',
            'Bio',
            'Hosted events',
            'Reviews',
            'Ratings',
            'Public profile details',
          ]} />
          <p>Information that you voluntarily make public may be viewed, copied, or shared by other users.</p>
        </Section>

        <Section title="14. Information Shared with Event Hosts">
          <p>When you RSVP to, attend, or participate in an event, limited profile information may be shared with event hosts and co-hosts to facilitate event management and participation.</p>
        </Section>

        <Section title="15. Information Shared with Other Users">
          <p>Depending on your privacy settings and Platform functionality, other users may see:</p>
          <List items={[
            'Profile information',
            'Event participation information',
            'Reviews and ratings',
            'Community interactions',
          ]} />
        </Section>

        <Section title="16. Third-Party Service Providers">
          <p>We may engage trusted service providers to process personal data on our behalf. These may include:</p>
          <SubHeading>A. Supabase</SubHeading>
          <p>Used for:</p>
          <List items={['Authentication', 'Database management', 'Data storage', 'Backend infrastructure']} />
          <SubHeading>B. Amazon Web Services (AWS)</SubHeading>
          <p>Used for:</p>
          <List items={['Identity verification', 'Cloud services', 'Security operations', 'Infrastructure support']} />
          <SubHeading>C. Payment Service Providers</SubHeading>
          <p>Used for:</p>
          <List items={['Processing payments', 'Managing refunds', 'Fraud prevention']} />
          <SubHeading>D. Email Service Providers</SubHeading>
          <p>Used for:</p>
          <List items={['Sending transactional and service-related email', 'Event and RSVP notifications', 'Account and security communications']} />
        </Section>

        <Section title="17. Disclosure of Information">
          <p>We may disclose personal data:</p>
          <List items={[
            'To service providers',
            'To payment processors',
            'To cloud infrastructure providers',
            'To identity verification providers',
            'To auditors and professional advisers',
            'To law enforcement authorities',
            'To regulatory authorities',
            'To courts and tribunals',
            'During mergers, acquisitions, restructuring, or business transfers',
            'Where required by applicable law',
          ]} />
        </Section>

        <Section title="18. Community Safety and Moderation">
          <p>To protect users and maintain platform integrity, we reserve the right to:</p>
          <List items={[
            'Investigate reports',
            'Review content',
            'Review communications',
            'Restrict accounts',
            'Suspend users',
            'Remove content',
            'Remove events',
            'Cooperate with authorities',
          ]} />
        </Section>

        <Section title="19. Data Retention">
          <p>We retain personal data only for as long as necessary for:</p>
          <List items={[
            'Providing Services',
            'Fulfilling legal obligations',
            'Maintaining security',
            'Preventing fraud',
            'Resolving disputes',
            'Enforcing agreements',
          ]} />
          <p>Certain records such as moderation records, payment records, safety reports, and legal records may be retained for longer periods where required by law or legitimate operational needs.</p>
        </Section>

        <Section title="20. Account Deletion">
          <p>You may delete your Afterhours account at any time. You do not need the app installed to do so. Deletion is permanent and cannot be undone.</p>

          <SubHeading>In the app</SubHeading>
          <p>Open the Profile tab, scroll to the bottom, and tap “Delete account”.</p>

          <SubHeading>On the web</SubHeading>
          <p>Sign in at joinafterhours.in, open your Profile page, and select “Delete account” at the bottom.</p>

          <SubHeading>By email</SubHeading>
          <p>If you no longer have the app or cannot sign in, email <Mail address="team@joinafterhours.in" /> from the address your account is registered with and ask us to delete it. We will verify the request and complete the deletion within 30 days.</p>

          <SubHeading>What deletion removes</SubHeading>
          <p>Deleting your account removes your profile and login credentials, your profile photograph, your messages, your RSVPs and connections, any events you hosted, and your notification and push registration data. All active sessions are invalidated immediately.</p>

          <SubHeading>What we retain, and why</SubHeading>
          <List items={[
            'Safety and moderation records, including reports other users have made about you, so that deleting an account cannot be used to escape a pending report.',
            'Payment and transaction records, where we are required to keep them under applicable tax and financial regulations.',
            'Any other records we are required to retain for legal compliance, fraud prevention, or dispute resolution, as described in Section 19.',
          ]} />
          <p>Retained records are kept only for the purposes above. They are not used to re-identify you on the Platform or to contact you.</p>
        </Section>

        <Section title="21. Your Rights">
          <p>Subject to applicable law, users may have the right to:</p>
          <List items={[
            'Access their personal data',
            'Correct inaccurate data',
            'Update incomplete data',
            'Request erasure of personal data',
            'Withdraw consent',
            'Seek grievance redressal',
            'Nominate another person to exercise rights under applicable law',
            'Lodge complaints before competent authorities',
          ]} />
        </Section>

        <Section title="22. Withdrawal of Consent">
          <p>You may withdraw consent at any time.</p>
          <p>Withdrawal of consent may affect your ability to access certain features of the Platform.</p>
        </Section>

        <Section title="23. Security Measures">
          <p>We implement reasonable technical and organizational measures including:</p>
          <List items={[
            'Encryption',
            'Secure infrastructure',
            'Access controls',
            'Authentication mechanisms',
            'Monitoring systems',
            'Security audits',
            'Data backups',
            'Role-based access restrictions',
          ]} />
          <p>However, no system can guarantee absolute security.</p>
        </Section>

        <Section title="24. Cookies and Similar Technologies">
          <p>We do not use cookies for advertising, ad profiling, or cross-site tracking, and we do not currently place analytics cookies on your device.</p>
          <p>To operate the Services, we store a small amount of information in your browser’s local storage:</p>
          <List items={[
            'An authentication token that keeps you signed in between visits.',
            'RSVPs you make before signing in, so they can be applied to your account once you register.',
            'A record of which events you have already reviewed, so you are not asked to review them twice.',
          ]} />
          <p>This information is stored on your own device, is used only to provide features you have asked for, and can be cleared at any time through your browser settings. Clearing it will sign you out.</p>
          <p>Third-party services may set their own cookies or storage when you interact with them — for example, our payment service provider when you make a payment on the Platform. Those technologies are governed by the privacy policies of the providers concerned.</p>
          <p>If we introduce analytics, advertising, or other non-essential tracking technologies in the future, we will update this Privacy Policy and obtain your consent where required by applicable law.</p>
        </Section>

        <Section title="25. Children’s Privacy">
          <p>Afterhours is intended only for individuals who are at least eighteen (18) years of age or the age of majority applicable in their jurisdiction.</p>
          <p>We do not knowingly collect personal data from children.</p>
        </Section>

        <Section title="26. How You Provide Us Consent">
          <p>26.1. You provide your consent for us to collect and process your personal data in the following ways:</p>
          <List items={[
            'By ticking the confirmation checkbox presented to you during sign-up and onboarding, which states that you accept our Terms and this Privacy Policy.',
            'By voluntarily submitting information through your profile, event listings, RSVPs, messages, reviews, or other communications with us.',
            'By submitting identity verification information when you choose to verify your account.',
            'By continuing to access or use the Services after being notified of this Privacy Policy.',
          ]} />
        </Section>

        <Section title="27. How We Use Cookies">
          <p>27.1. Cookies are a feature of web browsers that allows web servers to temporarily store information within your browser. Most browsers automatically accept cookies. You can accept or reject the cookies we use. If you wish to restrict or block the cookies which are set by our or any other website, you can do this through your browser settings.</p>
          <p>27.2. We do not place advertising or analytics cookies on your device. The storage we do use is limited to what is necessary to operate the Services, and is described in Section 24 above.</p>
          <p>27.3. Blocking or clearing this storage through your browser settings will not prevent you from browsing the Website, but you will be signed out and certain features may not work as expected.</p>
        </Section>

        <Section title="28. Who We Work with to Handle Your Data">
          <p>28.1. We use third-party email service providers to deliver transactional and service-related communications, such as account, verification, RSVP, and event notifications. These providers are described in Section 16 and process your contact information only to deliver those communications on our behalf.</p>
          <p>28.2. We do not currently operate a newsletter and do not send marketing or promotional email. If we introduce such communications, we will obtain your consent where required by applicable law and provide a means to unsubscribe in every message.</p>
          <p>28.3. Other than the service providers described in Section 16, we do not share personally identifiable information collected through these channels with any third party, except as set out in Section 17 (Disclosure of Information).</p>
        </Section>

        <Section title="29. If Your Data Travels Abroad">
          <p>If your data is transferred outside your jurisdiction, we will ensure adequate safeguards are in place to protect your privacy as required by law.</p>
        </Section>

        <Section title="30. Changes to This Privacy Policy">
          <p>We may update this Privacy Policy from time to time.</p>
          <p>Material changes may be communicated through:</p>
          <List items={['Email', 'In-app notifications', 'Platform notices']} />
          <p>Continued use of the Platform after such updates constitutes acknowledgment of the revised Privacy Policy.</p>
        </Section>

        <Section title="31. Grievance Officer">
          <p>For questions, requests, complaints, or privacy concerns, please contact:</p>
          <p>
            Grievance Officer: Sadhika Singh<br />
            Email: <Mail address="sadhikasingh26@gmail.com" />
          </p>
          <p>We will endeavor to respond within timelines prescribed under applicable law.</p>
        </Section>

        <Section title="32. Contact Us">
          <p>If you have questions regarding this Privacy Policy or our privacy practices, please contact:</p>
          <p>
            Email: <Mail address="team@joinafterhours.in" /><br />
            Address: 1-8-50/2, Plot no. 29, Krishna Nagar Colony, P.G. Road, Secunderabad, Telangana, 500003<br />
            Website: <a href="https://www.joinafterhours.in/" className="text-primary hover:underline">https://www.joinafterhours.in/</a>
          </p>
        </Section>
      </div>
    </div>
  );
}
