import { useLocation, useNavigate } from 'react-router-dom';

const ITEMS = [
  { path: '/discover',  icon: 'explore',      label: 'Discover' },
  { path: '/my-events', icon: 'event',        label: 'Events' },
  { path: '/create',    icon: 'add_circle',   label: 'Create' },
  { path: '/chat',      icon: 'chat_bubble',  label: 'Chat' },
  { path: '/profile',   icon: 'person',       label: 'Profile' },
];

// Pages where the bottom nav should be hidden — inputs fill the viewport
// on mobile and the nav bar sits on top of the keyboard area.
const HIDDEN_PATHS = ['/create'];

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  if (HIDDEN_PATHS.includes(location.pathname)) return null;

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 bg-surface-container-low/90 backdrop-blur-2xl flex justify-around items-stretch px-2 pt-1.5 md:hidden border-t border-outline-variant/10"
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
    >
      {ITEMS.map((item) => {
        const isActive = location.pathname === item.path;
        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`bottom-nav-item flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 py-1 rounded-lg active:scale-95 transition-all ${
              isActive ? 'active text-primary' : 'text-on-surface-variant/60'
            }`}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 22 }}>{item.icon}</span>
            <span className="font-body text-[10px] font-semibold tracking-wide leading-none">
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
