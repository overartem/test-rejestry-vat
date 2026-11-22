import { html, icon, render } from '../utils/dom.js';
import { t } from '../i18n.js';

const DURATION = 4500;

export function toast(message, { type = 'success' } = {}) {
  const region = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = 'toast';
  el.dataset.type = type;
  render(el, html`
    ${icon(type === 'error' ? 'alert-octagon' : type === 'info' ? 'info' : 'check-circle')}
    <span>${message}</span>
    <button type="button" aria-label="${t('common.close')}">${icon('x', 'icon--sm')}</button>
  `);

  let timer;
  const dismiss = () => {
    clearTimeout(timer);
    el.classList.add('is-leaving');
    setTimeout(() => el.remove(), 220);
  };
  const schedule = () => { timer = setTimeout(dismiss, DURATION); };

  el.querySelector('button').addEventListener('click', dismiss);
  el.addEventListener('pointerenter', () => clearTimeout(timer));
  el.addEventListener('pointerleave', schedule);
  el.addEventListener('focusin', () => clearTimeout(timer));

  region.append(el);
  while (region.children.length > 3) region.firstElementChild.remove();
  schedule();
}
