// llms.txt per host (https://llmstxt.org): a Markdown index of the host's
// pages and docs, written from sourced claims and what this build contains.
import type { APIRoute } from 'astro';
import { getFlags } from '../config/flags.ts';
import { url } from '../config/site.ts';
import { claim } from './claims.ts';
import { plainTitle, productDocs } from './docs.ts';

const link = (title: string, href: string, note?: string) =>
  `- [${title}](${href})${note ? `: ${note}` : ''}`;

async function body(): Promise<string> {
  const { site, launched } = getFlags();
  if (site === 'www') {
    return [
      '# Halotrcer',
      '',
      `> ${claim('halotrcer.tagline').text}`,
      '',
      claim('hero.www.b-lede').text,
      '',
      '## Pages',
      '',
      link('AI Cost & Security Audit', url('www', '/audit'), 'what the combined audit delivers'),
      link('Pricing', url('www', '/pricing'), 'fixed-scope engagements and starting prices'),
      link(
        'How findings are ranked',
        url('www', '/scoring'),
        'provisional ranking across both tools',
      ),
      link(
        'Install',
        url('www', '/install'),
        launched ? 'every install channel' : 'available at release',
      ),
      link(
        'Security',
        url('www', '/security'),
        'vulnerability reporting and what a release proves',
      ),
      '',
      '## Products',
      '',
      link('Tokvera', url('tokvera', '/llms.txt'), claim('tokvera.headline').text),
      link('Sievant', url('sievant', '/llms.txt'), claim('sievant.headline').text),
      '',
    ].join('\n');
  }
  const product = site;
  const { built } = await productDocs(product);
  const pages =
    product === 'tokvera'
      ? [
          link('How Tokvera grades an endpoint', url(site, '/scoring')),
          link('Sample report', url(site, '/sample-report'), 'a simulated demo run'),
          link('Integrations', url(site, '/integrations')),
          link('FAQ', url(site, '/faq')),
        ]
      : [
          link(
            'OWASP LLM Top 10 mapping',
            url(site, '/owasp-llm-top-10'),
            'a mapping, not a certification',
          ),
          link('How Sievant rates findings', url(site, '/scoring')),
          link('Sample reports', url(site, '/sample-report'), 'simulated demo runs'),
          link('Integrations', url(site, '/integrations')),
          link('FAQ', url(site, '/faq')),
        ];
  return [
    `# ${product === 'tokvera' ? 'Tokvera' : 'Sievant'}`,
    '',
    `> ${claim(`${product}.headline`).text}`,
    '',
    claim(`${product}.summary`).text,
    '',
    '## Pages',
    '',
    ...pages,
    '',
    '## Docs',
    '',
    ...built.map(({ doc, href }) => link(plainTitle(doc), url(site, href))),
    '',
    '## Related',
    '',
    link('Halotrcer', url('www', '/llms.txt'), 'runs Tokvera and Sievant as one check'),
    '',
  ].join('\n');
}

export const llms: APIRoute = async () =>
  new Response(await body(), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
