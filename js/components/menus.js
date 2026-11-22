/**
 * Popover helpers:
 *  - positions popovers next to their invoker when CSS anchor positioning
 *    is not available,
 *  - adds roving keyboard navigation to [role="menu"],
 *  - closes menus after an item is activated.
 */

const supportsAnchor = CSS.supports('position-area: block-end') && CSS.supports('anchor-name: --a');
const sheetQuery = matchMedia('(width < 40rem)');
let anchorCounter = 0;

const invokerOf = (popover) => document.querySelector(`[popovertarget="${popover.id}"]`);

function linkAnchor(popover) {
  const invoker = invokerOf(popover);
  if (!invoker) return;
  if (!invoker.style.anchorName) invoker.style.anchorName = `--anchor-${++anchorCounter}`;
  popover.style.positionAnchor = invoker.style.anchorName;
}

function placeManually(popover) {
  const invoker = invokerOf(popover);
  if (!invoker) return;
  if (popover.classList.contains('popover--sheet') && sheetQuery.matches) {
    Object.assign(popover.style, { top: '', left: '' });
    return;
  }
  const a = invoker.getBoundingClientRect();
  const p = popover.getBoundingClientRect();
  const gap = 8;
  const alignStart = popover.classList.contains('popover--start');
  let left = alignStart ? a.left : a.right - p.width;
  left = Math.min(Math.max(8, left), innerWidth - p.width - 8);
  let top = a.bottom + gap;
  if (top + p.height > innerHeight - 8 && a.top - p.height - gap > 8) top = a.top - p.height - gap;
  Object.assign(popover.style, { top: `${top}px`, left: `${left}px`, margin: '0' });
}

// Chrome keeps a max-height-capped popover in its base position even when it is
// squeezed, so open it upwards ourselves when there is more room above.
function chooseSide(popover) {
  popover.style.positionArea = '';
  if (popover.classList.contains('popover--sheet') && sheetQuery.matches) return;
  const a = invokerOf(popover)?.getBoundingClientRect();
  if (!a) return;
  const below = innerHeight - a.bottom;
  const above = a.top;
  if (popover.scrollHeight + 16 <= below || above <= below) return;
  popover.style.positionArea = getComputedStyle(popover).positionArea.replace(/^(block-)?end\b/, '$1start');
}

const menuItems = (menu) =>
  [...menu.querySelectorAll('[role^="menuitem"]:not(:disabled):not([aria-disabled="true"])')];

function onMenuKeydown(event) {
  const menu = event.target.closest('[role="menu"]');
  if (!menu) return;
  const items = menuItems(menu);
  const index = items.indexOf(document.activeElement);
  const focusAt = (i) => items[(i + items.length) % items.length]?.focus();
  switch (event.key) {
    case 'ArrowDown': event.preventDefault(); focusAt(index + 1); break;
    case 'ArrowUp': event.preventDefault(); focusAt(index - 1); break;
    case 'Home': event.preventDefault(); focusAt(0); break;
    case 'End': event.preventDefault(); focusAt(items.length - 1); break;
    default:
  }
}

export function initPopovers() {
  document.addEventListener('beforetoggle', (event) => {
    const popover = event.target;
    if (!(popover instanceof HTMLElement) || !popover.hasAttribute('popover')) return;
    if (event.newState === 'open' && supportsAnchor) linkAnchor(popover);
  }, true);

  document.addEventListener('toggle', (event) => {
    const popover = event.target;
    if (!(popover instanceof HTMLElement) || !popover.hasAttribute('popover')) return;
    invokerOf(popover)?.setAttribute('aria-expanded', String(event.newState === 'open'));
    if (event.newState !== 'open') return;
    if (supportsAnchor) chooseSide(popover);
    else placeManually(popover);
    const menu = popover.querySelector('[role="menu"]');
    if (menu && popover.matches(':focus-within') === false) menuItems(menu)[0]?.focus();
  }, true);

  const reposition = () => {
    if (supportsAnchor) return;
    document.querySelectorAll('[popover]:popover-open').forEach(placeManually);
  };
  addEventListener('resize', reposition);
  addEventListener('scroll', reposition, { passive: true, capture: true });

  document.addEventListener('keydown', onMenuKeydown);

  document.addEventListener('click', (event) => {
    const item = event.target.closest('[role="menu"] [role="menuitem"]');
    if (!item || item.dataset.keepOpen != null) return;
    item.closest('[popover]')?.hidePopover();
  });
}
