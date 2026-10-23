// Theme toggle. The button's space is reserved (visibility: hidden) until this runs,
// and its visible text never changes, so revealing it causes no layout shift.
// Without JS it stays invisible and prefers-color-scheme applies.
type Theme = 'light' | 'dark';

function current(): Theme {
  const explicit = document.documentElement.dataset.theme;
  if (explicit === 'light' || explicit === 'dark') return explicit;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function label(button: HTMLButtonElement, theme: Theme): void {
  const next = theme === 'dark' ? 'light' : 'dark';
  // The accessible name starts with the visible text "Theme" (WCAG 2.5.3).
  button.setAttribute('aria-label', `Theme: switch to ${next}`);
}

// The header and the phone menu each have a copy; every switch relabels both.
const buttons = [...document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]')];

for (const button of buttons) {
  label(button, current());
  delete button.dataset.pending;
  button.addEventListener('click', () => {
    const next: Theme = current() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('theme', next);
    } catch {
      // Storage blocked: the choice lasts for this page only.
    }
    for (const b of buttons) label(b, next);
  });
}
