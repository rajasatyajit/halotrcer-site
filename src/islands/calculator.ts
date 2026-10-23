// AI bill leak calculator: computes from the form, shows the result, and keeps
// the inputs in the query string so a result can be shared as a link.
// The markup is Calculator.astro; without JavaScript the page shows the formula.
import {
  compute,
  encode,
  EXAMPLE,
  FIELDS,
  formatAmount,
  isExample,
  formatShare,
  parse,
  summary,
  type Inputs,
} from '../lib/calculator.ts';

// Kept in each island rather than shared (see copy.ts).
function announce(message: string): void {
  let region = document.querySelector<HTMLElement>('[data-copy-status]');
  if (!region) {
    region = document.createElement('p');
    region.className = 'visually-hidden';
    region.setAttribute('aria-live', 'polite');
    region.dataset.copyStatus = '';
    document.body.append(region);
  }
  region.textContent = '';
  requestAnimationFrame(() => {
    if (region) region.textContent = message;
  });
}

for (const root of document.querySelectorAll<HTMLElement>('[data-calculator]')) {
  const form = root.querySelector<HTMLFormElement>('form');
  const result = root.querySelector<HTMLElement>('[data-calc-result]');
  if (!form || !result) continue;
  const out = (name: string) => root.querySelector<HTMLElement>(`[data-calc-out="${name}"]`);
  const field = (f: string) => form.elements.namedItem(f) as HTMLInputElement | null;
  const exampleLabel = root.querySelector<HTMLElement>('[data-example-label]');
  let current: Inputs | undefined;
  // True while the result shows the example values (ex=1 in the link).
  let example = false;
  const setExample = (flag: boolean) => {
    example = flag;
    if (exampleLabel) exampleLabel.hidden = !flag;
  };

  const fill = (i: Inputs) => {
    for (const f of FIELDS) {
      const input = field(f);
      if (input) input.value = String(i[f]);
    }
  };

  const show = (i: Inputs) => {
    const r = compute(i);
    current = i;
    const set = (name: string, text: string) => {
      const el = out(name);
      if (el) el.textContent = text;
    };
    set('spend', formatAmount(r.spend));
    set('repeat', formatAmount(r.repeat));
    set('share', formatShare(r.share));
    result.dataset.state = 'done';
  };

  const submit = (fromExample = false) => {
    if (!form.reportValidity()) return;
    const inputs = parse(new URLSearchParams(FIELDS.map((f) => [f, field(f)?.value ?? ''])));
    if (!inputs) return;
    show(inputs);
    setExample(fromExample);
    history.replaceState(null, '', `?${encode(inputs, fromExample)}${location.hash}`);
  };

  // Editing any field makes the numbers the visitor's own: drop the example label and flag.
  form.addEventListener('input', () => {
    if (!example) return;
    setExample(false);
    const params = new URLSearchParams(location.search);
    params.delete('ex');
    const query = params.toString();
    history.replaceState(
      null,
      '',
      `${location.pathname}${query ? `?${query}` : ''}${location.hash}`,
    );
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    submit();
  });

  root.querySelector('[data-calc-example]')?.addEventListener('click', () => {
    fill(EXAMPLE);
    submit(true);
    announce('Example values filled in. They are not any provider’s real prices.');
  });

  root.querySelector('[data-calc-copy]')?.addEventListener('click', async () => {
    if (!current) {
      announce('Calculate a result first.');
      return;
    }
    try {
      await navigator.clipboard.writeText(
        summary(current, compute(current), location.href, example),
      );
      announce('Result and link copied to the clipboard');
    } catch {
      announce('Could not copy. Copy the link from the address bar.');
    }
  });

  const params = new URLSearchParams(location.search);
  const initial = parse(params);
  if (initial) {
    fill(initial);
    show(initial);
    setExample(isExample(params));
  }
}
