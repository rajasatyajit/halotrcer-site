// Every table and section of a rendered sample ([data-sample]) carries its own
// "Simulated demo run" stamp, so a screenshot of any one part still says what it is.
import { builtSites, pages, Report } from './lib/dist.ts';
import { missingStamps } from './lib/stamps.ts';

const report = new Report();
for (const site of builtSites()) {
  for (const page of pages(site)) {
    for (const m of missingStamps(page.root)) report.error(`${site}/${page.rel}: no stamp on ${m}`);
  }
}
report.finish('stamps (every sample table and section is labelled)');
