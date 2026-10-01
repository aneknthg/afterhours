import { useId } from 'react';

/**
 * Social row using each platform's official mark.
 *
 * Path data is the official artwork, not a redraw: Instagram and Google Play
 * come from simple-icons, LinkedIn from bootstrap-icons (simple-icons dropped
 * it over a trademark request). The Play mark ships as one path holding four
 * facets, split here so each takes its brand colour.
 *
 * The marks sit bare rather than inside outlined circles, since boxing a
 * square tile inside a circle reads as a mismatch. Each link keeps a 44px hit
 * area for touch.
 */

const PLAY_FACETS = [
  { fill: '#34A853', d: 'M13.544 10.989l3.258-3.238L3.45.195a1.466 1.466 0 0 0-.946-.179l11.04 10.973z' },
  { fill: '#4285F4', d: 'M1.337.924a1.486 1.486 0 0 0-.112.568v21.017c0 .217.045.419.124.6l11.155-11.087L1.337.924z' },
  { fill: '#EA4335', d: 'M13.544 13.056l-11 10.933c.298.036.612-.016.906-.183l13.324-7.54-3.23-3.21z' },
  { fill: '#FBBC04', d: 'M22.018 13.298l-3.919 2.218-3.515-3.493 3.543-3.521 3.891 2.202a1.49 1.49 0 0 1 0 2.594z' },
];

const INSTAGRAM_GLYPH =
  'M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077';

const LINKEDIN_TILE =
  'M0 1.146C0 .513.526 0 1.175 0h13.65C15.474 0 16 .513 16 1.146v13.708c0 .633-.526 1.146-1.175 1.146H1.175C.526 16 0 15.487 0 14.854zm4.943 12.248V6.169H2.542v7.225zm-1.2-8.212c.837 0 1.358-.554 1.358-1.248-.015-.709-.52-1.248-1.342-1.248S2.4 3.226 2.4 3.934c0 .694.521 1.248 1.327 1.248zm4.908 8.212V9.359c0-.216.016-.432.08-.586.173-.431.568-.878 1.232-.878.869 0 1.216.662 1.216 1.634v3.865h2.401V9.25c0-2.22-1.184-3.252-2.764-3.252-1.274 0-1.845.7-2.165 1.193v.025h-.016l.016-.025V6.169h-2.4c.03.678 0 7.225 0 7.225z';

export function PlayMark({ className = 'w-6 h-6' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      {PLAY_FACETS.map(({ fill, d }) => (
        <path key={fill} fill={fill} d={d} />
      ))}
    </svg>
  );
}

// Apple mark from simple-icons. Single colour, so it follows currentColor.
const APPLE_GLYPH =
  'M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701';

export const APP_STORE_URL = 'https://apps.apple.com/app/id6784980049';
export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.joinafterhours.app';

export function AppleMark({ className = 'w-6 h-6' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="currentColor" d={APPLE_GLYPH} />
    </svg>
  );
}

export default function SocialLinks({ className = '' }) {
  // useId() emits colons, which are awkward inside url(#…).
  const gradientId = `ig-${useId().replace(/:/g, '')}`;

  const link = 'grid h-11 w-11 place-items-center rounded-full hover:opacity-75 transition-opacity';

  return (
    <div className={`flex items-center ${className}`}>
      <a
        href="https://www.instagram.com/afterhours.women/"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Afterhours on Instagram"
        className={link}
      >
        <svg viewBox="0 0 24 24" className="w-6 h-6">
          <defs>
            <radialGradient id={gradientId} cx="0.3" cy="1.05" r="1.15">
              <stop offset="0" stopColor="#FFD521" />
              <stop offset="0.25" stopColor="#F50000" />
              <stop offset="0.6" stopColor="#B900B4" />
              <stop offset="1" stopColor="#7638FA" />
            </radialGradient>
          </defs>
          <path fill={`url(#${gradientId})`} d={INSTAGRAM_GLYPH} />
        </svg>
      </a>

      <a
        href="https://www.linkedin.com/company/afterhours-community/"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Afterhours on LinkedIn"
        className={link}
      >
        <svg viewBox="0 0 16 16" className="w-6 h-6">
          <path fill="#0A66C2" d={LINKEDIN_TILE} />
        </svg>
      </a>

      <a
        href={APP_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Download Afterhours on the App Store"
        className={`${link} text-on-surface`}
      >
        <AppleMark />
      </a>

      <a
        href={PLAY_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Get Afterhours on Google Play"
        className={link}
      >
        <PlayMark />
      </a>
    </div>
  );
}
