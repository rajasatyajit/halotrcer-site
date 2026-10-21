// [data-share]: navigator.share() when available; otherwise copy the URL.
// Feedback goes to the page's aria-live region (created by copy.ts if absent).
import { announce } from './announce.ts';

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
