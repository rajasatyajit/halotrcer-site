// AI bill leak calculator: pure functions shared by the island and the tests.
// Everything is computed from the reader's own inputs; nothing here is a
// measurement, a real provider's price or a savings figure (PLAN.md §6, Q10).

export interface Inputs {
  /** Requests per month. */
  r: number;
  /** Average input tokens per request. */
  tin: number;
  /** Average output tokens per request. */
  tout: number;
  /** Price per 1M input tokens. */
  pin: number;
  /** Price per 1M output tokens. */
  pout: number;
  /** Share of input tokens repeated across requests and not cached, in percent. */
  h: number;
}

export type Field = keyof Inputs;

export const FIELDS: readonly Field[] = ['r', 'tin', 'tout', 'pin', 'pout', 'h'];

// Visibly labelled as an example on the page; not any provider's price.
export const EXAMPLE: Inputs = { r: 200000, tin: 2000, tout: 400, pin: 3, pout: 15, h: 40 };

export interface Result {
  /** Estimated monthly spend: R × (Tin × Pin + Tout × Pout) / 1,000,000. */
  spend: number;
  /** Estimated monthly spend on repeated, uncached input: R × Tin × h × Pin / 1,000,000. */
  repeat: number;
  /** repeat / spend, in percent (0 when spend is 0). */
  share: number;
}

export function compute(i: Inputs): Result {
  const spend = (i.r * (i.tin * i.pin + i.tout * i.pout)) / 1_000_000;
  const repeat = (i.r * i.tin * (i.h / 100) * i.pin) / 1_000_000;
  return { spend, repeat, share: spend > 0 ? (repeat / spend) * 100 : 0 };
}

// Reads inputs from a query string; returns undefined unless every field is a
// finite, non-negative number (and h is at most 100).
export function parse(params: URLSearchParams): Inputs | undefined {
  const out: Partial<Inputs> = {};
  for (const f of FIELDS) {
    const raw = params.get(f);
    if (raw === null || raw.trim() === '') return undefined;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0 || (f === 'h' && n > 100)) return undefined;
    out[f] = n;
  }
  return out as Inputs;
}

export function encode(i: Inputs): string {
  return new URLSearchParams(FIELDS.map((f) => [f, String(i[f])])).toString();
}

const money = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const pct = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

export const formatAmount = (n: number) => money.format(n);
export const formatShare = (n: number) => `${pct.format(n)}%`;

// The plain-text summary that "Copy result" puts on the clipboard.
export function summary(i: Inputs, r: Result, link: string): string {
  return [
    `Estimated monthly spend: ${formatAmount(r.spend)}`,
    `Estimated spend on repeated, uncached input: ${formatAmount(r.repeat)} (${formatShare(r.share)} of the total)`,
    `An estimate computed only from these inputs (${i.r} requests a month), not a measurement.`,
    link,
  ].join('\n');
}
