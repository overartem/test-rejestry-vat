import { $, html, icon, render, renderPreservingFocus, debounce, normalize } from '../utils/dom.js';
import { t } from '../i18n.js';
import * as fmt from '../utils/format.js';
import { appStore } from '../app-state.js';
import { readQuery, writeQuery, setQueryParam, persisted } from '../store.js';
import { fetchPeriod } from '../api.js';
import {
  COMPANY, REGISTERS, OPERATIONS, JPK_CODES, SERIES, RATES, YEARS,
  DEFAULT_PERIOD, FIRST_PERIOD, LAST_PERIOD,
} from '../data/mock.js';
import { evaluateItem } from '../data/areas.js';
import { pageHead, setTitle } from '../components/page-head.js';
import { periodPicker, periodGrid, shiftMonth } from '../components/period-picker.js';
import { filtersBody, filterChips, activeFilterCount } from '../components/filters.js';
import { dataTable, tableSkeleton, sortDocuments, loadColumns, COLUMN_IDS, toggleRowDetail } from '../components/data-table.js';
import { openColumnsDialog } from '../components/columns-dialog.js';
import { openLabelsDialog } from '../components/labels-dialog.js';
import { mountStateSwitcher } from '../components/state-switcher.js';
import { toast } from '../components/toast.js';
import { downloadCsv, renderPrintReport, clearPrintReport } from '../utils/export.js';

const PER_PAGE = [10, 25, 50];
const DEFAULTS = { r: 'sales', y: DEFAULT_PERIOD.year, m: DEFAULT_PERIOD.month, q: '', op: '', jpk: '', s: [], l: [], sort: 'date', dir: 'asc', p: 1, per: 10 };
const REGISTER_ICON = { sales: 'receipt', purchase: 'cart' };

const list = (value) => (value ? value.split(',').filter(Boolean) : []);

function parseState() {
  const q = readQuery();
  const r = REGISTERS.includes(q.r) ? q.r : DEFAULTS.r;
  const y = YEARS.includes(Number(q.y)) ? Number(q.y) : DEFAULTS.y;
  const m = Number(q.m) >= 1 && Number(q.m) <= 12 ? Number(q.m) : DEFAULTS.m;
  return {
    r, y, m,
    q: (q.q ?? '').slice(0, 80),
    op: OPERATIONS[r].includes(q.op) ? q.op : '',
    jpk: JPK_CODES[r].includes(q.jpk) ? q.jpk : '',
    s: list(q.s).filter((s) => SERIES[r].includes(s)),
    l: list(q.l),
    sort: COLUMN_IDS.includes(q.sort) ? q.sort : DEFAULTS.sort,
    dir: q.dir === 'desc' ? 'desc' : 'asc',
    p: Math.max(1, Number.parseInt(q.p, 10) || 1),
    per: PER_PAGE.includes(Number(q.per)) ? Number(q.per) : DEFAULTS.per,
  };
}

const totalsOf = (docs) => docs.reduce(
  (acc, d) => ({ net: acc.net + d.net, vat: acc.vat + d.vat, gross: acc.gross + d.gross }),
  { net: 0, vat: 0, gross: 0 },
);

function ratesOf(docs) {
  const byRate = new Map(RATES.map((r) => [r, { net: 0, vat: 0, count: 0 }]));
  for (const d of docs) for (const line of d.lines) {
    const entry = byRate.get(line.rate);
    entry.net += line.net;
    entry.vat += line.vat;
    entry.count += 1;
  }
  return [...byRate].filter(([, v]) => v.count > 0).map(([rate, v]) => ({ rate, ...v }));
}

