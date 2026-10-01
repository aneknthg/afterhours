import { Outlet } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { useSearch } from '../lib/SearchContext';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import ScrollToTop from '../components/ScrollToTop';
import SearchOverlay from '../components/SearchOverlay';
import ReviewChecker from '../components/ReviewChecker';

/**
 * AppLayout — full app chrome: header, bottom nav, search overlay.
 * Used for all app routes (Discover, MyEvents, EventDetail, etc.).
 * Auth loading is already resolved by the time this renders — ProtectedRoute
 * handles the loading/redirect logic for gated routes.
 */
export default function AppLayout() {
  const { user } = useAuth();
  const { searchOpen, setSearchOpen } = useSearch();

  return (
    <>
      <ScrollToTop />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[200] focus:px-4 focus:py-2 focus:bg-primary focus:text-on-primary focus:rounded-lg focus:text-sm focus:font-bold"
      >
        Skip to content
      </a>
      <Header />

      {/* Bottom padding only clears the BottomNav, which only renders for
          signed-in users; otherwise it leaves 96px of dead space under the footer. */}
      <main id="main-content" className={`pt-16 ${user ? 'pb-24' : ''} md:pb-0`}>
        <Outlet />
      </main>

      {user && <BottomNav />}

      <SearchOverlay isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
      {user && <ReviewChecker />}
    </>
  );
}
