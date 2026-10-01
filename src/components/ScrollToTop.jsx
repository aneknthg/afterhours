import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

export default function ScrollToTop() {
  const { pathname } = useLocation();
  const navType = useNavigationType();

  useEffect(() => {
    // POP = Back/Forward. Let the browser restore the previous scroll position
    // instead of yanking the user to the top of the page they came from.
    if (navType === 'POP') return;
    window.scrollTo(0, 0);
  }, [pathname, navType]);

  return null;
}
