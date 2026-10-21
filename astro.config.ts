import { defineConfig } from 'astro/config';
import { getFlags } from './src/config/flags.ts';
import { origin } from './src/config/site.ts';
import { sitesIntegration } from './integrations/sites.ts';
import { satteri } from '@astrojs/markdown-satteri';
import { docLinksPlugin } from './src/lib/doc-links.ts';

const flags = getFlags();

export default defineConfig({
  site: origin(flags.site),
  outDir: `./dist/${flags.site}`,
  output: 'static',
  // Clean URLs: /audit is served from audit.html (Cloudflare Pages strips .html).
  trailingSlash: 'never',
  build: {
    format: 'file',
    // CSP has no 'unsafe-inline': every stylesheet and script must be an external file.
    inlineStylesheets: 'never',
  },
  vite: {
    build: { assetsInlineLimit: 0 },
  },
  markdown: {
    // Prism emits classes only; Shiki's inline styles would break the CSP.
    syntaxHighlight: 'prism',
    processor: satteri({ hastPlugins: [docLinksPlugin({ launched: flags.launched })] }),
  },
  devToolbar: { enabled: false },
  integrations: [sitesIntegration(flags)],
});
