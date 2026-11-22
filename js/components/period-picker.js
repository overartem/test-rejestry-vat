import { html, icon } from '../utils/dom.js';
import { t } from '../i18n.js';
import { monthName, monthYear } from '../utils/format.js';
import { YEARS, isPeriodInRange } from '../data/mock.js';

export const shiftMonth = (year, month, delta) => {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
};

const inYears = ({ year }) => YEARS.includes(year);

/** Prev / current / next month control with a month-grid popover. */
export function periodPicker({ year, month, browseYear = year }) {
  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);
  return html`
    <div class="period" role="group" aria-label="${t('registers.period')}">
      <button type="button" class="btn btn--icon period__step" data-action="period-step" data-delta="-1"
        aria-label="${t('registers.prevMonth')}: ${monthYear(prev.year, prev.month)}" ${inYears(prev) ? '' : 'disabled'}>
        ${icon('chevron-left')}
      </button>
      <button type="button" class="btn period__current" popovertarget="pop-period" aria-haspopup="dialog" aria-expanded="false" id="btn-period">
        ${icon('calendar', 'muted')}
        <span><span class="sr-only">${t('registers.period')}: </span>${monthYear(year, month)}</span>
        ${icon('chevron-down', 'icon--sm muted')}
      </button>
      <button type="button" class="btn btn--icon period__step" data-action="period-step" data-delta="1"
        aria-label="${t('registers.nextMonth')}: ${monthYear(next.year, next.month)}" ${inYears(next) ? '' : 'disabled'}>
        ${icon('chevron-right')}
      </button>
      <div popover id="pop-period" class="popover period-pop" role="dialog" aria-label="${t('registers.choosePeriod')}">
        ${periodGrid({ year, month, browseYear })}
      </div>
    </div>
  `;
}

export function periodGrid({ year, month, browseYear }) {
  const yearIndex = YEARS.indexOf(browseYear);
  return html`
    <div class="period-pop__head">
      <button type="button" class="btn btn--ghost btn--icon btn--sm" data-action="browse-year" data-delta="-1"
        aria-label="${t('registers.prevYear')}" ${yearIndex > 0 ? '' : 'disabled'}>${icon('chevron-left')}</button>
      <strong aria-live="polite">${browseYear}</strong>
      <button type="button" class="btn btn--ghost btn--icon btn--sm" data-action="browse-year" data-delta="1"
        aria-label="${t('registers.nextYear')}" ${yearIndex < YEARS.length - 1 ? '' : 'disabled'}>${icon('chevron-right')}</button>
    </div>
    <div class="period-pop__grid">
      ${Array.from({ length: 12 }, (_, i) => {
        const m = i + 1;
        const selected = browseYear === year && m === month;
        const hasData = isPeriodInRange(browseYear, m);
        return html`<button type="button" class="period-pop__month" data-action="pick-month" data-year="${browseYear}" data-month="${m}"
          aria-pressed="${selected}" aria-label="${monthYear(browseYear, m)}${hasData ? '' : `, ${t('registers.noData')}`}">
          ${monthName(m, 'short')}
          ${hasData ? html`<span class="period-pop__dot" aria-hidden="true"></span>` : ''}
        </button>`;
      })}
    </div>
    <p class="period-pop__legend"><span class="period-pop__dot" aria-hidden="true"></span> ${t('registers.hasDocuments')}</p>
  `;
}
