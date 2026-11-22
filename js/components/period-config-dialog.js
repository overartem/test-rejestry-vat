import { html, icon } from '../utils/dom.js';
import { t } from '../i18n.js';
import { appStore } from '../app-state.js';
import { YEARS } from '../data/mock.js';
import { openDialog } from './dialog.js';
import { toast } from './toast.js';

const FORMS = ['kpir', 'lump', 'full'];
const VAT_PERIODS = ['monthly', 'quarterly'];

export async function openPeriodConfig() {
  const cfg = appStore.get().periodConfig;
  let form;
  let initial;
  const serialize = () => new URLSearchParams(new FormData(form)).toString();

  const setError = (name, message) => {
    const error = form.querySelector(`#period-${name}-error`);
    error.textContent = message;
    error.hidden = !message;
    form.querySelectorAll(`[name="${name}"]`).forEach((el) => (message ? el.setAttribute('aria-invalid', 'true') : el.removeAttribute('aria-invalid')));
  };

  const result = await openDialog({
    title: t('period.dialogTitle'),
    description: t('period.dialogLead'),
    body: html`
      <div class="form-grid">
        <label class="field">
          <span class="field__label">${t('period.fiscalYear')}</span>
          <select class="select" name="year">
            ${YEARS.map((y) => html`<option value="${y}" ${y === cfg.year ? 'selected' : ''}>${y}</option>`)}
          </select>
        </label>
        <label class="field">
          <span class="field__label">${t('period.start')}</span>
          <input class="input" type="date" name="start" value="${cfg.start}" required aria-describedby="period-start-error">
          <span class="field__error" id="period-start-error" hidden></span>
        </label>
        <label class="field">
          <span class="field__label">${t('period.end')}</span>
          <input class="input" type="date" name="end" value="${cfg.end}" required aria-describedby="period-end-error">
          <span class="field__error" id="period-end-error" hidden></span>
        </label>
      </div>
      <fieldset aria-describedby="period-form-hint period-form-error">
        <legend>${t('period.form')}</legend>
        <p class="field__hint" id="period-form-hint">${t('period.formHint')}</p>
        <div class="chip-group">
          ${FORMS.map((f) => html`<label class="chip-toggle">
            <input type="radio" name="form" value="${f}" ${cfg.form === f ? 'checked' : ''} required>
            <span>${t(`period.forms.${f}`)}</span>
          </label>`)}
        </div>
        <span class="field__error" id="period-form-error" hidden></span>
      </fieldset>
      <div class="form-grid">
        <label class="check-row">
          <input type="checkbox" name="vatPayer" ${cfg.vatPayer ? 'checked' : ''}>
          <span>${t('period.vatPayer')}</span>
        </label>
        <label class="field">
          <span class="field__label">${t('period.vatPeriod')}</span>
          <select class="select" name="vatPeriod">
            ${VAT_PERIODS.map((p) => html`<option value="${p}" ${cfg.vatPeriod === p ? 'selected' : ''}>${t(`period.vatPeriods.${p}`)}</option>`)}
          </select>
        </label>
      </div>
      <div class="callout callout--info">
        ${icon('info')}
        <span>${t('period.demoNote')}</span>
      </div>
    `,
    footer: html`
      ${cfg.configured ? html`<button type="submit" value="reset" class="btn btn--danger-ghost dialog__foot-start" formnovalidate>${t('period.reset')}</button>` : ''}
      <button type="submit" value="cancel" class="btn" formnovalidate>${t('common.cancel')}</button>
      <button type="submit" value="save" class="btn btn--primary">${t('period.save')}</button>
    `,
    isDirty: () => serialize() !== initial,
    onMount(dialog) {
      form = dialog.querySelector('form');
      initial = serialize();
      const year = form.elements.year;
      year.addEventListener('change', () => {
        form.elements.start.value = `${year.value}-01-01`;
        form.elements.end.value = `${year.value}-12-31`;
      });
      form.noValidate = true;
      form.addEventListener('input', (event) => {
        const name = event.target.name;
        if (name === 'start' || name === 'end') { setError('start', ''); setError('end', ''); }
        if (name === 'form') setError('form', '');
      });
      form.addEventListener('submit', (event) => {
        if (event.submitter?.value !== 'save') return;
        const { start, end } = form.elements;
        const errors = {
          start: start.value ? '' : t('period.dateRequired'),
          end: !end.value ? t('period.dateRequired') : start.value > end.value ? t('period.rangeError') : '',
          form: form.querySelector('[name="form"]:checked') ? '' : t('period.formRequired'),
        };
        Object.entries(errors).forEach(([name, message]) => setError(name, message));
        const first = Object.keys(errors).find((name) => errors[name]);
        if (!first) return;
        event.preventDefault();
        (first === 'form' ? form.querySelector('[name="form"]') : form.elements[first]).focus();
      });
    },
  });

  if (result === 'save') {
    const data = new FormData(form);
    appStore.set({
      periodConfig: {
        configured: true,
        year: Number(data.get('year')),
        start: data.get('start'),
        end: data.get('end'),
        form: data.get('form'),
        vatPayer: data.get('vatPayer') === 'on',
        vatPeriod: data.get('vatPeriod'),
      },
    });
    toast(t('period.saved'));
  } else if (result === 'reset') {
    appStore.set({ periodConfig: { ...cfg, configured: false, form: '' } });
    toast(t('period.resetDone'), { type: 'info' });
  }
}
