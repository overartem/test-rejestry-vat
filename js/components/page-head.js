import { html } from '../utils/dom.js';
import { t } from '../i18n.js';

/** Shared page header used by every page of the accounting area. */
export function pageHead({ crumbs = [], eyebrow, title, lead, badges = '', actions = '' }) {
  return html`
    <header class="page-head">
      <nav class="breadcrumbs" aria-label="${t('common.breadcrumbs')}">
        <ol>
          ${crumbs.map((c, i) => html`<li>${i === crumbs.length - 1
            ? html`<span aria-current="page">${c.label}</span>`
            : c.href ? html`<a href="${c.href}" data-link>${c.label}</a>` : html`<span>${c.label}</span>`}</li>`)}
        </ol>
      </nav>
      ${eyebrow ? html`<p class="eyebrow">${eyebrow}</p>` : ''}
      <div class="page-head__row">
        <h1 class="page-title" tabindex="-1" data-page-title>${title}</h1>
        ${badges}
        ${actions ? html`<div class="page-head__actions">${actions}</div>` : ''}
      </div>
      ${lead ? html`<p class="page-lead">${lead}</p>` : ''}
    </header>
  `;
}

export const setTitle = (title) => {
  document.title = `${title} · ${t('app.brand')}`;
};
