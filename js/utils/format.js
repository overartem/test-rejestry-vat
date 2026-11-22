import { getLocale } from '../i18n.js';

const cache = new Map();
const formatter = (kind, factory) => {
  const key = `${kind}|${getLocale()}`;
  if (!cache.has(key)) cache.set(key, factory(getLocale()));
  return cache.get(key);
};

/** Amounts are stored as integer grosze to avoid floating point drift. */
export const money = (grosze) =>
  formatter('money', (l) => new Intl.NumberFormat(l, { style: 'currency', currency: 'PLN' })).format(grosze / 100);

export const moneyPlain = (grosze) =>
  formatter('plain', (l) => new Intl.NumberFormat(l, { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })).format(grosze / 100);

export const number = (value) => formatter('num', (l) => new Intl.NumberFormat(l)).format(value);

export const percent = (value) =>
  formatter('pct', (l) => new Intl.NumberFormat(l, { style: 'percent', maximumFractionDigits: 0 })).format(value);

const toDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const date = (iso) =>
  formatter('date', (l) => new Intl.DateTimeFormat(l, { day: '2-digit', month: '2-digit', year: 'numeric' })).format(toDate(iso));

export const dateTime = (value) =>
  formatter('dt', (l) => new Intl.DateTimeFormat(l, { dateStyle: 'medium', timeStyle: 'short' })).format(value);

const capitalize = (s) => s.charAt(0).toLocaleUpperCase(getLocale()) + s.slice(1);

export const monthName = (month, style = 'long') =>
  capitalize(formatter(`month-${style}`, (l) => new Intl.DateTimeFormat(l, { month: style })).format(new Date(2026, month - 1, 1)));

export const monthYear = (year, month) => `${monthName(month)} ${year}`;

export const relativeTime = (minutesAgo) =>
  formatter('rel', (l) => new Intl.RelativeTimeFormat(l, { numeric: 'auto' })).format(
    ...(minutesAgo < 60 ? [-minutesAgo, 'minute'] : minutesAgo < 1440 ? [-Math.round(minutesAgo / 60), 'hour'] : [-Math.round(minutesAgo / 1440), 'day']),
  );

export const initials = (name) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('');
