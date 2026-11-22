import { html, icon, render } from '../utils/dom.js';
import { t } from '../i18n.js';

let counter = 0;

/**
 * Opens a modal <dialog>. `body` and `footer` are `html` results; `onMount`
 * receives the dialog element so callers can wire behaviour. Returns a promise
 * resolved with the dialog's returnValue when it closes. When `isDirty()` returns
 * true, Esc and outside clicks keep the dialog open and explain why; explicit
 * Cancel / close buttons still discard.
 */
export function openDialog({ title, description, body, footer, onMount, isDirty, className = '' }) {
  const id = `dlg-${++counter}`;
  const dialog = document.createElement('dialog');
  dialog.className = `dialog ${className}`;
  dialog.setAttribute('aria-labelledby', `${id}-title`);
  if (description) dialog.setAttribute('aria-describedby', `${id}-desc`);
  dialog.setAttribute('closedby', 'any');

  render(dialog, html`
    <form method="dialog" class="dialog__form">
      <header class="dialog__head">
        <div>
          <h2 id="${id}-title">${title}</h2>
          ${description ? html`<p id="${id}-desc">${description}</p>` : ''}
        </div>
        <button type="submit" value="cancel" class="btn btn--ghost btn--icon btn--sm" formnovalidate aria-label="${t('common.close')}">${icon('x')}</button>
      </header>
      <div class="dialog__body">${body}</div>
      <p class="dialog__notice" role="status"></p>
      ${footer ? html`<footer class="dialog__foot">${footer}</footer>` : ''}
    </form>
  `);

  document.body.append(dialog);

  const notice = dialog.querySelector('.dialog__notice');
  const blockDismiss = () => {
    if (!isDirty?.()) return false;
    notice.textContent = t('common.unsavedChanges');
    return true;
  };
  dialog.addEventListener('cancel', (event) => {
    if (blockDismiss()) event.preventDefault();
  });

  // Light dismiss for browsers without `closedby` support.
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog || !dialog.open) return;
    const r = dialog.getBoundingClientRect();
    const inside = event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom;
    if (!inside && !blockDismiss()) dialog.close('cancel');
  });

  // Items inside a popover are hidden once it closes, so focus its invoker instead.
  const active = document.activeElement;
  const popover = active?.closest('[popover]');
  const returnFocus = popover ? document.querySelector(`[popovertarget="${popover.id}"]`) ?? active : active;
  onMount?.(dialog);
  dialog.showModal();

  return new Promise((resolve) => {
    dialog.addEventListener('close', () => {
      resolve(dialog.returnValue);
      setTimeout(() => dialog.remove(), 250);
      // Deferred so callers can re-render first; the opener may have been replaced by then.
      setTimeout(() => {
        const target = returnFocus?.isConnected ? returnFocus : returnFocus?.id && document.getElementById(returnFocus.id);
        target?.focus({ preventScroll: true });
      });
    }, { once: true });
  });
}
