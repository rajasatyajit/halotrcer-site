// JSON-LD validation for every built page: it parses, uses schema.org, every
// node is an allowed @type with the properties search engines require, every
// bare {"@id"} reference resolves across the built hosts, Service prices match
// content/pricing.md, and there is no rating or review markup anywhere.
import { SCHEMAS } from './lib/jsonld-schemas.ts';
import { loadPricing } from '../src/lib/pricing.ts';
import { builtSites, pages, Report } from './lib/dist.ts';

const report = new Report();
const defined = new Set<string>();
const referenced: [string, string][] = [];
const prices = new Map(loadPricing().services.map((s) => [s.name, s.from]));

function walk(node: unknown, where: string): void {
  if (Array.isArray(node)) return node.forEach((n) => walk(n, where));
  if (!node || typeof node !== 'object') return;
  const obj = node as Record<string, unknown>;
  for (const key of ['aggregateRating', 'review', 'reviewRating']) {
    if (key in obj) report.error(`${where}: "${key}" is not allowed (no ratings or reviews)`);
  }
  const keys = Object.keys(obj);
  if (keys.length === 1 && typeof obj['@id'] === 'string') referenced.push([obj['@id'], where]);
  else if (typeof obj['@id'] === 'string') defined.add(obj['@id']);
  Object.values(obj).forEach((v) => walk(v, where));
}

let blocks = 0;
for (const site of builtSites()) {
  for (const page of pages(site)) {
    const where = `${site}/${page.rel}`;
    for (const s of page.root.querySelectorAll('script[type="application/ld+json"]')) {
      blocks++;
      let doc: { '@context'?: string; '@graph'?: Record<string, unknown>[] };
      try {
        doc = JSON.parse(s.textContent);
      } catch (e) {
        report.error(`${where}: JSON-LD does not parse (${(e as Error).message})`);
        continue;
      }
      if (doc['@context'] !== 'https://schema.org')
        report.error(`${where}: @context must be https://schema.org`);
      for (const node of doc['@graph'] ?? []) {
        const type = String(node['@type']);
        const schema = SCHEMAS[type];
        if (!schema) {
          report.error(`${where}: @type ${type} is not an allowed type`);
          continue;
        }
        const r = schema.safeParse(node);
        if (!r.success) {
          report.error(
            `${where}: ${type}: ${r.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`,
          );
        }
        if (type === 'Service') {
          const offers = node.offers as { priceSpecification?: { minPrice?: number } };
          const want = prices.get(String(node.name));
          if (want !== offers?.priceSpecification?.minPrice) {
            report.error(
              `${where}: ${node.name} minPrice ${offers?.priceSpecification?.minPrice} != content/pricing.md ${want}`,
            );
          }
        }
      }
      walk(doc, where);
    }
  }
}
// References resolve once www (which defines the Organization) is in the build.
if (builtSites().includes('www')) {
  for (const [id, where] of referenced)
    if (!defined.has(id)) report.error(`${where}: unresolved @id ${id}`);
}
report.finish(`JSON-LD (${blocks} blocks)`);
