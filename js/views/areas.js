import { html, icon, render } from '../utils/dom.js';
import { t } from '../i18n.js';
import { appStore } from '../app-state.js';
import { date } from '../utils/format.js';
import { AREAS, ITEMS, evaluateArea, STATUS_BADGE, STATUS_ICON } from '../data/areas.js';
import { pageHead, setTitle } from '../components/page-head.js';
import { openPeriodConfig } from '../components/period-config-dialog.js';

export const itemIcon = (id) => ITEMS[id].icon;

export const statusBadge = (status) =>
  html`<span class="badge badge--${STATUS_BADGE[status]}">${icon(STATUS_ICON[status])} ${t(`status.${status}`)}</span>`;

export function itemDisclosure(item, { open = false } = {}) {
  return html`<details class="disclosure area-item" ${open ? 'open' : ''}>
    <summary>
      ${icon(item.icon ?? 'file-text', 'muted')}
      <span class="area-item__name">${t(`items.${item.id}.name`)}</span>
      <span class="area-item__meta">
        <span class="area-item__count" title="${t('areas.conditionsMet')}">${item.metCount}/${item.conditions.length}</span>
        <span class="area-item__status" data-status="${item.status}">
          <span class="sr-only">${t(`status.${item.status}`)}</span>
        </span>
      </span>
      ${icon('chevron-down', 'disclosure__chevron')}
    </summary>
    <div class="area-item__body">
      <ul class="conditions" role="list" aria-label="${t('areas.conditions')}">
        ${item.conditions.map((c) => html`<li class="${c.met ? 'is-met' : 'is-unmet'}">
          ${icon(c.met ? 'check-circle' : 'circle-dashed')}
          <span>${t(`conditions.${c.id}`)}<span class="sr-only">: ${t(c.met ? 'areas.met' : 'areas.unmet')}</span></span>
        </li>`)}
      </ul>
      ${item.status === 'na' ? html`<p class="area-item__note">${t('areas.naNote')}</p>` : ''}
    </div>
  </details>`;
}

function periodCard(cfg) {
  const meta = cfg.configured
    ? [`${date(cfg.start)} – ${date(cfg.end)}`, t(`period.forms.${cfg.form}`), cfg.vatPayer ? t(`period.vatPeriods.${cfg.vatPeriod}`) : t('period.noVat')]
    : [];
  return html`
    <section class="period-card card" aria-labelledby="period-title">
      <span class="period-card__icon">${icon('calendar', 'icon--lg')}</span>
      <div class="period-card__main">
        <div class="period-card__title-row">
          <h2 id="period-title" class="period-card__title">${t('period.title', { year: cfg.year })}</h2>
          ${cfg.configured
            ? html`<span class="badge badge--success">${icon('check-circle')} ${t('period.configured')}</span>`
            : html`<span class="badge badge--warning">${icon('settings')} ${t('status.config')}</span>`}
        </div>
        <p class="period-card__lead">${t(cfg.configured ? 'period.leadConfigured' : 'period.lead')}</p>
        ${meta.length ? html`<ul class="period-card__meta" role="list">${meta.map((m) => html`<li>${m}</li>`)}</ul>` : ''}
      </div>
      <button type="button" class="btn ${cfg.configured ? '' : 'btn--primary'} period-card__cta" data-action="configure">
        ${icon('settings')} ${t(cfg.configured ? 'period.edit' : 'period.configure')}
      </button>
    </section>
  `;
}

function readinessCard(evaluated) {
  const items = evaluated.flatMap((a) => a.items).filter((i) => i.status !== 'na');
  const ready = items.filter((i) => i.status === 'ready').length;
  const pct = items.length ? Math.round((ready / items.length) * 100) : 0;
  return html`
    <section class="readiness card" aria-labelledby="readiness-title">
      <h2 id="readiness-title" class="readiness__title">${t('areas.readinessTitle')}</h2>
      <p class="readiness__value"><strong>${ready}</strong> / ${items.length} <span>${t('areas.readyAreas', { count: items.length })}</span></p>
      <div class="meter" role="progressbar" aria-valuemin="0" aria-valuemax="${items.length}" aria-valuenow="${ready}" aria-labelledby="readiness-title">
        <span style="width:${pct}%"></span>
      </div>
      <p class="readiness__hint">${t('areas.readinessHint')}</p>
    </section>
  `;
}

function areaCard(area, evaluation) {
  return html`
    <article class="area-card card" data-status="${evaluation.status}" aria-labelledby="area-${area.id}">
      <header class="area-card__head">
        <span class="area-card__icon">${icon(area.icon, 'icon--lg')}</span>
        <div class="area-card__titles">
          <h3 id="area-${area.id}" class="area-card__title">${t(`nav.${area.id}`)}</h3>
          <p class="area-card__desc">${t(`areas.desc.${area.id}`)}</p>
        </div>
        ${statusBadge(evaluation.status)}
      </header>
      <div class="area-card__items">
        ${evaluation.items.map((item) => itemDisclosure({ ...item, icon: itemIcon(item.id) }))}
      </div>
      <footer class="area-card__foot">
        <a class="btn ${area.id === 'vat' ? 'btn--primary' : 'btn--soft'} btn--sm" href="${area.path}" data-link>
          ${t(area.id === 'vat' ? 'areas.openVat' : 'areas.open')} ${icon('arrow-right', 'icon--sm')}
          <span class="sr-only">: ${t(`nav.${area.id}`)}</span>
        </a>
      </footer>
    </article>
  `;
}
export const areasView = {
  mount(outlet) {
    setTitle(t('areas.title'));

    const draw = () => {
      const cfg = appStore.get().periodConfig;
      const evaluated = AREAS.map((area) => ({ area, ...evaluateArea(area, cfg) }));
      render(outlet, html`
        ${pageHead({
          crumbs: [{ label: t('nav.records') }, { label: t('areas.title') }],
          title: t('areas.title'),
          lead: t('areas.lead'),
        })}
        <div class="areas-top">
          ${periodCard(cfg)}
          ${readinessCard(evaluated)}
        </div>
        <section class="areas-section" aria-labelledby="areas-heading">
          <div class="section-head">
            <div>
              <h2 id="areas-heading" class="section-title">${t('areas.availability')}</h2>
              <p class="section-lead">${t('areas.availabilityLead')}</p>
            </div>
          </div>
          <div class="areas-grid">
            ${evaluated.map((e) => areaCard(e.area, e))}
          </div>
        </section>
      `);
    };

    const onClick = (event) => {
      if (event.target.closest('[data-action="configure"]')) openPeriodConfig();
    };

    draw();
    outlet.addEventListener('click', onClick);
    const unsubscribe = appStore.subscribe((_, patch) => {
      if (!('periodConfig' in patch)) return;
      const openItems = [...outlet.querySelectorAll('details[open]')].map((d) => d.querySelector('.area-item__name')?.textContent);
      draw();
      outlet.querySelectorAll('details').forEach((d) => {
        if (openItems.includes(d.querySelector('.area-item__name')?.textContent)) d.open = true;
      });
    });

    return () => {
      outlet.removeEventListener('click', onClick);
      unsubscribe();
    };
  },
};
