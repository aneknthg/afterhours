import { useNavigate } from 'react-router-dom';
import SocialLinks from './SocialLinks';

const LINKS = [
  { label: 'Privacy', path: '/privacy' },
  { label: 'Terms',   path: '/terms' },
];

export default function Footer() {
  const navigate = useNavigate();

  return (
    <footer className="w-full py-10 border-t border-outline-variant/15 bg-background">
      <div className="flex flex-col md:flex-row justify-between items-center px-8 gap-4 max-w-screen-2xl mx-auto">
        <button
          className="py-2 hover:opacity-80 transition-opacity"
          onClick={() => navigate('/')}
          aria-label="Afterhours home"
        >
          <img src="/logo-white.png" alt="Afterhours" className="h-10 w-auto" />
        </button>
        <div className="flex gap-8">
          {LINKS.map((link) => (
            <button
              key={link.label}
              onClick={() => navigate(link.path)}
              className="text-xs uppercase tracking-widest text-on-surface-variant hover:text-primary transition-colors cursor-pointer py-3.5"
            >
              {link.label}
            </button>
          ))}
        </div>
        <SocialLinks />
      </div>
    </footer>
  );
}
