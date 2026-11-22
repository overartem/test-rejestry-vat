/**
 * Deterministic demo data. The same seed always produces the same documents,
 * so links with filters stay shareable and screenshots stay reproducible.
 */

export const COMPANY = { name: 'TestCompany Preview Sp. z o.o.', nip: '5263412876' };
export const USER = { name: 'Preview Reviewer' };

export const FIRST_PERIOD = { year: 2025, month: 1 };
export const LAST_PERIOD = { year: 2026, month: 11 };
export const DEFAULT_PERIOD = { year: 2026, month: 10 };
export const YEARS = [2025, 2026];
/** "Today" for the demo — documents after this date do not exist yet. */
const TODAY = { year: 2026, month: 11, day: 17 };

export const REGISTERS = ['sales', 'purchase'];
export const OPERATIONS = {
  sales: ['domestic', 'correction', 'wdt', 'export', 'servicesEu'],
  purchase: ['domestic', 'fixedAssets', 'wnt', 'importServices', 'correction'],
};
export const JPK_CODES = {
  sales: ['GTU_01', 'GTU_06', 'GTU_12', 'TP', 'MPP', 'FP', 'WEW'],
  purchase: ['MPP', 'IMP', 'MK', 'VAT_RR'],
};
export const SERIES = {
  sales: ['FV', 'KOR', 'FVE'],
  purchase: ['FZ', 'KZ'],
};
export const RATES = ['23', '8', '5', '0', 'zw', 'np'];
export const KSEF_STATUSES = ['confirmed', 'pending', 'missing'];

/** Documents per register/month that mirror the reference screenshots. */
const FIXED_COUNTS = { 'sales-2026-10': 14, 'purchase-2026-10': 9 };

function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pad = (n, len = 2) => String(n).padStart(len, '0');
const pick = (rnd, list) => list[Math.floor(rnd() * list.length)];
const weighted = (rnd, entries) => {
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = rnd() * total;
  for (const [value, weight] of entries) if ((roll -= weight) < 0) return value;
  return entries.at(-1)[0];
};

const NIP_WEIGHTS = [6, 5, 7, 2, 3, 4, 5, 6, 7];
function makeNip(rnd) {
  for (;;) {
    const digits = Array.from({ length: 9 }, (_, i) => (i === 0 ? 1 + Math.floor(rnd() * 9) : Math.floor(rnd() * 10)));
    const check = digits.reduce((sum, d, i) => sum + d * NIP_WEIGHTS[i], 0) % 11;
    if (check < 10) return digits.join('') + check;
  }
}

const hex = (rnd, len) => Array.from({ length: len }, () => Math.floor(rnd() * 16).toString(16)).join('').toUpperCase();

function makeContractors(prefix, seed, count) {
  const rnd = mulberry32(seed);
  return Array.from({ length: count }, (_, i) => ({ name: `${prefix} ${pad(i + 1)}`, nip: makeNip(rnd) }));
}

const CONTRACTORS = {
  sales: makeContractors('Demo Alfa', 101, 18),
  purchase: makeContractors('Demo Beta', 202, 12),
};

const daysInMonth = (year, month) => new Date(year, month, 0).getDate();

export function isPeriodInRange(year, month) {
  const value = year * 12 + month;
  return value >= FIRST_PERIOD.year * 12 + FIRST_PERIOD.month && value <= LAST_PERIOD.year * 12 + LAST_PERIOD.month;
}

function rateFor(rnd, register, operation) {
  if (operation === 'wdt' || operation === 'export') return '0';
  if (operation === 'servicesEu') return 'np';
  if (operation === 'importServices' || operation === 'wnt') return '23';
  return weighted(rnd, register === 'sales'
    ? [['23', 70], ['8', 12], ['5', 6], ['zw', 6], ['np', 6]]
    : [['23', 80], ['8', 12], ['5', 4], ['zw', 4]]);
}

function ksefStatus(rnd, year, month) {
  const recent = year === TODAY.year && month >= TODAY.month - 1;
  return recent
    ? weighted(rnd, [['missing', 78], ['pending', 22]])
    : weighted(rnd, [['confirmed', 72], ['pending', 8], ['missing', 20]]);
}

