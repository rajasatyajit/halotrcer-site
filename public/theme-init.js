// Runs before first paint. External (not inline) for CSP.
// 1. Marks JavaScript as available, so enhanced layouts (the install picker's
//    tabs, copy buttons) are drawn from the first frame instead of shifting later.
// 2. Applies a stored theme choice.
document.documentElement.classList.add('js');
try {
  var t = localStorage.getItem('theme');
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
} catch (e) {
  // Storage blocked: fall back to prefers-color-scheme.
}
