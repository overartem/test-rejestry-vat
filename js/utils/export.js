import { html, render } from './dom.js';
import { t } from '../i18n.js';
import * as fmt from './format.js';
import { COLUMNS } from '../components/data-table.js';
import { COMPANY } from '../data/mock.js';

const csvCell = (value) => {
  const text = String(value ?? '');
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const EXPORT_COLUMNS = ['contractor', 'nip', 'date', 'number', 'operation', 'jpk', 'ksef', 'identifier', 'net', 'vat', 'gross'];

/** Semicolon-separated CSV with BOM — opens correctly in Polish Excel. */
export function downloadCsv(filename, docs) {
  const header = EXPORT_COLUMNS.map((id) => t(`columns.${id}`));
  const rows = docs.map((d) => EXPORT_COLUMNS.map((id) => (COLUMNS[id].csv ?? COLUMNS[id].value)(d)));
  const csv = [header, ...rows].map((row) => row.map(csvCell).join(';')).join('\r\n');
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Fills the print-only report region. Rendered on demand right before printing. */
export function renderPrintReport({ title, period, docs, columns, totals }) {
  const visible = columns.filter((c) => c.visible);
  render(document.getElementById('print-area'), html`
    <header class="print-head">
      <p>${COMPANY.name} · NIP ${COMPANY.nip}</p>
      <h1>${title}</h1>
      <p>${period} · ${t('print.documents', { count: docs.length })} · ${t('print.generated')} ${fmt.dateTime(new Date())}</p>
      <p class="print-note">${t('header.demoBody2')}</p>
    </header>
    <table class="print-table">
      <thead><tr>${visible.map((c) => html`<th class="${COLUMNS[c.id].numeric ? 'num' : ''}">${t(`columns.${c.id}`)}</th>`)}</tr></thead>
      <tbody>
        ${docs.map((d) => html`<tr>${visible.map((c) => html`<td class="${COLUMNS[c.id].numeric ? 'num' : ''}">${c.id === 'ksef' ? (d.ksef.number ?? t(`ksef.${d.ksef.status}`)) : c.id === 'contractor' ? d.contractor.name : COLUMNS[c.id].cell(d, { labelsFor: () => [] })}</td>`)}</tr>`)}
      </tbody>
    </table>
    <dl class="print-totals">
      <div><dt>${t('columns.net')}</dt><dd>${fmt.money(totals.net)}</dd></div>
      <div><dt>${t('columns.vat')}</dt><dd>${fmt.money(totals.vat)}</dd></div>
      <div><dt>${t('columns.gross')}</dt><dd>${fmt.money(totals.gross)}</dd></div>
    </dl>
  `);
}

export function clearPrintReport() {
  document.getElementById('print-area').replaceChildren();
}
