// Copy buttons: [data-copy="<element id>"] copies that element's text;
// [data-copy-link] copies this page's URL. Feedback goes to an aria-live region.
// Buttons are hidden by CSS until html.js is set, so they never shift layout.

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
  // A fresh text node makes screen readers announce repeated messages too.
  requestAnimationFrame(() => {
    if (region) region.textContent = message;
  });
}

function selectText(el: Element): void {
  const range = document.createRange();
  range.selectNodeContents(el);
  const sel = getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

async function copy(button: HTMLButtonElement, text: string, source?: Element): Promise<void> {
  const label = button.textContent;
  try {
    await navigator.clipboard.writeText(text);
    button.textContent = 'Copied';
    announce('Copied to the clipboard');
  } catch {
    if (source) selectText(source);
    announce('Copy failed. The text is selected: press Ctrl+C or Cmd+C.');
  }
  setTimeout(() => (button.textContent = label), 2000);
}

document.addEventListener('click', (e) => {
  const target = e.target as Element | null;
  const button = target?.closest<HTMLButtonElement>('[data-copy], [data-copy-link]');
  if (!button) return;
  if (button.dataset.copyLink !== undefined) {
    void copy(button, location.href);
    return;
  }
  const source = document.getElementById(button.dataset.copy ?? '');
  if (source) void copy(button, source.textContent ?? '', source);
});
