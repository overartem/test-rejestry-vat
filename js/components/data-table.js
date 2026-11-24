import { html, icon } from '../utils/dom.js';
import { t, getLocale } from '../i18n.js';
import * as fmt from '../utils/format.js';
import { labelName } from './filters.js';
import { persisted } from '../store.js';

const KSEF_ORDER = { missing: 0, pending: 1, confirmed: 2 };
const KSEF_BADGE = {
  confirmed: ['success', 'check-circle'],
  pending: ['info', 'clock'],
  missing: ['warning', 'alert'],
};

export const ksefBadge = (status) => {
  const [tone, glyph] = KSEF_BADGE[status];
  return html`<span class="badge badge--${tone}">${icon(glyph)} ${t(`ksef.${status}`)}</span>`;
};

const amount = (value) => html`<span class="${value < 0 ? 'negative' : ''}">${fmt.money(value)}</span>`;

/** Column registry. `value` feeds sorting and CSV export, `cell` renders HTML. */
export const COLUMNS = {
  contractor: { value: (d) => d.contractor.name, cell: (d, ctx) => html`
    <span class="dt__contractor">
      <strong>${d.contractor.name}</strong>
      ${ctx.labelsFor(d.id).map((l) => html`<span class="label" data-color="${l.color}">${labelName(l)}</span>`)}
    </span>` },
  date: { value: (d) => d.date, cell: (d) => html`<span class="tabular dt__nowrap">${fmt.date(d.date)}</span>`, csv: (d) => d.date },
  number: { value: (d) => d.number, cell: (d) => html`<span class="tabular dt__nowrap">${d.number}</span>` },
  ksef: { value: (d) => KSEF_ORDER[d.ksef.status], cell: (d) => ksefBadge(d.ksef.status), csv: (d) => d.ksef.number ?? t(`ksef.${d.ksef.status}`) },
  identifier: { value: (d) => d.identifier, cell: (d) => html`<span class="mono muted dt__nowrap">${d.identifier}</span>` },
  nip: { value: (d) => d.contractor.nip, cell: (d) => html`<span class="mono dt__nowrap">${d.contractor.nip}</span>` },
  operation: { value: (d) => t(`operations.${d.operation}`), cell: (d) => t(`operations.${d.operation}`) },
  jpk: { value: (d) => d.jpk.join(', '), cell: (d) => d.jpk.length ? html`<span class="code-list">${d.jpk.map((c) => html`<code>${c}</code>`)}</span>` : html`<span class="muted">—</span>` },
  net: { value: (d) => d.net, numeric: true, cell: (d) => amount(d.net), csv: (d) => fmt.moneyPlain(d.net) },
  vat: { value: (d) => d.vat, numeric: true, cell: (d) => amount(d.vat), csv: (d) => fmt.moneyPlain(d.vat) },
  gross: { value: (d) => d.gross, numeric: true, cell: (d) => html`<strong>${amount(d.gross)}</strong>`, csv: (d) => fmt.moneyPlain(d.gross) },
};
export const COLUMN_IDS = Object.keys(COLUMNS);

export const DEFAULT_COLUMNS = [
  { id: 'contractor', visible: true },
  { id: 'date', visible: true },
  { id: 'number', visible: true },
  { id: 'ksef', visible: true },
  { id: 'identifier', visible: true },
  { id: 'gross', visible: true },
  { id: 'nip', visible: false },
  { id: 'operation', visible: false },
  { id: 'jpk', visible: false },
  { id: 'net', visible: false },
  { id: 'vat', visible: false },
];

export function loadColumns() {
  const saved = persisted.get('columns', null);
  if (!Array.isArray(saved)) return structuredClone(DEFAULT_COLUMNS);
  const known = saved.filter((c) => COLUMNS[c?.id]);
  const missing = DEFAULT_COLUMNS.filter((d) => !known.some((c) => c.id === d.id));
  const merged = [...known, ...missing];
  return merged.some((c) => c.visible) ? merged : structuredClone(DEFAULT_COLUMNS);
}

export function sortDocuments(docs, sort, dir) {
  const column = COLUMNS[sort] ?? COLUMNS.date;
  const collator = new Intl.Collator(getLocale(), { numeric: true, sensitivity: 'base' });
  const factor = dir === 'desc' ? -1 : 1;
  return [...docs].sort((a, b) => {
    const va = column.value(a);
    const vb = column.value(b);
    const result = typeof va === 'number' ? va - vb : collator.compare(va, vb);
    return (result || collator.compare(a.number, b.number)) * factor;
  });
}

