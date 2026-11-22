import { html, icon, render } from '../utils/dom.js';
import { t } from '../i18n.js';
import { DEMO_STATES, getDemoState } from '../api.js';
import { setQueryParam } from '../store.js';

/**
 * Floating reviewer tool that forces a data state (loading / empty / error)
 * through the `?state=` query param.
 */
export function mountStateSwitcher(onChange) {
  const root = document.createElement('div');
  root.className = 'state-switcher';

  const draw = () => {
    const current = getDemoState();
    render(root, html`
      <button type="button" class="state-switcher__btn" popovertarget="pop-states" aria-haspopup="dialog" aria-expanded="false">
        ${icon('layers')} <span>${t('demoStates.button')}</span>
        ${current !== 'auto' ? html`<span class="badge badge--info">${t(`demoStates.${current}`)}</span>` : ''}
      </button>
      <div popover id="pop-states" class="popover popover--start" role="dialog" aria-labelledby="pop-states-title">
        <div class="state-switcher__panel">
          <h2 id="pop-states-title">${t('demoStates.title')}</h2>
          <p>${t('demoStates.hint')}</p>
          <fieldset>
            <legend class="sr-only">${t('demoStates.title')}</legend>
            ${DEMO_STATES.map((s) => html`<label class="check-row">
              <input type="radio" name="demo-state" value="${s}" ${s === current ? 'checked' : ''}>
              <span>${t(`demoStates.${s}`)}</span>
            </label>`)}
          </fieldset>
        </div>
      </div>
    `);
  };

  root.addEventListener('change', (event) => {
    if (event.target.name !== 'demo-state') return;
    const value = event.target.value;
    setQueryParam('state', value === 'auto' ? null : value);
    const btnSlot = root.querySelector('.state-switcher__btn');
    btnSlot.querySelector('.badge')?.remove();
    if (value !== 'auto') btnSlot.insertAdjacentHTML('beforeend', `<span class="badge badge--info">${t(`demoStates.${value}`)}</span>`);
    onChange(value);
  });

  draw();
  document.body.append(root);
  return { destroy: () => root.remove(), sync: draw };
}
