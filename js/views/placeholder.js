import { html, icon, render } from '../utils/dom.js';
import { t } from '../i18n.js';
import { appStore } from '../app-state.js';
import { COMPANY } from '../data/mock.js';
import { AREAS, evaluateArea } from '../data/areas.js';
import { pageHead, setTitle } from '../components/page-head.js';
import { openPeriodConfig } from '../components/period-config-dialog.js';
import { statusBadge, itemDisclosure, itemIcon } from './areas.js';

/** Areas that are mapped but not launched yet share this honest "not configured" page. */
export function placeholderView(areaId) {
  const area = AREAS.find((a) => a.id === areaId);
  return {
    mount(outlet) {
      setTitle(t(`nav.${areaId}`));

      const draw = () => {
        const evaluation = evaluateArea(area, appStore.get().periodConfig);
        const ready = evaluation.status === 'ready';
        render(outlet, html`
          ${pageHead({
            crumbs: [{ label: t('nav.records') }, { label: t('areas.title'), href: '/obszary' }, { label: t(`nav.${areaId}`) }],
            eyebrow: COMPANY.name,
            title: t(`nav.${areaId}`),
            lead: t(`areas.desc.${areaId}`),
            badges: statusBadge(evaluation.status),
          })}
          <div class="placeholder-layout">
            <section class="card">
              <div class="state ${ready ? '' : 'state--config'}">
                <span class="state__icon">${icon(ready ? 'inbox' : 'settings')}</span>
                <h2 class="state__title">${t(ready ? 'placeholder.readyTitle' : 'placeholder.title')}</h2>
                <p class="state__text">${t(ready ? 'placeholder.readyText' : 'placeholder.text')}</p>
                <div class="state__actions">
                  ${ready ? '' : html`<button type="button" class="btn btn--primary" data-action="configure">${icon('settings')} ${t('period.configure')}</button>`}
                  <a class="btn" href="/obszary/rejestry-vat" data-link>${icon('receipt')} ${t('placeholder.goVat')}</a>
                </div>
              </div>
            </section>
            <aside class="card placeholder-conditions" aria-labelledby="ph-cond">
              <h2 id="ph-cond" class="placeholder-conditions__title">${t('areas.conditions')}</h2>
              ${evaluation.items.map((item) => itemDisclosure({ ...item, icon: itemIcon(item.id) }, { open: evaluation.items.length === 1 }))}
            </aside>
          </div>
        `);
      };

      const onClick = (event) => {
        if (event.target.closest('[data-action="configure"]')) openPeriodConfig();
      };

      draw();
      outlet.addEventListener('click', onClick);
      const unsubscribe = appStore.subscribe((_, patch) => { if ('periodConfig' in patch) draw(); });
      return () => {
        outlet.removeEventListener('click', onClick);
        unsubscribe();
      };
    },
  };
}

export const notFoundView = {
  mount(outlet) {
    setTitle(t('notFound.title'));
    render(outlet, html`
      <section class="card">
        <div class="state">
          <span class="state__icon">${icon('search-x')}</span>
          <h1 class="state__title" tabindex="-1" data-page-title>${t('notFound.title')}</h1>
          <p class="state__text">${t('notFound.text')}</p>
          <div class="state__actions">
            <a class="btn btn--primary" href="/obszary" data-link>${t('notFound.back')}</a>
          </div>
        </div>
      </section>
    `);
  },
};