function headerCell(col, ctx) {
  const active = ctx.sort === col.id;
  const ariaSort = active ? (ctx.dir === 'asc' ? 'ascending' : 'descending') : 'none';
  const glyph = active ? (ctx.dir === 'asc' ? 'arrow-up' : 'arrow-down') : 'sort';
  return html`<th scope="col" aria-sort="${ariaSort}" class="${COLUMNS[col.id].numeric ? 'num' : ''}">
    <button type="button" class="dt__sort ${active ? 'is-active' : ''}" data-action="sort" data-sort="${col.id}" id="sort-${col.id}">
      ${t(`columns.${col.id}`)} ${icon(glyph, 'icon--sm')}
    </button>
  </th>`;
}

function detailPanel(doc, ctx) {
  const labels = ctx.labelsFor(doc.id);
  return html`
    <div class="doc-detail">
      <dl class="doc-detail__grid">
        <div><dt>${icon('user', 'icon--sm')} ${t('columns.contractor')}</dt><dd>${doc.contractor.name}<span class="mono muted">${t('detail.nip')} ${doc.contractor.nip}</span></dd></div>
        <div><dt>${icon('layers', 'icon--sm')} ${t('columns.operation')}</dt><dd>${t(`operations.${doc.operation}`)}</dd></div>
        <div><dt>${icon('file-text', 'icon--sm')} ${t('detail.series')}</dt><dd>${doc.series} · ${t(`series.${doc.series}`)}</dd></div>
        <div><dt>${icon('list-checks', 'icon--sm')} ${t('columns.jpk')}</dt><dd>${doc.jpk.length ? html`<span class="code-list">${doc.jpk.map((c) => html`<code title="${t(`jpk.${c}`)}">${c}</code>`)}</span>` : t('detail.noCodes')}</dd></div>
        <div class="doc-detail__wide"><dt>${icon('receipt', 'icon--sm')} ${t('columns.ksef')}</dt><dd>
          ${doc.ksef.number
            ? html`<span class="ksef-number"><span class="mono">${doc.ksef.number}</span>
                <button type="button" class="btn btn--ghost btn--icon btn--sm" data-action="copy" data-value="${doc.ksef.number}" aria-label="${t('detail.copyKsef')}" title="${t('detail.copyKsef')}">${icon('copy', 'icon--sm')}</button></span>`
            : html`${ksefBadge(doc.ksef.status)} <span class="muted">${t(`ksef.${doc.ksef.status}Hint`)}</span>`}
        </dd></div>
        <div class="doc-detail__wide"><dt>${icon('tag', 'icon--sm')} ${t('labels.title')}</dt><dd class="doc-detail__labels">
          ${labels.length ? labels.map((l) => html`<span class="label" data-color="${l.color}">${labelName(l)}</span>`) : html`<span class="muted">${t('labels.noneAssigned')}</span>`}
          <button type="button" class="btn btn--link btn--sm" data-action="edit-labels" data-id="${doc.id}" id="edit-labels-${doc.id}">${icon('tag', 'icon--sm')} ${t('labels.edit')}</button>
        </dd></div>
      </dl>
      <table class="doc-lines">
        <caption class="doc-lines__title">${icon('banknote', 'icon--sm')} ${t('detail.lines')}</caption>
        <thead><tr><th scope="col">${t('detail.rate')}</th><th scope="col" class="num">${t('columns.net')}</th><th scope="col" class="num">${t('columns.vat')}</th><th scope="col" class="num">${t('columns.gross')}</th></tr></thead>
        <tbody>
          ${doc.lines.map((l) => html`<tr><td>${t(`rates.${l.rate}`)}</td><td class="num" data-label="${t('columns.net')}">${amount(l.net)}</td><td class="num" data-label="${t('columns.vat')}">${amount(l.vat)}</td><td class="num" data-label="${t('columns.gross')}">${amount(l.net + l.vat)}</td></tr>`)}
        </tbody>
        <tfoot><tr><th scope="row">${t('detail.total')}</th><td class="num" data-label="${t('columns.net')}">${amount(doc.net)}</td><td class="num" data-label="${t('columns.vat')}">${amount(doc.vat)}</td><td class="num" data-label="${t('columns.gross')}"><strong>${amount(doc.gross)}</strong></td></tr></tfoot>
      </table>
    </div>
  `;
}

