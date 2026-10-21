// schema.org node shapes check-jsonld.ts accepts: the allowed @types and the
// properties search engines require for each.
import { z } from 'zod';

const absUrl = z.string().regex(/^https:\/\/[a-z.]+\.halotrcer\.com\//);
const ref = z.object({ '@id': absUrl }).strict();

export const SCHEMAS: Record<string, z.ZodType> = {
  Organization: z.object({
    '@id': absUrl,
    name: z.string(),
    url: absUrl,
    logo: absUrl,
    email: z.email(),
  }),
  WebSite: z.object({ '@id': absUrl, name: z.string(), url: absUrl, publisher: ref }),
  SoftwareApplication: z.object({
    '@id': absUrl,
    name: z.string().min(1),
    description: z.string().min(20),
    applicationCategory: z.string(),
    operatingSystem: z.string(),
    url: absUrl,
    publisher: ref,
    offers: z.object({
      '@type': z.literal('Offer'),
      price: z.string(),
      priceCurrency: z.string().length(3),
    }),
  }),
  Service: z.object({
    '@id': absUrl,
    name: z.string(),
    provider: ref,
    offers: z.object({
      '@type': z.literal('Offer'),
      priceSpecification: z.object({
        '@type': z.literal('PriceSpecification'),
        minPrice: z.number().positive(),
        priceCurrency: z.string().length(3),
      }),
    }),
  }),
  BreadcrumbList: z.object({
    itemListElement: z
      .array(
        z.object({
          '@type': z.literal('ListItem'),
          position: z.number().int(),
          name: z.string().min(1),
          item: absUrl,
        }),
      )
      .min(2)
      .refine((items) => items.every((it, i) => it.position === i + 1), 'positions must run 1..n'),
  }),
  FAQPage: z.object({
    mainEntity: z
      .array(
        z.object({
          '@type': z.literal('Question'),
          name: z.string().min(5),
          acceptedAnswer: z.object({ '@type': z.literal('Answer'), text: z.string().min(10) }),
        }),
      )
      .min(1),
  }),
  Article: z.object({
    headline: z.string().max(110),
    datePublished: z.string(),
    author: z.unknown(),
  }),
  BlogPosting: z.object({
    '@id': absUrl,
    headline: z.string().max(110),
    description: z.string().min(20),
    datePublished: z.iso.date(),
    author: ref,
    publisher: ref,
    url: absUrl,
  }),
};