export const registersView = {
  mount(outlet) {
    let state = parseState();
    let data = { status: 'loading', docs: null, error: null, key: null };
    let controller = null;
    let browseYear = state.y;
    let ratesOpen = persisted.get('ratesOpen', false);
    let columns = loadColumns();
    const selection = new Set();
    const expanded = new Set();

    setTitle(t('registers.title'));

    /* ---------- derived data ---------- */

    const labelsFor = (id) => {
      const { labels, docLabels } = appStore.get();
      return (docLabels[id] ?? []).map((lid) => labels.find((l) => l.id === lid)).filter(Boolean);
    };

    const allDocs = () => data.docs?.[state.r] ?? [];

    function filtered() {
      const query = normalize(state.q.trim());
      const { docLabels } = appStore.get();
      const result = allDocs().filter((d) => {
        if (state.op && d.operation !== state.op) return false;
        if (state.jpk && !d.jpk.includes(state.jpk)) return false;
        if (state.s.length && !state.s.includes(d.series)) return false;
        if (state.l.length && !state.l.some((id) => docLabels[d.id]?.includes(id))) return false;
        if (query) {
          const haystack = normalize([d.contractor.name, d.contractor.nip, d.number, d.identifier, d.ksef.number ?? ''].join(' '));
          if (!query.split(/\s+/).every((word) => haystack.includes(word))) return false;
        }
        return true;
      });
      return sortDocuments(result, state.sort, state.dir);
    }

    const hasActiveFilters = () => activeFilterCount(state) > 0 || state.q.trim() !== '';

    /* ---------- URL ---------- */

    function syncUrl() {
      writeQuery({
        r: state.r === DEFAULTS.r ? '' : state.r,
        y: state.y,
        m: state.m,
        q: state.q.trim(),
        op: state.op,
        jpk: state.jpk,
        s: state.s,
        l: state.l,
        sort: state.sort === DEFAULTS.sort ? '' : state.sort,
        dir: state.dir === DEFAULTS.dir ? '' : state.dir,
        p: state.p === 1 ? '' : state.p,
        per: state.per === DEFAULTS.per ? '' : state.per,
      });
    }

    /* ---------- layout ---------- */

    const vatStatus = evaluateItem('vatRegister', appStore.get().periodConfig).status;

    render(outlet, html`
      ${pageHead({
        crumbs: [{ label: t('nav.records') }, { label: t('areas.title'), href: '/obszary' }, { label: t('registers.title') }],
        eyebrow: COMPANY.name,
        title: t('registers.title'),
        lead: t('registers.lead'),
        badges: html`
          <button type="button" class="badge badge--${vatStatus === 'ready' ? 'success' : 'warning'} badge-trigger" popovertarget="pop-vat-status" aria-haspopup="dialog" aria-expanded="false">
            ${icon(vatStatus === 'ready' ? 'check-circle' : 'alert')} ${t(`status.${vatStatus}`)} ${icon('info', 'icon--sm')}
          </button>
          <div popover id="pop-vat-status" class="popover popover--wide popover--start" role="dialog" aria-labelledby="vat-status-title">
            <div class="demo-info">
              <h2 id="vat-status-title">${icon('alert')} ${t('registers.vatContextTitle')}</h2>
              <p>${t('header.demoBody2')}</p>
              <a href="/obszary" data-link class="btn btn--soft btn--sm">${t('registers.seeConditions')} ${icon('arrow-right', 'icon--sm')}</a>
            </div>
          </div>
        `,
      })}

      <section class="toolbar card" aria-label="${t('registers.toolbar')}">
        <div class="toolbar__row toolbar__row--primary">
          <div class="segmented" role="tablist" aria-label="${t('registers.registerType')}" data-slot="tabs"></div>
          <div data-slot="period" class="toolbar__period"></div>
        </div>
        <div class="toolbar__row">
          <search class="search-field">
            ${icon('search')}
            <label for="reg-search" class="sr-only">${t('registers.searchLabel')}</label>
            <input id="reg-search" class="input" type="search" placeholder="${t('registers.searchPlaceholder')}"
              value="${state.q}" autocomplete="off" spellcheck="false" enterkeyhint="search" aria-keyshortcuts="/" aria-describedby="search-hint">
            <button type="button" class="search-field__clear" data-action="clear-search" aria-label="${t('registers.searchClear')}" title="${t('registers.searchClear')}">${icon('x', 'icon--sm')}</button>
            <kbd class="kbd" aria-hidden="true">/</kbd>
            <span id="search-hint" class="sr-only">${t('registers.searchHint')}</span>
          </search>
          <div class="toolbar__actions">
            <button type="button" class="btn" popovertarget="pop-filters" aria-haspopup="dialog" aria-expanded="false" id="btn-filters" data-slot="filters-btn"></button>
            <div popover id="pop-filters" class="popover popover--wide popover--flush popover--sheet" role="dialog" aria-labelledby="filters-title">
              <div class="popover__head">
                <h2 id="filters-title">${t('filters.title')}</h2>
                <button type="button" class="btn btn--ghost btn--icon btn--sm" popovertarget="pop-filters" popovertargetaction="hide" aria-label="${t('common.close')}">${icon('x')}</button>
              </div>
              <form class="popover__body" data-slot="filters-body" aria-describedby="filters-title"></form>
              <div class="popover__foot">
                <button type="button" class="btn btn--ghost" data-action="clear-filters">${icon('rotate-ccw', 'icon--sm')} ${t('filters.clear')}</button>
                <button type="button" class="btn btn--primary" popovertarget="pop-filters" popovertargetaction="hide" data-slot="filters-apply"></button>
              </div>
            </div>
            <button type="button" class="btn btn-more" popovertarget="pop-more" aria-haspopup="menu" aria-expanded="false" id="btn-more" aria-label="${t('more.label')}" title="${t('more.label')}">
              ${icon('more')} <span class="btn-more__label">${t('more.short')}</span>
            </button>
            <div popover id="pop-more" class="popover" data-slot="more-menu"></div>
          </div>
        </div>
        <div data-slot="chips"></div>
      </section>

      <section class="data card" id="reg-panel" role="tabpanel" aria-labelledby="tab-${state.r}">
        <div data-slot="region"></div>
      </section>
      <p class="sr-only" aria-live="polite" data-slot="announce"></p>
    `);

    const slot = (name) => $(`[data-slot="${name}"]`, outlet);
    const searchInput = $('#reg-search', outlet);

    /* ---------- partial renderers ---------- */

    function drawTabs() {
      const counts = data.status === 'ready' ? { sales: data.docs.sales.length, purchase: data.docs.purchase.length } : null;
      renderPreservingFocus(slot('tabs'), html`${REGISTERS.map((r) => html`
        <button type="button" role="tab" class="segmented__btn" id="tab-${r}" data-action="tab" data-register="${r}"
          aria-selected="${state.r === r}" aria-controls="reg-panel" tabindex="${state.r === r ? 0 : -1}">
          ${icon(REGISTER_ICON[r])}
          <span class="segmented__label"><span class="segmented__long">${t(`registers.tabs.${r}`)}</span><span class="segmented__short">${t(`registers.tabsShort.${r}`)}</span></span>
          ${counts ? html`<span class="segmented__count" aria-label="${t('registers.docCount', { count: counts[r] })}">${counts[r]}</span>` : ''}
        </button>`)}`);
      $('#reg-panel', outlet).setAttribute('aria-labelledby', `tab-${state.r}`);
    }

    function drawPeriod() {
      renderPreservingFocus(slot('period'), periodPicker({ year: state.y, month: state.m, browseYear }));
    }

    function drawFiltersButton() {
      const count = activeFilterCount(state);
      render(slot('filters-btn'), html`${icon('filter')} <span class="btn__text">${t('filters.title')}</span>
        ${count ? html`<span class="btn__count" aria-label="${t('filters.activeCount', { count })}">${count}</span>` : ''}`);
      const n = data.status === 'ready' ? filtered().length : null;
      render(slot('filters-apply'), n == null ? t('common.done') : t('filters.showResults', { count: n }));
    }

    function drawFiltersBody() {
      renderPreservingFocus(slot('filters-body'), filtersBody(state, appStore.get().labels));
    }

    function drawChips() {
      render(slot('chips'), filterChips(state, appStore.get().labels));
    }

    function drawMoreMenu() {
      const n = selection.size;
      const ready = data.status === 'ready' && allDocs().length > 0;
      const scope = n ? t('more.selected', { count: n }) : t('more.allResults');
      render(slot('more-menu'), html`
        <div class="menu" role="menu" aria-label="${t('more.label')}">
          <button type="button" class="menu__item" role="menuitem" data-action="labels">${icon('tag')} ${n ? t('more.labelsSelected', { count: n }) : t('more.labels')}</button>
          <button type="button" class="menu__item" role="menuitem" data-action="print" ${ready ? '' : 'disabled'}>${icon('printer')} ${t('more.print')} <span class="menu__hint">${scope}</span></button>
          <button type="button" class="menu__item" role="menuitem" data-action="export" ${ready ? '' : 'disabled'}>${icon('download')} ${t('more.export')} <span class="menu__hint">${scope}</span></button>
          <div class="menu__sep" role="separator"></div>
          <button type="button" class="menu__item" role="menuitem" data-action="columns">${icon('columns')} ${t('more.columns')}</button>
        </div>
      `);
    }

    function summary(docs, all) {
      const totals = totalsOf(docs);
      const rates = ratesOf(docs);
      const maxNet = Math.max(1, ...rates.map((r) => Math.abs(r.net)));
      const scopeText = docs.length === all.length ? t('summary.all', { count: docs.length }) : t('summary.filtered', { count: docs.length, total: all.length });
      return html`
        <div class="summary">
          <dl class="kpis">
            <div class="kpi"><dt>${t('columns.net')}</dt><dd class="tabular">${fmt.money(totals.net)}</dd></div>
            <div class="kpi"><dt>${t('columns.vat')}</dt><dd class="tabular">${fmt.money(totals.vat)}</dd></div>
            <div class="kpi kpi--accent"><dt>${t('columns.gross')}</dt><dd class="tabular">${fmt.money(totals.gross)}</dd></div>
          </dl>
          <details class="disclosure rates" ${ratesOpen ? 'open' : ''} data-rates>
            <summary>
              <span class="rates__scope">${scopeText}</span>
              <span class="rates__toggle">${t('summary.byRate')} ${icon('chevron-down', 'icon--sm disclosure__chevron')}</span>
            </summary>
            <table class="rates__table">
              <caption class="sr-only">${t('summary.byRate')}</caption>
              <thead><tr>
                <th scope="col">${t('detail.rate')}</th>
                <th scope="col" class="rates__bar-cell"><span class="sr-only">${t('summary.share')}</span></th>
                <th scope="col" class="num">${t('columns.net')}</th>
                <th scope="col" class="num">${t('columns.vat')}</th>
              </tr></thead>
              <tbody>
                ${rates.map((r) => html`<tr>
                  <th scope="row"><span class="rates__rate">${t(`rates.${r.rate}`)}</span></th>
                  <td class="rates__bar-cell"><span class="meter"><span style="width:${Math.round((Math.abs(r.net) / maxNet) * 100)}%"></span></span></td>
                  <td class="num">${fmt.money(r.net)}</td>
                  <td class="num"><strong>${fmt.money(r.vat)}</strong></td>
                </tr>`)}
              </tbody>
            </table>
          </details>
        </div>
      `;
    }

    function bulkBar() {
      if (!selection.size) return '';
      return html`
        <div class="bulk-bar" role="region" aria-label="${t('bulk.label')}">
          <strong>${t('bulk.selected', { count: selection.size })}</strong>
          <div class="bulk-bar__actions">
            <button type="button" class="btn btn--sm" data-action="labels" id="bulk-labels">${icon('tag', 'icon--sm')} <span>${t('more.labels')}</span></button>
            <button type="button" class="btn btn--sm" data-action="export" id="bulk-export">${icon('download', 'icon--sm')} <span>${t('bulk.export')}</span></button>
            <button type="button" class="btn btn--sm" data-action="print" id="bulk-print">${icon('printer', 'icon--sm')} <span>${t('bulk.print')}</span></button>
            <button type="button" class="btn btn--ghost btn--sm" data-action="clear-selection" id="bulk-clear">${icon('x', 'icon--sm')} <span>${t('bulk.clear')}</span></button>
          </div>
        </div>
      `;
    }

    function footer(total, pages) {
      const from = total ? (state.p - 1) * state.per + 1 : 0;
      const to = Math.min(total, state.p * state.per);
      return html`
        <footer class="data__foot">
          <p class="data__range">${t('table.range', { from, to, total, count: total })}</p>
          <div class="data__paging">
            <nav class="pager" aria-label="${t('table.pagination')}">
              <button type="button" class="btn btn--icon btn--sm" data-action="page" data-page="${state.p - 1}" id="page-prev"
                aria-label="${t('table.prevPage')}" ${state.p <= 1 ? 'disabled' : ''}>${icon('chevron-left')}</button>
              <span class="pager__status" aria-current="page">${t('table.pageOf', { page: state.p, pages })}</span>
              <button type="button" class="btn btn--icon btn--sm" data-action="page" data-page="${state.p + 1}" id="page-next"
                aria-label="${t('table.nextPage')}" ${state.p >= pages ? 'disabled' : ''}>${icon('chevron-right')}</button>
            </nav>
            <label class="per-page">
              <span class="sr-only">${t('table.perPageLabel')}</span>
              <select class="select select--sm" data-action="per-page" id="per-page">
                ${PER_PAGE.map((n) => html`<option value="${n}" ${n === state.per ? 'selected' : ''}>${t('table.perPage', { count: n })}</option>`)}
              </select>
            </label>
          </div>
        </footer>
      `;
    }

    function mobileSort() {
      const visible = columns.filter((c) => c.visible);
      return html`
        <div class="data__mobile-sort">
          <label class="field">
            <span class="sr-only">${t('table.sortBy')}</span>
            <select class="select select--sm" data-action="sort-select" id="sort-select" aria-label="${t('table.sortBy')}">
              ${visible.flatMap((c) => ['asc', 'desc'].map((dir) => html`<option value="${c.id}:${dir}" ${state.sort === c.id && state.dir === dir ? 'selected' : ''}>
                ${t('table.sortOption', { column: t(`columns.${c.id}`), dir: t(`table.${dir}`) })}
              </option>`))}
            </select>
          </label>
        </div>
      `;
    }

    const emptyNearest = () => {
      const value = state.y * 12 + state.m;
      if (value > LAST_PERIOD.year * 12 + LAST_PERIOD.month) return LAST_PERIOD;
      if (value < FIRST_PERIOD.year * 12 + FIRST_PERIOD.month) return FIRST_PERIOD;
      return null;
    };

    function drawRegion() {
      const region = slot('region');
      const panel = $('#reg-panel', outlet);
      panel.setAttribute('aria-busy', String(data.status === 'loading'));
      const announce = slot('announce');

      if (data.status === 'loading') {
        render(region, html`
          <div class="summary summary--loading" aria-hidden="true">
            <div class="kpis">${[0, 1, 2].map(() => html`<div class="kpi"><span class="skeleton" style="width:3rem"></span><span class="skeleton skeleton--lg" style="width:8rem"></span></div>`)}</div>
          </div>
          ${tableSkeleton(Math.min(state.per, 8))}
          <p class="sr-only">${t('states.loading')}</p>
        `);
        return;
      }

      if (data.status === 'error') {
        render(region, html`
          <div class="state state--error" role="alert">
            <span class="state__icon">${icon('alert-octagon')}</span>
            <h2 class="state__title">${t('states.errorTitle')}</h2>
            <p class="state__text">${t('states.errorText')}</p>
            <div class="state__actions">
              <button type="button" class="btn btn--primary" data-action="retry" id="retry">${icon('refresh', 'icon--sm')} ${t('states.retry')}</button>
            </div>
            <p class="state__code">${t('states.errorCode', { code: data.error?.code ?? 'UNKNOWN' })}</p>
          </div>
        `);
        return;
      }

      const all = allDocs();
      if (!all.length) {
        const nearest = emptyNearest();
        render(region, html`
          <div class="state">
            <span class="state__icon">${icon('inbox')}</span>
            <h2 class="state__title">${t('states.emptyTitle', { period: fmt.monthYear(state.y, state.m) })}</h2>
            <p class="state__text">${t(`states.emptyText.${state.r}`)}</p>
            <div class="state__actions">
              ${nearest ? html`<button type="button" class="btn btn--primary" data-action="go-period" data-year="${nearest.year}" data-month="${nearest.month}">
                ${t('states.goTo', { period: fmt.monthYear(nearest.year, nearest.month) })}</button>` : ''}
              <button type="button" class="btn" data-action="open-period">${icon('calendar', 'icon--sm')} ${t('states.choosePeriod')}</button>
            </div>
          </div>
        `);
        announce.textContent = t('states.emptyTitle', { period: fmt.monthYear(state.y, state.m) });
        return;
      }

      const docs = filtered();
      if (!docs.length) {
        render(region, html`
          <div class="state">
            <span class="state__icon">${icon('search-x')}</span>
            <h2 class="state__title">${t('states.noResultsTitle')}</h2>
            <p class="state__text">${t('states.noResultsText', { count: all.length })}</p>
            <div class="state__actions">
              <button type="button" class="btn btn--primary" data-action="clear-filters" id="no-results-clear">${icon('rotate-ccw', 'icon--sm')} ${t('filters.clearAll')}</button>
            </div>
          </div>
        `);
        announce.textContent = t('states.noResultsTitle');
        return;
      }

      const pages = Math.max(1, Math.ceil(docs.length / state.per));
      if (state.p > pages) state.p = pages;
      const page = docs.slice((state.p - 1) * state.per, state.p * state.per);

      renderPreservingFocus(region, html`
        ${summary(docs, all)}
        ${bulkBar()}
        ${mobileSort()}
        ${dataTable({
          docs: page,
          columns,
          sort: state.sort,
          dir: state.dir,
          selection,
          expanded,
          labelsFor,
          caption: `${t(`registers.tabs.${state.r}`)} — ${fmt.monthYear(state.y, state.m)}`,
        })}
        ${footer(docs.length, pages)}
      `);

      const pageBox = $('#select-page', region);
      if (pageBox) pageBox.indeterminate = $('.dt', region).dataset.selectState === 'some';
      announce.textContent = t('table.announce', { count: docs.length });
    }

    function drawAll() {
      drawTabs();
      drawPeriod();
      drawFiltersButton();
      drawFiltersBody();
      drawChips();
      drawMoreMenu();
      drawRegion();
    }

    /* ---------- data loading ---------- */

    async function load() {
      controller?.abort();
      controller = new AbortController();
      data = { status: 'loading', docs: null, error: null };
      drawTabs();
      drawFiltersButton();
      drawMoreMenu();
      drawRegion();
      try {
        const docs = await fetchPeriod({ year: state.y, month: state.m }, { signal: controller.signal });
        data = { status: 'ready', docs, error: null };
      } catch (error) {
        if (error.name === 'AbortError') return;
        data = { status: 'error', docs: null, error };
      }
      drawTabs();
      drawFiltersButton();
      drawMoreMenu();
      drawRegion();
    }

    /* ---------- state transitions ---------- */

    function update(patch, { reload = false, resetPage = true, filtersFromForm = false } = {}) {
      Object.assign(state, patch);
      if (resetPage && !('p' in patch)) state.p = 1;
      syncUrl();
      if (reload) {
        selection.clear();
        expanded.clear();
        browseYear = state.y;
        drawPeriod();
        load();
        return;
      }
      if (!filtersFromForm) drawFiltersBody();
      drawFiltersButton();
      drawChips();
      drawMoreMenu();
      drawRegion();
    }

    function setRegister(r) {
      if (r === state.r) return;
      selection.clear();
      expanded.clear();
      Object.assign(state, {
        r,
        op: OPERATIONS[r].includes(state.op) ? state.op : '',
        jpk: JPK_CODES[r].includes(state.jpk) ? state.jpk : '',
        s: state.s.filter((s) => SERIES[r].includes(s)),
        p: 1,
      });
      syncUrl();
      drawAll();
      $(`#tab-${r}`, outlet)?.focus();
    }

    function setPeriod(year, month) {
      if (!YEARS.includes(year)) return;
      $('#pop-period', outlet)?.hidePopover();
      update({ y: year, m: month }, { reload: true });
    }

    const clearFilters = () => {
      searchInput.value = '';
      update({ op: '', jpk: '', s: [], l: [], q: '' });
    };

    const scopeDocs = () => {
      const docs = filtered();
      return selection.size ? docs.filter((d) => selection.has(d.id)) : docs;
    };

    const fileBase = () => `${t(`registers.fileName.${state.r}`)}-${state.y}-${String(state.m).padStart(2, '0')}`;

    function exportCsv() {
      const docs = scopeDocs();
      if (!docs.length) return;
      downloadCsv(`${fileBase()}.csv`, docs);
      toast(t('export.done', { count: docs.length }));
    }

    function preparePrint() {
      if (data.status !== 'ready') return;
      const docs = scopeDocs();
      renderPrintReport({
        title: t(`registers.tabs.${state.r}`),
        period: fmt.monthYear(state.y, state.m),
        docs,
        columns,
        totals: totalsOf(docs),
      });
    }

    async function editColumns() {
      const next = await openColumnsDialog(columns);
      if (!next) return;
      columns = next;
      persisted.set('columns', columns);
      if (!columns.some((c) => c.visible && c.id === state.sort)) state.sort = DEFAULTS.sort;
      drawRegion();
      toast(t('columnsDialog.saved'));
    }

    async function copyText(value) {
      try {
        await navigator.clipboard.writeText(value);
        toast(t('detail.copied'));
      } catch {
        toast(t('detail.copyFailed'), { type: 'error' });
      }
    }

    /* ---------- events ---------- */

    function onClick(event) {
      const target = event.target.closest('[data-action]');
      if (!target || target.matches('input, select')) return;
      const { action } = target.dataset;

      switch (action) {
        case 'tab': setRegister(target.dataset.register); break;
        case 'period-step': {
          const next = shiftMonth(state.y, state.m, Number(target.dataset.delta));
          setPeriod(next.year, next.month);
          break;
        }
        case 'browse-year': {
          const index = YEARS.indexOf(browseYear) + Number(target.dataset.delta);
          if (YEARS[index]) {
            browseYear = YEARS[index];
            render($('#pop-period', outlet), periodGrid({ year: state.y, month: state.m, browseYear }));
            $(`[data-action="browse-year"][data-delta="${target.dataset.delta}"]`, outlet)?.focus();
          }
          break;
        }
        case 'pick-month': setPeriod(Number(target.dataset.year), Number(target.dataset.month)); break;
        case 'go-period': setPeriod(Number(target.dataset.year), Number(target.dataset.month)); break;
        case 'open-period': $('#pop-period', outlet)?.showPopover(); $('#pop-period .period-pop__month[aria-pressed="true"], #pop-period .period-pop__month', outlet)?.focus(); break;
        case 'clear-filters': clearFilters(); break;
        case 'clear-search':
          searchInput.value = '';
          update({ q: '' });
          searchInput.focus();
          break;
        case 'remove-filter': {
          const { key, value } = target.dataset;
          if (key === 'q') { searchInput.value = ''; update({ q: '' }); }
          else if (key === 's' || key === 'l') update({ [key]: state[key].filter((v) => v !== value) });
          else update({ [key]: '' });
          (slot('chips').querySelector('[data-action="remove-filter"]') ?? searchInput).focus();
          break;
        }
        case 'sort': {
          const column = target.dataset.sort;
          const dir = state.sort === column && state.dir === 'asc' ? 'desc' : 'asc';
          update({ sort: column, dir });
          break;
        }
        case 'expand': {
          const id = target.dataset.id;
          const open = !expanded.has(id);
          if (open) expanded.add(id); else expanded.delete(id);
          const row = target.closest('tr');
          const doc = allDocs().find((d) => d.id === id);
          if (row && doc) toggleRowDetail(row, doc, { labelsFor }, open);
          else drawRegion();
          break;
        }
        case 'page': update({ p: Number(target.dataset.page) }, { resetPage: false }); $('#reg-panel', outlet).scrollIntoView({ block: 'nearest', behavior: 'smooth' }); break;
        case 'retry':
          setQueryParam('state', null);
          switcher.sync();
          load();
          break;
        case 'labels': {
          const ids = [...selection];
          openLabelsDialog(ids);
          break;
        }
        case 'edit-labels': openLabelsDialog([target.dataset.id]); break;
        case 'print': preparePrint(); window.print(); break;
        case 'export': exportCsv(); break;
        case 'columns': editColumns(); break;
        case 'clear-selection':
          selection.clear();
          drawMoreMenu();
          drawRegion();
          $('#select-page', outlet)?.focus();
          break;
        case 'copy': copyText(target.dataset.value); break;
        default:
      }
    }

    function onChange(event) {
      const el = event.target;

      if (el.closest('[data-slot="filters-body"]')) {
        const form = slot('filters-body');
        const fd = new FormData(form);
        update({ op: fd.get('op') ?? '', jpk: fd.get('jpk') ?? '', s: fd.getAll('s'), l: fd.getAll('l') }, { filtersFromForm: true });
        return;
      }

      switch (el.dataset.action) {
        case 'select-row':
          if (el.checked) selection.add(el.dataset.id); else selection.delete(el.dataset.id);
          drawMoreMenu();
          drawRegion();
          break;
        case 'select-page': {
          const docs = filtered().slice((state.p - 1) * state.per, state.p * state.per);
          const allSelected = docs.every((d) => selection.has(d.id));
          docs.forEach((d) => (allSelected ? selection.delete(d.id) : selection.add(d.id)));
          drawMoreMenu();
          drawRegion();
          break;
        }
        case 'per-page': update({ per: Number(el.value) }); break;
        case 'sort-select': {
          const [sort, dir] = el.value.split(':');
          update({ sort, dir });
          break;
        }
        default:
      }
    }

    const onSearch = debounce(() => update({ q: searchInput.value }), 200);

    function onKeydown(event) {
      const tab = event.target.closest('[role="tab"]');
      if (tab && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        const index = REGISTERS.indexOf(state.r);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? REGISTERS.length - 1
          : (index + (event.key === 'ArrowRight' ? 1 : -1) + REGISTERS.length) % REGISTERS.length;
        setRegister(REGISTERS[next]);
      }
      if (event.target === searchInput && event.key === 'Escape' && searchInput.value) {
        event.stopPropagation();
        searchInput.value = '';
        update({ q: '' });
      }
    }

    function onGlobalKeydown(event) {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (document.querySelector('dialog[open]')) return;
      event.preventDefault();
      searchInput.focus();
      searchInput.select();
    }

    function onToggle(event) {
      if (event.target.matches?.('[data-rates]')) {
        ratesOpen = event.target.open;
        persisted.set('ratesOpen', ratesOpen);
      }
      if (event.target.id === 'pop-period' && event.newState === 'closed' && browseYear !== state.y) {
        browseYear = state.y;
        render($('#pop-period', outlet), periodGrid({ year: state.y, month: state.m, browseYear }));
      }
    }

    outlet.addEventListener('click', onClick);
    outlet.addEventListener('change', onChange);
    outlet.addEventListener('keydown', onKeydown);
    outlet.addEventListener('toggle', onToggle, true);
    searchInput.addEventListener('input', onSearch);
    document.addEventListener('keydown', onGlobalKeydown);
    addEventListener('beforeprint', preparePrint);
    addEventListener('afterprint', clearPrintReport);

    const unsubscribe = appStore.subscribe((_, patch) => {
      if ('labels' in patch || 'docLabels' in patch) {
        state.l = state.l.filter((id) => appStore.get().labels.some((l) => l.id === id));
        drawFiltersBody();
        drawChips();
        drawFiltersButton();
        drawRegion();
      }
    });

    const switcher = mountStateSwitcher(() => load());

    syncUrl();
    drawAll();
    load();

    return () => {
      controller?.abort();
      document.removeEventListener('keydown', onGlobalKeydown);
      removeEventListener('beforeprint', preparePrint);
      removeEventListener('afterprint', clearPrintReport);
      unsubscribe();
      switcher.destroy();
      clearPrintReport();
    };
  },
};
