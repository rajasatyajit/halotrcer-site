// [data-share]: navigator.share() when available; otherwise copy the URL.
// Feedback goes to the page's aria-live region (created if absent).

// Kept in each island rather than shared: a shared module becomes a chunk
// the island must fetch before it runs, a chained request that delays LCP
// (scripts/check-budgets.ts fails on any import between built chunks).
// Announces through the page's aria-live region, creating one if absent.
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

document.addEventListener('click', async (e) => {
  const button = (e.target as Element | null)?.closest<HTMLButtonElement>('[data-share]');
  if (!button) return;
  const data = { title: document.title, url: location.href };
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share(data);
      return;
    } catch (err) {
      if ((err as DOMException).name === 'AbortError') return; // the visitor closed the sheet
    }
  }
  try {
    await navigator.clipboard.writeText(data.url);
    announce('Link copied to the clipboard');
  } catch {
    announce('Could not copy the link. Copy it from the address bar.');
  }
});

// A module, so its helpers stay local to this island.
export {};
