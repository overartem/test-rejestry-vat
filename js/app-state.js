import { createStore, persisted } from './store.js';
import { DEFAULT_LABELS, DEFAULT_DOC_LABELS, NOTIFICATIONS } from './data/mock.js';
import { DEFAULT_PERIOD_CONFIG } from './data/areas.js';

const readNotifications = new Set(persisted.get('readNotifications', []));

export const appStore = createStore(
  {
    theme: persisted.get('theme', 'system'),
    periodConfig: { ...DEFAULT_PERIOD_CONFIG, ...persisted.get('periodConfig', {}) },
    labels: persisted.get('labels', DEFAULT_LABELS),
    docLabels: persisted.get('docLabels', DEFAULT_DOC_LABELS),
    notifications: NOTIFICATIONS.map((n) => ({ ...n, read: readNotifications.has(n.id) })),
  },
  { persist: ['theme', 'periodConfig', 'labels', 'docLabels'] },
);

appStore.subscribe((state, patch) => {
  if ('notifications' in patch) {
    persisted.set('readNotifications', state.notifications.filter((n) => n.read).map((n) => n.id));
  }
});

export const resolvedTheme = () => {
  const { theme } = appStore.get();
  if (theme === 'light' || theme === 'dark') return theme;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};
