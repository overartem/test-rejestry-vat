export class Raw {
  constructor(value) { this.value = value; }
  toString() { return this.value; }
}

export const raw = (value) => new Raw(value);

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ESCAPES[c]);

/** Booleans render as "true"/"false" so they can feed ARIA attributes directly. */
const stringify = (value) => {
  if (value == null) return '';
  if (Array.isArray(value)) return value.map(stringify).join('');
  if (value instanceof Raw) return value.value;
  return esc(value);
};

/** Tagged template that escapes interpolations unless they are `Raw` (nested `html` results). */
// Conditional fragments must use ternaries (`cond ? html`…` : ''`), never `cond && …`.
export const html = (strings, ...values) =>
  raw(strings.reduce((out, str, i) => out + str + (i < values.length ? stringify(values[i]) : ''), ''));

export const icon = (name, cls = '') =>
  raw(`<svg class="icon ${cls}" aria-hidden="true" focusable="false"><use href="#i-${name}"></use></svg>`);

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

export function render(el, content) {
  el.innerHTML = content instanceof Raw ? content.value : esc(content ?? '');
}

/** Re-renders while keeping focus on the element with the same id (if it still exists). */
export function renderPreservingFocus(el, content) {
  const active = document.activeElement;
  const focusId = active && el.contains(active) ? active.id : null;
  render(el, content);
  if (focusId) document.getElementById(focusId)?.focus({ preventScroll: true });
}

export function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

export const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export const normalize = (value) =>
  String(value ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
