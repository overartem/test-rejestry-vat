const PREFIX = 'rv:';

export const persisted = {
  get(key, fallback) {
    try {
      const value = localStorage.getItem(PREFIX + key);
      return value == null ? fallback : JSON.parse(value);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      /* storage unavailable (private mode / quota) — state stays in memory */
    }
  },
};

export function createStore(initial, { persist = [] } = {}) {
  let state = initial;
  const listeners = new Set();
  return {
    get: () => state,
    set(patch) {
      const next = typeof patch === 'function' ? patch(state) : patch;
      state = { ...state, ...next };
      for (const key of persist) if (key in next) persisted.set(key, state[key]);
      listeners.forEach((fn) => fn(state, next));
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

/* ---------- URL query state ---------- */

/** Params owned by the demo tooling; they survive view-level query rewrites. */
const PRESERVED_PARAMS = ['state'];

export function readQuery() {
  return Object.fromEntries(new URLSearchParams(location.search));
}

export function writeQuery(params, { push = false } = {}) {
  const current = new URLSearchParams(location.search);
  const next = new URLSearchParams();
  for (const key of PRESERVED_PARAMS) if (current.has(key) && !(key in params)) next.set(key, current.get(key));
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) continue;
    next.set(key, Array.isArray(value) ? value.join(',') : String(value));
  }
  const query = next.toString();
  const url = location.pathname + (query ? `?${query}` : '') + location.hash;
  if (url === location.pathname + location.search + location.hash) return;
  history[push ? 'pushState' : 'replaceState'](history.state, '', url);
}

export function setQueryParam(key, value) {
  const params = new URLSearchParams(location.search);
  if (value == null || value === '') params.delete(key);
  else params.set(key, value);
  const query = params.toString();
  history.replaceState(history.state, '', location.pathname + (query ? `?${query}` : ''));
}
