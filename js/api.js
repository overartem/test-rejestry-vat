import { getDocuments } from './data/mock.js';

export const DEMO_STATES = ['auto', 'loading', 'empty', 'error'];

export class ApiError extends Error {
  constructor(code) {
    super(code);
    this.name = 'ApiError';
    this.code = code;
  }
}

export function getDemoState() {
  const state = new URLSearchParams(location.search).get('state');
  return DEMO_STATES.includes(state) ? state : 'auto';
}

const latency = () => 380 + Math.random() * 420;

/**
 * Simulated backend call returning both registers for one month.
 * Honours the `?state=` demo override: `loading` never resolves, `empty`
 * returns no documents and `error` rejects like a 503 would.
 */
export function fetchPeriod({ year, month }, { signal } = {}) {
  const demo = getDemoState();
  return new Promise((resolve, reject) => {
    let timer;
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    if (signal?.aborted) return onAbort();
    signal?.addEventListener('abort', onAbort, { once: true });
    if (demo === 'loading') return;

    timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      if (demo === 'error') return reject(new ApiError('SERVICE_UNAVAILABLE'));
      if (demo === 'empty') return resolve({ sales: [], purchase: [] });
      resolve({ sales: getDocuments('sales', year, month), purchase: getDocuments('purchase', year, month) });
    }, latency());
  });
}
