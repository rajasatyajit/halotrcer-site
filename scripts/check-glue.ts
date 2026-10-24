// No word renders glued to the one beside it ("measurewhether", "Sievantwill"): Astro can drop
// the line break before a component or expression that starts a line. See scripts/lib/glue.ts.
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { builtSites, pages, Report, walk } from './lib/dist.ts';
import { gluedExpressions, gluedWords } from './lib/glue.ts';

const report = new Report();
for (const site of builtSites()) {
  for (const page of pages(site)) {
    for (const g of gluedWords(page.root)) report.error(`${site}/${page.rel}: glued words ${g}`);
  }
}
const src = join(process.cwd(), 'src');
for (const file of walk(src).filter((f) => f.endsWith('.astro'))) {
  for (const g of gluedExpressions(readFileSync(file, 'utf8')))
    report.error(`${relative(process.cwd(), file)}:${g.line}: needs {' '}: ${g.text}`);
}
report.finish('glue (no word is glued to the one beside it)');