function makeDocument(register, year, month, index, count, rnd) {
  const n = index + 1;
  const lastDay = year === TODAY.year && month === TODAY.month ? TODAY.day : daysInMonth(year, month);
  const day = Math.min(lastDay, 1 + Math.floor((index * lastDay) / count));
  const isoDate = `${year}-${pad(month)}-${pad(day)}`;
  const fixed = FIXED_COUNTS[`${register}-${year}-${month}`] != null;

  let operation = weighted(rnd, register === 'sales'
    ? [['domestic', 72], ['correction', 10], ['wdt', 7], ['export', 5], ['servicesEu', 6]]
    : [['domestic', 70], ['fixedAssets', 8], ['wnt', 8], ['importServices', 7], ['correction', 7]]);
  if (fixed && register === 'sales') operation = index === 2 ? 'correction' : operation === 'correction' ? 'domestic' : operation;

  const isCorrection = operation === 'correction';
  const series = register === 'sales'
    ? isCorrection ? 'KOR' : operation === 'wdt' || operation === 'export' ? 'FVE' : 'FV'
    : isCorrection ? 'KZ' : 'FZ';

  const contractors = CONTRACTORS[register];
  const contractor = fixed ? contractors[index % contractors.length] : pick(rnd, contractors);

  const lineCount = rnd() < 0.25 && !isCorrection ? 2 : 1;
  const lines = Array.from({ length: lineCount }, (_, li) => {
    const rate = li === 0 ? rateFor(rnd, register, operation) : weighted(rnd, [['23', 60], ['8', 40]]);
    let net = Math.round((150 + rnd() * 5200) / 10) * 10 * 100;
    if (isCorrection) net = -Math.round(net * (0.1 + rnd() * 0.4) / 100) * 100;
    const vat = /^\d+$/.test(rate) ? Math.round((net * Number(rate)) / 100) : 0;
    return { rate, net, vat };
  });

  const net = lines.reduce((sum, l) => sum + l.net, 0);
  const vat = lines.reduce((sum, l) => sum + l.vat, 0);
  const gross = net + vat;

  const jpk = new Set();
  if (rnd() < 0.35) jpk.add(pick(rnd, JPK_CODES[register].filter((c) => c !== 'MPP')));
  if (gross >= 1_500_000 || (rnd() < 0.08)) jpk.add('MPP');

  const status = ksefStatus(rnd, year, month);
  const sellerNip = register === 'sales' ? COMPANY.nip : contractor.nip;
  const ksefNumber = status === 'confirmed' ? `${sellerNip}-${year}${pad(month)}${pad(day)}-${hex(rnd, 12)}-${hex(rnd, 2)}` : null;

  return {
    id: `${register === 'sales' ? 's' : 'p'}-${year}${pad(month)}-${n}`,
    register,
    contractor,
    date: isoDate,
    number: `${series}/${n}/${pad(month)}/${year}/DEMO`,
    series,
    operation,
    jpk: [...jpk],
    ksef: { status, number: ksefNumber },
    identifier: `DEMO-${register === 'sales' ? 'S' : 'Z'}-${n}`,
    lines,
    net,
    vat,
    gross,
  };
}

const cache = new Map();

export function getDocuments(register, year, month) {
  if (!isPeriodInRange(year, month)) return [];
  const key = `${register}-${year}-${month}`;
  if (!cache.has(key)) {
    const rnd = mulberry32(year * 100 + month + (register === 'sales' ? 0 : 7919));
    const inProgress = year === TODAY.year && month === TODAY.month;
    const count = FIXED_COUNTS[key] ?? (register === 'sales'
      ? (inProgress ? 6 : 8 + Math.floor(rnd() * 11))
      : (inProgress ? 4 : 5 + Math.floor(rnd() * 8)));
    cache.set(key, Array.from({ length: count }, (_, i) => makeDocument(register, year, month, i, count, rnd)));
  }
  return structuredClone(cache.get(key));
}

/** Seed labels shown on first visit so the feature is discoverable. */
export const DEFAULT_LABELS = [
  { id: 'review', name: { pl: 'Do wyjaśnienia', en: 'To clarify' }, color: 'amber' },
  { id: 'verified', name: { pl: 'Zweryfikowane', en: 'Verified' }, color: 'teal' },
  { id: 'urgent', name: { pl: 'Pilne', en: 'Urgent' }, color: 'red' },
];

export const DEFAULT_DOC_LABELS = {
  's-202610-3': ['review'],
  's-202610-1': ['verified'],
  's-202610-2': ['verified'],
  's-202610-7': ['urgent'],
  'p-202610-2': ['review'],
};

export const NOTIFICATIONS = [
  { id: 'n1', key: 'vatContext', minutesAgo: 25, href: '/obszary/rejestry-vat', read: false },
  { id: 'n2', key: 'ksefMissing', minutesAgo: 140, href: '/obszary/rejestry-vat?r=sales&y=2026&m=10', read: false },
  { id: 'n3', key: 'periodConfig', minutesAgo: 60 * 26, href: '/obszary', read: false },
  { id: 'n4', key: 'jpkSchema', minutesAgo: 60 * 24 * 4, href: null, read: false },
];
