import pl from './locales/pl.js';
import en from './locales/en.js';
import { persisted } from './store.js';

const DICTIONARIES = { pl, en };
const LOCALES = { pl: 'pl-PL', en: 'en-GB' };
export const LANGUAGES = Object.keys(DICTIONARIES);

let lang = LANGUAGES.includes(persisted.get('lang')) ? persisted.get('lang') : 'pl';
const listeners = new Set();
const pluralRules = new Map();

document.documentElement.lang = lang;

export const getLang = () => lang;
export const getLocale = () => LOCALES[lang];

export function setLang(next) {
  if (!LANGUAGES.includes(next) || next === lang) return;
  lang = next;
  persisted.set('lang', next);
  document.documentElement.lang = next;
  listeners.forEach((fn) => fn(next));
}

export function onLangChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const lookup = (dict, key) => key.split('.').reduce((node, part) => node?.[part], dict);

function plural(forms, count) {
  if (!pluralRules.has(lang)) pluralRules.set(lang, new Intl.PluralRules(getLocale()));
  return forms[pluralRules.get(lang).select(count)] ?? forms.other;
}

/**
 * Translate a dotted key. Supports `{param}` interpolation and plural objects
 * (`{ one, few, many, other }`) selected by `params.count`.
 */
export function t(key, params = {}) {
  let value = lookup(DICTIONARIES[lang], key) ?? lookup(DICTIONARIES.pl, key);
  if (value == null) return key;
  if (typeof value === 'object') value = plural(value, Number(params.count ?? 0));
  return String(value).replace(/\{(\w+)\}/g, (_, name) => params[name] ?? '');
}
