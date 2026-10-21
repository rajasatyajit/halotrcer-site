// Announces a short message through the page's aria-live region, creating one
// if the page has none.
export function announce(message: string): void {
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
