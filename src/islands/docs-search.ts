// Docs search with Pagefind's own index (built after the site, in /pagefind/).
// The index loads on first input. Results are built with DOM APIs; Pagefind's
// excerpt markup is reduced to text and <mark>, never inserted as HTML.

interface PagefindResult {
  data(): Promise<{ url: string; meta: { title?: string }; excerpt: string }>;
}
interface Pagefind {
  search(q: string): Promise<{ results: PagefindResult[] }>;
}

let pagefind: Promise<Pagefind> | undefined;
const load = () =>
  (pagefind ??= import(/* @vite-ignore */ '/pagefind/pagefind.js' as string) as Promise<Pagefind>);

function excerpt(html: string): DocumentFragment {
  const frag = document.createDocumentFragment();
  for (const part of html.split(/(<mark>[^<]*<\/mark>)/)) {
    const m = /^<mark>([^<]*)<\/mark>$/.exec(part);
    const text = (m ? m[1] : part)?.replace(/<[^>]*>/g, '') ?? '';
    if (m) {
      const mark = document.createElement('mark');
      mark.textContent = text;
      frag.append(mark);
    } else frag.append(text);
  }
  return frag;
}

for (const form of document.querySelectorAll<HTMLElement>('[data-docs-search]')) {
  const input = form.querySelector<HTMLInputElement>('input');
  const list = form.querySelector<HTMLElement>('[data-docs-search-results]');
  const status = form.querySelector<HTMLElement>('[data-docs-search-status]');
  if (!input || !list || !status) continue;
  let seq = 0;
  input.addEventListener('input', async () => {
    const q = input.value.trim();
    const mine = ++seq;
    if (!q) {
      list.replaceChildren();
      status.textContent = '';
      return;
    }
    const { results } = await (await load()).search(q);
    const data = await Promise.all(results.slice(0, 8).map((r) => r.data()));
    if (mine !== seq) return;
    list.replaceChildren(
      ...data.map((d) => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = d.url.replace(/\.html$/, '');
        a.textContent = d.meta.title ?? d.url;
        const p = document.createElement('p');
        p.append(excerpt(d.excerpt));
        li.append(a, p);
        return li;
      }),
    );
    status.textContent = data.length ? `${data.length} results` : 'No results';
  });
}
