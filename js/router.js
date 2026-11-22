import { $, prefersReducedMotion } from './utils/dom.js';

let routes = [];
let current = null;
const navListeners = new Set();

export function defineRoutes(list) {
  routes = list;
}

export function onNavigate(fn) {
  navListeners.add(fn);
  return () => navListeners.delete(fn);
}

export const currentPath = () => location.pathname.replace(/\/+$/, '') || '/';

export function navigate(href, { replace = false } = {}) {
  const url = new URL(href, location.origin);
  if (url.pathname + url.search === location.pathname + location.search) return;
  history[replace ? 'replaceState' : 'pushState'](null, '', url.pathname + url.search + url.hash);
  resolve({ focus: true });
}

function resolve({ focus = false } = {}) {
  const path = currentPath();
  const route = routes.find((r) => r.path === path) ?? routes.find((r) => r.path === '*');
  if (route.redirect) {
    history.replaceState(null, '', route.redirect + location.search);
    return resolve({ focus });
  }

  const swap = () => {
    current?.cleanup?.();
    const outlet = $('#view');
    outlet.replaceChildren();
    current = { route, cleanup: route.view.mount(outlet) };
    navListeners.forEach((fn) => fn(path, route));
    if (focus) {
      window.scrollTo({ top: 0, behavior: 'instant' });
      ($('[data-page-title]', outlet) ?? $('#main')).focus({ preventScroll: true });
    }
  };

  const changingRoute = current && current.route !== route;
  if (changingRoute && document.startViewTransition && !prefersReducedMotion()) {
    document.startViewTransition(swap);
  } else {
    swap();
  }
}

/** Re-mounts the active view (e.g. after a language change). */
export function refresh() {
  current?.cleanup?.();
  current = null;
  resolve();
}

export function startRouter() {
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[data-link]');
    if (!link || event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target) return;
    event.preventDefault();
    navigate(link.getAttribute('href'));
  });
  addEventListener('popstate', () => resolve({ focus: true }));
  resolve();
}
