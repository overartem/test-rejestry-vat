/**
 * Accounting areas and their readiness conditions. A condition is either static
 * (`met`) or derived from the accounting period configuration (`requires`).
 */

export const AREAS = [
  { id: 'vat', path: '/obszary/rejestry-vat', icon: 'receipt', items: ['vatRegister'] },
  { id: 'bookkeeping', path: '/obszary/ksiegowania', icon: 'book-open', items: ['kpir', 'revenue', 'fullBooks'] },
  { id: 'assets', path: '/obszary/majatek', icon: 'archive', items: ['assets'] },
  { id: 'controls', path: '/obszary/kontrole', icon: 'list-checks', items: ['controls'] },
];

const ORG = { id: 'org', met: true };
const PERIOD = { id: 'period', requires: 'period' };

export const ITEMS = {
  vatRegister: {
    icon: 'receipt',
    conditions: [ORG, { id: 'demoData', met: true }, { id: 'vatContext', met: false, kind: 'confirm' }, { ...PERIOD, kind: 'confirm' }],
  },
  kpir: { icon: 'landmark', form: 'kpir', conditions: [ORG, { id: 'formKpir', requires: 'form:kpir' }, PERIOD] },
  revenue: { icon: 'banknote', form: 'lump', conditions: [ORG, { id: 'formLump', requires: 'form:lump' }, PERIOD] },
  fullBooks: { icon: 'file-text', form: 'full', conditions: [ORG, { id: 'formFull', requires: 'form:full' }, PERIOD] },
  assets: { icon: 'archive', conditions: [ORG, PERIOD, { id: 'assetsList', met: false }] },
  controls: { icon: 'list-checks', conditions: [ORG, { id: 'rules', met: true }, PERIOD] },
};

export const DEFAULT_PERIOD_CONFIG = {
  configured: false,
  year: 2026,
  start: '2026-01-01',
  end: '2026-12-31',
  form: '',
  vatPayer: true,
  vatPeriod: 'monthly',
};

function isMet(condition, period) {
  if (condition.requires === 'period') return period.configured;
  if (condition.requires?.startsWith('form:')) return period.configured && period.form === condition.requires.slice(5);
  return condition.met;
}

/** @returns {{ status: 'ready'|'confirm'|'config'|'na', conditions: Array<{id:string, met:boolean}>, metCount: number }} */
export function evaluateItem(itemId, period) {
  const item = ITEMS[itemId];
  const conditions = item.conditions.map((c) => ({ id: c.id, kind: c.kind ?? 'config', met: isMet(c, period) }));
  const metCount = conditions.filter((c) => c.met).length;
  const unmet = conditions.filter((c) => !c.met);

  let status = 'ready';
  if (item.form && period.configured && period.form && period.form !== item.form) status = 'na';
  else if (unmet.some((c) => c.kind === 'config')) status = 'config';
  else if (unmet.length) status = 'confirm';

  return { status, conditions, metCount };
}

const SEVERITY = { config: 3, confirm: 2, ready: 1, na: 0 };

export function evaluateArea(area, period) {
  const items = area.items.map((id) => ({ id, ...evaluateItem(id, period) }));
  const applicable = items.filter((i) => i.status !== 'na');
  const status = applicable.length
    ? applicable.reduce((worst, i) => (SEVERITY[i.status] > SEVERITY[worst] ? i.status : worst), 'ready')
    : 'na';
  return { status, items };
}

export const STATUS_BADGE = { ready: 'success', confirm: 'warning', config: 'warning', na: 'outline' };
export const STATUS_ICON = { ready: 'check-circle', confirm: 'alert', config: 'settings', na: 'circle-dashed' };
