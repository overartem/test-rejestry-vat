import { html, icon, render } from '../utils/dom.js';
import { t } from '../i18n.js';
import { openDialog } from './dialog.js';
import { DEFAULT_COLUMNS } from './data-table.js';

/** Lets the user reorder (drag or arrow buttons) and toggle table columns. Resolves with new columns or null. */
export async function openColumnsDialog(columns) {
  let draft = structuredClone(columns);
  let list;
  let status;

  const draw = (focusId) => {
    render(list, html`${draft.map((col, i) => html`
      <li class="col-item" draggable="true" data-index="${i}">
        <span class="col-item__grip" aria-hidden="true">${icon('grip')}</span>
        <label class="check-row col-item__label">
          <input type="checkbox" data-index="${i}" ${col.visible ? 'checked' : ''} id="col-vis-${col.id}">
          <span>${t(`columns.${col.id}`)}</span>
        </label>
        <span class="col-item__moves">
          <button type="button" class="btn btn--ghost btn--icon btn--sm" data-move="-1" data-index="${i}" id="col-up-${col.id}"
            aria-label="${t('columnsDialog.moveUp', { name: t(`columns.${col.id}`) })}" ${i === 0 ? 'disabled' : ''}>${icon('arrow-up', 'icon--sm')}</button>
          <button type="button" class="btn btn--ghost btn--icon btn--sm" data-move="1" data-index="${i}" id="col-down-${col.id}"
            aria-label="${t('columnsDialog.moveDown', { name: t(`columns.${col.id}`) })}" ${i === draft.length - 1 ? 'disabled' : ''}>${icon('arrow-down', 'icon--sm')}</button>
        </span>
      </li>`)}`);
    const visibleCount = draft.filter((c) => c.visible).length;
    list.querySelectorAll('input[type="checkbox"]').forEach((cb) => { cb.disabled = cb.checked && visibleCount === 1; });
    if (focusId) document.getElementById(focusId)?.focus();
  };

  const move = (from, to) => {
    if (to < 0 || to >= draft.length || from === to) return;
    const [item] = draft.splice(from, 1);
    draft.splice(to, 0, item);
    status.textContent = t('columnsDialog.moved', { name: t(`columns.${item.id}`), position: to + 1 });
  };

  const result = await openDialog({
    title: t('columnsDialog.title'),
    description: t('columnsDialog.lead'),
    body: html`<ul class="col-list" role="list"></ul><p class="sr-only" aria-live="polite" data-status></p>`,
    footer: html`
      <button type="button" class="btn btn--ghost dialog__foot-start" data-reset>${icon('rotate-ccw', 'icon--sm')} ${t('columnsDialog.reset')}</button>
      <button type="submit" value="cancel" class="btn">${t('common.cancel')}</button>
      <button type="submit" value="apply" class="btn btn--primary">${t('common.apply')}</button>
    `,
    isDirty: () => JSON.stringify(draft) !== JSON.stringify(columns),
    onMount(dialog) {
      list = dialog.querySelector('.col-list');
      status = dialog.querySelector('[data-status]');
      draw();

      list.addEventListener('change', (event) => {
        const index = Number(event.target.dataset.index);
        draft[index].visible = event.target.checked;
        draw(event.target.id);
      });
      list.addEventListener('click', (event) => {
        const btn = event.target.closest('[data-move]');
        if (!btn) return;
        const from = Number(btn.dataset.index);
        const delta = Number(btn.dataset.move);
        const id = draft[from].id;
        move(from, from + delta);
        const to = from + delta;
        const edge = to === 0 || to === draft.length - 1;
        draw(edge ? `col-${delta < 0 ? 'down' : 'up'}-${id}` : `col-${delta < 0 ? 'up' : 'down'}-${id}`);
      });
      dialog.querySelector('[data-reset]').addEventListener('click', () => {
        draft = structuredClone(DEFAULT_COLUMNS);
        draw();
        status.textContent = t('columnsDialog.resetDone');
      });

      let dragFrom = null;
      list.addEventListener('dragstart', (event) => {
        const item = event.target.closest('.col-item');
        dragFrom = Number(item.dataset.index);
        item.classList.add('is-dragging');
        event.dataTransfer.effectAllowed = 'move';
      });
      list.addEventListener('dragover', (event) => {
        if (dragFrom == null) return;
        event.preventDefault();
        list.querySelectorAll('.is-drop-target').forEach((el) => el.classList.remove('is-drop-target'));
        event.target.closest('.col-item')?.classList.add('is-drop-target');
      });
      list.addEventListener('drop', (event) => {
        event.preventDefault();
        const target = event.target.closest('.col-item');
        if (target && dragFrom != null) move(dragFrom, Number(target.dataset.index));
        dragFrom = null;
        draw();
      });
      list.addEventListener('dragend', () => { dragFrom = null; draw(); });
    },
  });

  return result === 'apply' ? draft : null;
}