function detailRow(doc, ctx, span) {
  return html`<tr class="dt__detail" id="det-${doc.id}"><td colspan="${span}">${detailPanel(doc, ctx)}</td></tr>`;
}

/**
 * Opens/closes one row's details in place. Re-rendering the whole table would
 * lose the scroll position in browsers without scroll anchoring (Safari).
 */
export function toggleRowDetail(row, doc, ctx, open) {
  const button = row.querySelector('.dt__expand');
  button.setAttribute('aria-expanded', String(open));
  button.setAttribute('aria-label', t(open ? 'table.hideDetails' : 'table.showDetails', { name: doc.number }));
  row.classList.toggle('is-open', open);
  if (row.nextElementSibling?.matches('.dt__detail')) row.nextElementSibling.remove();
  if (open) row.insertAdjacentHTML('afterend', detailRow(doc, ctx, row.cells.length).value);
}

/**
 * @param {object} ctx  { docs, columns, sort, dir, selection:Set, expanded:Set, labelsFor(id), caption }
 */
export function dataTable(ctx) {
  const visible = ctx.columns.filter((c) => c.visible);
  const span = visible.length + 2;
  const pageIds = ctx.docs.map((d) => d.id);
  const selectedOnPage = pageIds.filter((id) => ctx.selection.has(id)).length;

  return html`
    <div class="table-wrap">
      <table class="dt" data-select-state="${selectedOnPage === 0 ? 'none' : selectedOnPage === pageIds.length ? 'all' : 'some'}">
        <caption class="sr-only">${ctx.caption}</caption>
        <thead>
          <tr>
            <th scope="col" class="dt__check">
              <label class="dt__hit"><input type="checkbox" id="select-page" data-action="select-page" aria-label="${t('table.selectPage')}"
                ${selectedOnPage && selectedOnPage === pageIds.length ? 'checked' : ''}></label>
            </th>
            ${visible.map((col) => headerCell(col, ctx))}
            <th scope="col" class="dt__actions"><span class="sr-only">${t('table.details')}</span></th>
          </tr>
        </thead>
        <tbody>
          ${ctx.docs.map((doc) => {
            const open = ctx.expanded.has(doc.id);
            const selected = ctx.selection.has(doc.id);
            return html`
              <tr class="dt__row ${selected ? 'is-selected' : ''} ${open ? 'is-open' : ''}" data-id="${doc.id}">
                <td class="dt__check">
                  <label class="dt__hit"><input type="checkbox" id="sel-${doc.id}" data-action="select-row" data-id="${doc.id}" ${selected ? 'checked' : ''}
                    aria-label="${t('table.selectRow', { name: doc.number })}"></label>
                </td>
                ${visible.map((col, i) => html`<td class="${COLUMNS[col.id].numeric ? 'num' : ''} ${i === 0 ? 'is-primary' : ''}" data-label="${t(`columns.${col.id}`)}">${COLUMNS[col.id].cell(doc, ctx)}</td>`)}
                <td class="dt__actions">
                  <button type="button" class="btn btn--icon btn--sm dt__expand" data-action="expand" data-id="${doc.id}" id="exp-${doc.id}"
                    aria-expanded="${open}" aria-controls="det-${doc.id}" aria-label="${t(open ? 'table.hideDetails' : 'table.showDetails', { name: doc.number })}">
                    ${icon('chevron-down')}
                  </button>
                </td>
              </tr>
              ${open ? detailRow(doc, ctx, span) : ''}
            `;
          })}
        </tbody>
      </table>
    </div>
  `;
}

export function tableSkeleton(rows = 6) {
  return html`
    <div class="skeleton-table" aria-hidden="true">
      ${Array.from({ length: rows }, (_, i) => html`<div class="skeleton-row">
        <span class="skeleton" style="width:${40 + ((i * 17) % 30)}%"></span>
        <span class="skeleton" style="width:70%"></span>
        <span class="skeleton" style="width:85%"></span>
        <span class="skeleton" style="width:60%"></span>
      </div>`)}
    </div>
  `;
}
