import { defineRoutes, startRouter, refresh } from './router.js';
import { onLangChange } from './i18n.js';
import { initShell, renderShell } from './components/shell.js';
import { initPopovers } from './components/menus.js';
import { areasView } from './views/areas.js';
import { registersView } from './views/registers.js';
import { placeholderView, notFoundView } from './views/placeholder.js';

defineRoutes([
  { path: '/', redirect: '/obszary' },
  { path: '/obszary', view: areasView },
  { path: '/obszary/rejestry-vat', view: registersView },
  { path: '/obszary/ksiegowania', view: placeholderView('bookkeeping') },
  { path: '/obszary/majatek', view: placeholderView('assets') },
  { path: '/obszary/kontrole', view: placeholderView('controls') },
  { path: '*', view: notFoundView },
]);

initPopovers();
initShell();
startRouter();

onLangChange(() => {
  renderShell();
  refresh();
});
