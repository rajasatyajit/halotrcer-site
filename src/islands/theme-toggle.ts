// Theme toggle. Without JS the button stays hidden and prefers-color-scheme applies.
type Theme = 'light' | 'dark';

function current(): Theme {
  const explicit = document.documentElement.dataset.theme;
  if (explicit === 'light' || explicit === 'dark') return explicit;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function label(button: HTMLButtonElement, theme: Theme): void {
  const next = theme === 'dark' ? 'light' : 'dark';
  button.textContent = next === 'dark' ? 'Dark' : 'Light';
  button.setAttribute('aria-label', `Switch to ${next} theme`);
}

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]')) {
  label(button, current());
  button.hidden = false;
  button.addEventListener('click', () => {
    const next: Theme = current() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('theme', next);
    } catch {
      // Storage blocked: the choice lasts for this page only.
    }
    label(button, next);
  });
}
