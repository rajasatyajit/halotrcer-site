// Structured data (schema.org JSON-LD). Organization and WebSite are described
// once, on www, with stable @ids that every host references. Values come from
// sourced claims, content/pricing.md and release data; nothing is invented
// (no ratings, no review counts). Validated by scripts/check-jsonld.ts.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getFlags } from '../config/flags.ts';
import { CONTACT_EMAIL, SITE_NAMES, url, type SiteId } from '../config/site.ts';
import { claim } from './claims.ts';
import { loadPricing, type Service } from './pricing.ts';
import { loadRelease, type ProductId } from './releases.ts';

export type JsonLd = Record<string, unknown>;

export const ORG_ID = url('www', '/#org');
export const WEBSITE_ID = url('www', '/#website');

export function organization(): JsonLd {
  return {
    '@type': 'Organization',
    '@id': ORG_ID,
    name: 'Halotrcer',
    url: url('www'),
    logo: url('www', '/logo.png'),
    email: CONTACT_EMAIL,
    ...(getFlags().launched ? { sameAs: ['https://github.com/rajasatyajit'] } : {}),
  };
}

export function website(): JsonLd {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name: 'Halotrcer',
    url: url('www'),
    publisher: { '@id': ORG_ID },
  };
}

const PRODUCT_HOST: Record<ProductId, SiteId> = {
  tokvera: 'tokvera',
  sievant: 'sievant',
  halotrcer: 'www',
};
const PRODUCT_DESCRIPTION: Record<ProductId, string> = {
  tokvera: 'tokvera.summary',
  sievant: 'sievant.headline',
  halotrcer: 'halotrcer.tagline',
};

export function softwareApplication(product: ProductId): JsonLd {
  const host = PRODUCT_HOST[product];
  const release = getFlags().launched ? loadRelease(product)?.release : undefined;
  return {
    '@type': 'SoftwareApplication',
    '@id': url(host, '/#software'),
    name: product === 'halotrcer' ? 'Halotrcer' : SITE_NAMES[host],
    description: claim(PRODUCT_DESCRIPTION[product]).text,
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Linux, macOS, Windows',
    url: url(host),
    license: 'https://www.apache.org/licenses/LICENSE-2.0',
    isAccessibleForFree: true,
    publisher: { '@id': ORG_ID },
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    ...(release
      ? { softwareVersion: release.version, downloadUrl: url('www', `/install#${product}`) }
      : {}),
  };
}

export function service(s: Service): JsonLd {
  return {
    '@type': 'Service',
    '@id': url('www', `/pricing#service-${s.id}`),
    name: s.name,
    description: s.summary,
    provider: { '@id': ORG_ID },
    url: url('www', '/pricing'),
    offers: {
      '@type': 'Offer',
      url: url('www', '/pricing'),
      priceSpecification: {
        '@type': 'PriceSpecification',
        minPrice: s.from,
        priceCurrency: loadPricing().currency,
      },
    },
  };
}

export interface Post {
  slug: string;
  title: string;
  description: string;
  published: Date;
  updated?: Date | undefined;
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

// A published blog post (drafts carry no structured data: they are noindex).
export function blogPosting(p: Post): JsonLd {
  const href = url('www', `/blog/${p.slug}`);
  return {
    '@type': 'BlogPosting',
    '@id': `${href}#post`,
    headline: p.title,
    description: p.description,
    datePublished: isoDate(p.published),
    ...(p.updated ? { dateModified: isoDate(p.updated) } : {}),
    author: { '@id': ORG_ID },
    publisher: { '@id': ORG_ID },
    url: href,
    mainEntityOfPage: href,
    isPartOf: { '@id': WEBSITE_ID },
  };
}

export interface Crumb {
  name: string;
  path: string;
}

export function breadcrumbs(site: SiteId, crumbs: Crumb[]): JsonLd {
  const all = [{ name: SITE_NAMES[site], path: '/' }, ...crumbs];
  return {
    '@type': 'BreadcrumbList',
    itemListElement: all.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: url(site, c.path),
    })),
  };
}

// Questions and answers from a synced FAQ doc (## question, then its answer).
export function faqEntries(docId: string): { question: string; answer: string }[] {
  const md = readFileSync(join(process.cwd(), 'content', 'docs', `${docId}.md`), 'utf8').replace(
    /^---\n[\s\S]*?\n---\n/,
    '',
  );
  return md
    .split(/^## /m)
    .slice(1)
    .map((block) => {
      const [q = '', ...rest] = block.split('\n');
      const answer = rest
        .join('\n')
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
        .replace(/[`*_>]/g, '')
        .replace(/^\s*[-|].*$/gm, (l) => l.replace(/\|/g, ' '))
        .replace(/\s+/g, ' ')
        .trim();
      return { question: q.replace(/`/g, '').trim(), answer };
    })
    .filter((e) => e.question && e.answer);
}

export function faqPage(docId: string): JsonLd {
  return {
    '@type': 'FAQPage',
    mainEntity: faqEntries(docId).map((e) => ({
      '@type': 'Question',
      name: e.question,
      acceptedAnswer: { '@type': 'Answer', text: e.answer },
    })),
  };
}

// One <script type="application/ld+json"> payload; "<" is escaped so the
// data block can never close its own script element.
export function serialize(items: JsonLd[]): string {
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': items }).replace(
    /</g,
    '\\u003c',
  );
}
