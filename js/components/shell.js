import { $, html, icon, render } from '../utils/dom.js';
import { t, getLang, setLang, LANGUAGES } from '../i18n.js';
import { appStore, resolvedTheme } from '../app-state.js';
import { navigate, onNavigate, currentPath } from '../router.js';
import { relativeTime, initials } from '../utils/format.js';
import { USER } from '../data/mock.js';
import { AREAS, evaluateArea } from '../data/areas.js';
import { toast } from './toast.js';
import { persisted } from '../store.js';

const NAV = [
  { path: '/obszary', key: 'overview', icon: 'grid' },
  ...AREAS.map((a) => ({ path: a.path, key: a.id, icon: a.icon, area: a })),
];

function applyTheme() {
  const { theme } = appStore.get();
  if (theme === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
}

function themeButton() {
  const dark = resolvedTheme() === 'dark';
  const label = t(dark ? 'header.themeToLight' : 'header.themeToDark');
  return html`<button type="button" class="btn btn--ghost btn--icon" data-action="theme" aria-label="${label}" title="${label}">
    ${icon(dark ? 'sun' : 'moon')}
  </button>`;
}

function notificationsContent() {
  const { notifications } = appStore.get();
  const unread = notifications.filter((n) => !n.read).length;
  return html`
    <div class="popover__head">
      <h2>${t('header.notifications')}</h2>
      <button type="button" class="btn btn--link btn--sm" data-action="read-all" ${unread ? '' : 'disabled'}>${t('header.markAllRead')}</button>
    </div>
    ${notifications.length
      ? html`<ul class="notif-list" role="list">
          ${notifications.map((n) => html`<li>
            <button type="button" class="notif ${n.read ? '' : 'is-unread'}" data-action="open-notification" data-id="${n.id}">
              <span class="notif__dot" aria-hidden="true"></span>
              <span class="notif__body">
                <strong>${t(`notifications.${n.key}.title`)}</strong>
                <span>${t(`notifications.${n.key}.body`)}</span>
                <time>${relativeTime(n.minutesAgo)}</time>
              </span>
              ${n.read ? '' : html`<span class="sr-only">${t('header.unread')}</span>`}
            </button>
          </li>`)}
        </ul>`
      : html`<p class="notif-empty">${t('header.noNotifications')}</p>`}
  `;
}

function bellButton() {
  const unread = appStore.get().notifications.filter((n) => !n.read).length;
  const label = unread ? `${t('header.notifications')}, ${t('header.unreadCount', { count: unread })}` : t('header.notifications');
  return html`<button type="button" class="btn btn--ghost btn--icon has-badge" popovertarget="pop-notifications" aria-haspopup="dialog" aria-expanded="false" aria-label="${label}" title="${t('header.notifications')}">
    ${icon('bell')}
    ${unread ? html`<span class="icon-badge" aria-hidden="true">${unread}</span>` : ''}
  </button>`;
}

function renderHeader() {
  const el = $('#app-header');
  render(el, html`
    <a class="brand" href="/obszary" data-link>
      <span class="brand__mark">${icon('logo')}</span>
      <span class="brand__greeting">${t('app.greeting', { name: USER.name })}</span>
    </a>

    <div class="header-actions">
      <button type="button" class="badge badge--warning demo-pill" popovertarget="pop-demo" aria-haspopup="dialog" aria-expanded="false">
        ${icon('flask')} ${t('header.demo')}
      </button>
      <div popover id="pop-demo" class="popover popover--wide" role="dialog" aria-labelledby="pop-demo-title">
        <div class="demo-info">
          <h2 id="pop-demo-title">${icon('flask')} ${t('header.demoTitle')}</h2>
          <p>${t('header.demoBody1')}</p>
          <p>${t('header.demoBody2')}</p>
        </div>
      </div>

      <span data-slot="theme">${themeButton()}</span>

      <span data-slot="bell">${bellButton()}</span>
      <div popover id="pop-notifications" class="popover popover--wide popover--flush" role="dialog" aria-label="${t('header.notifications')}" data-slot="notifications">
        ${notificationsContent()}
      </div>

      <span class="header-divider" aria-hidden="true"></span>

      <button type="button" class="user-btn" popovertarget="pop-user" aria-haspopup="menu" aria-expanded="false" aria-label="${t('header.accountMenu')}: ${USER.name}">
        <span class="user-btn__text"><strong>${USER.name}</strong><span>${t('header.account')}</span></span>
        <span class="avatar" aria-hidden="true">${initials(USER.name)}</span>
        ${icon('chevron-down', 'icon--sm muted')}
      </button>
      <div popover id="pop-user" class="popover">
        <div class="user-card">
          <span class="avatar" aria-hidden="true">${initials(USER.name)}</span>
          <span><strong>${USER.name}</strong><span>${t('app.greeting', { name: USER.name })}</span></span>
        </div>
        <div class="menu" role="menu" aria-label="${t('header.accountMenu')}">
          <button type="button" class="menu__item" role="menuitem" data-action="unavailable">${icon('user')} ${t('header.profile')}</button>
          <button type="button" class="menu__item" role="menuitem" data-action="unavailable">${icon('settings')} ${t('header.settings')}</button>
          <div class="menu__sep" role="separator"></div>
          <div class="menu__label" id="lang-label">${icon('globe', 'icon--sm')} ${t('header.language')}</div>
          <div role="group" aria-labelledby="lang-label" class="lang-switch">
            ${LANGUAGES.map((l) => html`<button type="button" class="menu__item" role="menuitemradio" aria-checked="${l === getLang()}" data-action="lang" data-lang="${l}">
              <span class="lang-code">${l.toUpperCase()}</span> ${t(`languages.${l}`)}
              ${l === getLang() ? html`<span class="menu__hint">${icon('check', 'icon--sm')}</span>` : ''}
            </button>`)}
          </div>
          <div class="menu__sep" role="separator"></div>
          <button type="button" class="menu__item" role="menuitem" data-action="unavailable">${icon('log-out')} ${t('header.logout')}</button>
        </div>
      </div>
    </div>
  `);
}

function renderNav() {
  const { periodConfig } = appStore.get();
  const path = currentPath();
  render($('#area-nav'), html`
    <ul class="area-nav__list" role="list" aria-label="${t('nav.label')}">
      ${NAV.map((item) => {
        const status = item.area ? evaluateArea(item.area, periodConfig).status : null;
        return html`<li>
          <a class="area-nav__link" href="${item.path}" data-link ${path === item.path ? html`aria-current="page"` : ''}>
            ${icon(item.icon)} ${t(`nav.${item.key}`)}
            ${status && status !== 'ready' ? html`<span class="area-nav__dot" data-status="${status}" aria-hidden="true"></span>` : ''}
          </a>
        </li>`;
      })}
    </ul>
  `);
  $('#area-nav').setAttribute('aria-label', t('nav.label'));
  revealActiveNavItem();
  document.fonts?.ready.then(revealActiveNavItem);
}

/** Centres the current area in the scrollable nav so "you are here" is never off-screen. */
function revealActiveNavItem() {
  const list = $('#area-nav .area-nav__list');
  const active = list?.querySelector('[aria-current="page"]');
  if (!active || list.scrollWidth <= list.clientWidth) return;
  const item = active.getBoundingClientRect();
  const box = list.getBoundingClientRect();
  scrollNavTo(list, list.scrollLeft + item.left + item.width / 2 - (box.left + box.width / 2));
}

/* ---------- One-time swipe hint ----------
 * Plays once per session, only while the nav overflows and the user has never
 * scrolled it. Any interaction cancels it; reduced motion skips it entirely. */
const NAV_HINT_KEY = 'navHintSeen';
const NAV_HINT_SESSION_KEY = 'rv:navHintPlayed';
let navHintTimer = 0;
let navHintFrame = 0;
/** Scroll events before this timestamp come from our own code, not the user. */
let navAutoScrollUntil = 0;

function scrollNavTo(list, left) {
  navAutoScrollUntil = performance.now() + 150;
  list.scrollLeft = left;
}

function initNavHint() {
  const nav = $('#area-nav');
  nav.addEventListener('scroll', () => {
    if (performance.now() < navAutoScrollUntil) return;
    persisted.set(NAV_HINT_KEY, true);
    cancelNavHint();
  }, { capture: true, passive: true });
  for (const type of ['pointerdown', 'wheel', 'focusin']) nav.addEventListener(type, cancelNavHint, { passive: true });

  if (persisted.get(NAV_HINT_KEY, false) || sessionStorage.getItem(NAV_HINT_SESSION_KEY)) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  navHintTimer = setTimeout(playNavHint, 1200);
}

function cancelNavHint() {
  clearTimeout(navHintTimer);
  cancelAnimationFrame(navHintFrame);
}

function playNavHint() {
  const list = $('#area-nav .area-nav__list');
  const room = list ? list.scrollWidth - list.clientWidth : 0;
  if (room <= 0 || document.hidden) return;
  sessionStorage.setItem(NAV_HINT_SESSION_KEY, '1');

  const start = list.scrollLeft;
  const direction = room - start > 0 ? 1 : -1;
  const distance = Math.min(48, direction > 0 ? room - start : start);
  const duration = 1100;
  const t0 = performance.now();

  const step = (now) => {
    const p = Math.min(1, (now - t0) / duration);
    const wave = Math.sin(Math.PI * p);
    scrollNavTo(list, start + direction * distance * wave * wave);
    if (p < 1) navHintFrame = requestAnimationFrame(step);
  };
  navHintFrame = requestAnimationFrame(step);
}

function refreshNotifications() {
  render($('[data-slot="bell"]'), bellButton());
  render($('[data-slot="notifications"]'), notificationsContent());
}

function onHeaderClick(event) {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const { action } = target.dataset;

  if (action === 'theme') {
    appStore.set({ theme: resolvedTheme() === 'dark' ? 'light' : 'dark' });
  } else if (action === 'lang') {
    $('#pop-user')?.hidePopover();
    setLang(target.dataset.lang);
  } else if (action === 'unavailable') {
    toast(t('header.unavailable'), { type: 'info' });
  } else if (action === 'read-all') {
    appStore.set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) }));
    $('#pop-notifications .notif')?.focus();
  } else if (action === 'open-notification') {
    const id = target.dataset.id;
    const notification = appStore.get().notifications.find((n) => n.id === id);
    appStore.set((s) => ({ notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) }));
    $('#pop-notifications')?.hidePopover();
    if (notification?.href) navigate(notification.href);
    else toast(t(`notifications.${notification.key}.title`), { type: 'info' });
  }
}

export function renderShell() {
  applyTheme();
  renderHeader();
  renderNav();
  document.querySelector('.skip-link').textContent = t('app.skip');
}

export function initShell() {
  $('#app-header').addEventListener('click', onHeaderClick);
  onNavigate(renderNav);
  appStore.subscribe((state, patch) => {
    if ('theme' in patch) {
      applyTheme();
      const focused = document.activeElement?.dataset.action === 'theme';
      render($('[data-slot="theme"]'), themeButton());
      if (focused) $('[data-action="theme"]').focus();
    }
    if ('notifications' in patch) refreshNotifications();
    if ('periodConfig' in patch) renderNav();
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (appStore.get().theme === 'system') render($('[data-slot="theme"]'), themeButton());
  });
  renderShell();
  initNavHint();
}
