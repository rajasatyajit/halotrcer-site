// Frontmatter every content/proof/*.md must carry (PLAN.md §9.4): who said it,
// where it came from, and the permission to publish it. Nothing is shown
// without all three.
import { z } from 'astro/zod';

export const proofSchema = z.object({
  // How the person is named on the page, as they agreed (e.g. "Jane Doe, CTO").
  attribution: z.string().min(3),
  organization: z.string().min(1).optional(),
  // Where the words come from: an email, a call note or a public URL, with a date.
  source: z.string().min(10),
  // The permission to publish, and when it was given.
  permission: z.string().min(10),
  date: z.coerce.date(),
  // Hosts that show it; all three when omitted.
  hosts: z
    .array(z.enum(['www', 'tokvera', 'sievant']))
    .min(1)
    .optional(),
});

export type ProofData = z.infer<typeof proofSchema>;
