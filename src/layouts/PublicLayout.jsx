import { Outlet } from 'react-router-dom';
import ScrollToTop from '../components/ScrollToTop';

/**
 * PublicLayout — bare wrapper with no header, bottom nav, or search overlay.
 * Used for: Landing, Auth, Onboarding, Terms, Privacy.
 */
export default function PublicLayout() {
  return (
    <>
      <ScrollToTop />
      <main>
        <Outlet />
      </main>
    </>
  );
}
