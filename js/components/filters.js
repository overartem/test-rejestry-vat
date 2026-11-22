import { html, icon } from '../utils/dom.js';
import { t, getLang } from '../i18n.js';
import { OPERATIONS, JPK_CODES, SERIES } from '../data/mock.js';

export const labelName = (label) =>
  typeof label.name === 'string' ? label.name : label.name[getLang()] ?? label.name.pl;

export const activeFilterCount = (state) =>
  (state.op ? 1 : 0) + (state.jpk ? 1 : 0) + state.s.length + state.l.length;

export function filtersBody(state, labels) {
  const r = state.r;
  return html`
    <label class="field">
      <span class="field__label">${t('filters.operation')}</span>
      <select class="select" name="op">
        <option value="">${t('filters.all')}</option>
        ${OPERATIONS[r].map((op) => html`<option value="${op}" ${state.op === op ? 'selected' : ''}>${t(`operations.${op}`)}</option>`)}
      </select>
    </label>
    <label class="field">
      <span class="field__label">${t('filters.jpk')}</span>
      <select class="select" name="jpk">
        <option value="">${t('filters.all')}</option>
        ${JPK_CODES[r].map((code) => html`<option value="${code}" ${state.jpk === code ? 'selected' : ''}>${code} — ${t(`jpk.${code}`)}</option>`)}
      </select>
    </label>
    <fieldset>
      <legend>${t('filters.series')}</legend>
      <div class="chip-group">
        ${SERIES[r].map((s) => html`<label class="chip-toggle">
          <input type="checkbox" name="s" value="${s}" ${state.s.includes(s) ? 'checked' : ''}>
          <span>${s} <span class="muted">· ${t(`series.${s}`)}</span></span>
        </label>`)}
      </div>
    </fieldset>
    <fieldset>
      <legend>${t('filters.labels')}</legend>
      ${labels.length
        ? html`<div class="chip-group">
            ${labels.map((l) => html`<label class="chip-toggle chip-toggle--label">
              <input type="checkbox" name="l" value="${l.id}" ${state.l.includes(l.id) ? 'checked' : ''}>
              <span class="label" data-color="${l.color}">${labelName(l)}</span>
            </label>`)}
          </div>`
        : html`<p class="field__hint">${t('labels.none')}</p>`}
    </fieldset>
  `;
}

export function filterChips(state, labels) {
  const chips = [];
  if (state.op) chips.push({ key: 'op', value: state.op, name: t('filters.operation'), text: t(`operations.${state.op}`) });
  if (state.jpk) chips.push({ key: 'jpk', value: state.jpk, name: t('filters.jpkShort'), text: state.jpk });
  for (const s of state.s) chips.push({ key: 's', value: s, name: t('filters.seriesShort'), text: s });
  for (const id of state.l) {
    const label = labels.find((l) => l.id === id);
    if (label) chips.push({ key: 'l', value: id, name: t('filters.labelShort'), text: labelName(label) });
  }
  if (state.q) chips.unshift({ key: 'q', value: state.q, name: t('filters.search'), text: `„${state.q}”` });
  if (!chips.length) return '';
  return html`
    <ul class="filter-chips" role="list" aria-label="${t('filters.active')}">
      ${chips.map((c) => html`<li class="filter-chip">
        <span>${c.name}:</span> <strong>${c.text}</strong>
        <button type="button" data-action="remove-filter" data-key="${c.key}" data-value="${c.value}" aria-label="${t('filters.remove', { name: `${c.name} ${c.text}` })}">
          ${icon('x', 'icon--sm')}
        </button>
      </li>`)}
      <li><button type="button" class="btn btn--link btn--sm" data-action="clear-filters">${t('filters.clearAll')}</button></li>
    </ul>
  `;
}
