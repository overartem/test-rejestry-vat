import { html, icon, render } from '../utils/dom.js';
import { t } from '../i18n.js';
import { appStore } from '../app-state.js';
import { openDialog } from './dialog.js';
import { labelName } from './filters.js';
import { toast } from './toast.js';

const COLORS = ['teal', 'amber', 'red', 'blue', 'violet'];

/**
 * Assign labels to documents (tri-state when documents differ) and create or
 * delete labels. With no documents it acts as a label manager.
 */
export async function openLabelsDialog(docIds = []) {
  const { labels, docLabels } = appStore.get();
  let draftLabels = structuredClone(labels);
  const state = new Map(draftLabels.map((l) => {
    const count = docIds.filter((id) => docLabels[id]?.includes(l.id)).length;
    return [l.id, count === 0 ? 'off' : count === docIds.length ? 'on' : 'mixed'];
  }));
  let colorIndex = labels.length % COLORS.length;
  let list;
  const snapshot = () => JSON.stringify([draftLabels, [...state]]);
  const initial = snapshot();

  const draw = (focusId) => {
    render(list, html`${draftLabels.length
      ? draftLabels.map((l) => html`<li class="label-row">
          ${docIds.length
            ? html`<label class="check-row">
                <input type="checkbox" value="${l.id}" id="lbl-${l.id}" ${state.get(l.id) === 'on' ? 'checked' : ''} data-mixed="${state.get(l.id) === 'mixed'}">
                <span class="label" data-color="${l.color}">${labelName(l)}</span>
              </label>`
            : html`<span class="label" data-color="${l.color}">${labelName(l)}</span>`}
          <button type="button" class="btn btn--ghost btn--icon btn--sm" data-delete="${l.id}" aria-label="${t('labels.delete', { name: labelName(l) })}">${icon('trash', 'icon--sm')}</button>
        </li>`)
      : html`<li class="field__hint">${t('labels.none')}</li>`}`);
    list.querySelectorAll('[data-mixed="true"]').forEach((cb) => { cb.indeterminate = true; });
    if (focusId) document.getElementById(focusId)?.focus();
  };

  const result = await openDialog({
    title: docIds.length ? t('labels.assignTitle', { count: docIds.length }) : t('labels.manageTitle'),
    description: docIds.length ? t('labels.assignLead') : t('labels.manageLead'),
    body: html`
      <ul class="label-list" role="list"></ul>
      <div class="label-create">
        <label class="field">
          <span class="field__label">${t('labels.new')}</span>
          <span class="label-create__row">
            <input class="input" name="newLabel" maxlength="24" placeholder="${t('labels.newPlaceholder')}" autocomplete="off">
            <button type="button" class="btn" data-create>${icon('plus', 'icon--sm')} ${t('labels.add')}</button>
          </span>
        </label>
      </div>
    `,
    footer: html`
      <button type="submit" value="cancel" class="btn">${t('common.cancel')}</button>
      <button type="submit" value="save" class="btn btn--primary">${t(docIds.length ? 'common.apply' : 'common.save')}</button>
    `,
    isDirty: () => snapshot() !== initial || Boolean(list.closest('form').elements.newLabel.value.trim()),
    onMount(dialog) {
      list = dialog.querySelector('.label-list');
      const input = dialog.querySelector('[name="newLabel"]');
      draw();

      const create = () => {
        const name = input.value.trim();
        if (!name) return input.focus();
        if (draftLabels.some((l) => labelName(l).toLowerCase() === name.toLowerCase())) {
          input.setCustomValidity(t('labels.exists'));
          input.reportValidity();
          return;
        }
        const id = `lbl-${Date.now().toString(36)}`;
        draftLabels.push({ id, name, color: COLORS[colorIndex++ % COLORS.length] });
        state.set(id, docIds.length ? 'on' : 'off');
        input.value = '';
        draw();
        input.focus();
      };

      input.addEventListener('input', () => input.setCustomValidity(''));
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') { event.preventDefault(); create(); }
      });
      dialog.querySelector('[data-create]').addEventListener('click', create);

      list.addEventListener('change', (event) => {
        state.set(event.target.value, event.target.checked ? 'on' : 'off');
      });
      list.addEventListener('click', (event) => {
        const btn = event.target.closest('[data-delete]');
        if (!btn) return;
        draftLabels = draftLabels.filter((l) => l.id !== btn.dataset.delete);
        state.delete(btn.dataset.delete);
        draw();
        input.focus();
      });
    },
  });

  if (result !== 'save') return false;

  const validIds = new Set(draftLabels.map((l) => l.id));
  const nextDocLabels = {};
  for (const [docId, ids] of Object.entries(docLabels)) {
    const kept = ids.filter((id) => validIds.has(id));
    if (kept.length) nextDocLabels[docId] = kept;
  }
  for (const docId of docIds) {
    const current = new Set(nextDocLabels[docId] ?? []);
    for (const [labelId, value] of state) {
      if (value === 'on') current.add(labelId);
      if (value === 'off') current.delete(labelId);
    }
    if (current.size) nextDocLabels[docId] = [...current];
    else delete nextDocLabels[docId];
  }
  appStore.set({ labels: draftLabels, docLabels: nextDocLabels });
  toast(docIds.length ? t('labels.assigned', { count: docIds.length }) : t('labels.saved'));
  return true;
}
