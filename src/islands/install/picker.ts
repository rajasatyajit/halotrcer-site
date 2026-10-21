// Install picker behaviour. The markup (tabs included) is server-rendered by
// InstallPicker.astro; this wires up selection. Precedence: URL hash, then
// localStorage, then platform detection. Only explicit choices are saved.
import {
  defaultChannel,
  detect,
  fromUserAgent,
  osFromUAData,
  parseHash,
  type Platform,
} from './detect.ts';

const STORAGE_KEY = 'halotrcer-install';

function load(): string | undefined {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

function save(value: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Storage blocked: the hash still carries the choice.
  }
}

// Roving tabindex + arrow keys (automatic activation), per the ARIA tabs pattern.
function wireTabs(
  list: HTMLElement,
  onSelect: (tab: HTMLButtonElement, focus: boolean) => void,
): void {
  const tabs = () => [...list.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  list.addEventListener('click', (e) => {
    const tab = (e.target as Element).closest<HTMLButtonElement>('[role="tab"]');
    if (tab) onSelect(tab, false);
  });
  list.addEventListener('keydown', (e) => {
    const all = tabs();
    const i = all.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    const next = {
      ArrowRight: i + 1,
      ArrowDown: i + 1,
      ArrowLeft: i - 1,
      ArrowUp: i - 1,
      Home: 0,
      End: all.length - 1,
    }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    const tab = all[(next + all.length) % all.length];
    if (tab) onSelect(tab, true);
  });
}

function markSelected(list: HTMLElement, selected: HTMLButtonElement, focus: boolean): void {
  for (const t of list.querySelectorAll<HTMLButtonElement>('[role="tab"]')) {
    const on = t === selected;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
  }
  if (focus) selected.focus();
}

function osKey(p: Platform): 'linux' | 'darwin' | 'windows' {
  return p.os === 'macos' || p.os === 'ios' ? 'darwin' : p.os === 'windows' ? 'windows' : 'linux';
}

function setup(root: HTMLElement, platform: Platform): (p: Platform) => void {
  const productList = root.querySelector<HTMLElement>('[data-tabs="product"]');
  const products = [...root.querySelectorAll<HTMLElement>('[data-product]')];
  const channelsOf = (product: HTMLElement) =>
    [...product.querySelectorAll<HTMLDetailsElement>('[data-channel]')].map(
      (d) => d.dataset.channel ?? '',
    );
  const findProduct = (id: string | undefined) => products.find((p) => p.dataset.product === id);
  const remembered = new Map<string, string>();
  let current = platform;

  for (const product of products) {
    const name = product.dataset.product ?? '';
    product.setAttribute('role', 'tabpanel');
    product.setAttribute('aria-labelledby', `tab-install-${name}`);
    // <details> cannot take role="tabpanel"; its inner panel does.
    for (const d of product.querySelectorAll<HTMLDetailsElement>('[data-channel]')) {
      const panel = d.querySelector<HTMLElement>('.picker__panel');
      panel?.setAttribute('role', 'tabpanel');
      panel?.setAttribute('aria-labelledby', `tab-install-${name}-${d.dataset.channel}`);
    }
  }

  // A channel's command and verify blocks each have one element per variant;
  // all elements with the chosen key are shown.
  function chooseVariant(details: HTMLElement, key?: string): void {
    const variants = [...details.querySelectorAll<HTMLElement>('[data-variant]')];
    const keys = [...new Set(variants.map((v) => v.dataset.variant ?? ''))];
    if (keys.length < 2) return;
    const wantArch = current.arch ?? 'x64';
    const first = variants.filter((v) => v.dataset.variantArch);
    const chosen =
      (key && keys.includes(key) ? key : undefined) ??
      first.find(
        (v) => v.dataset.variantOs === osKey(current) && v.dataset.variantArch === wantArch,
      )?.dataset.variant ??
      first.find((v) => !v.dataset.variantOs && v.dataset.variantArch === wantArch)?.dataset
        .variant ??
      keys[0];
    for (const v of variants) v.toggleAttribute('data-active', v.dataset.variant === chosen);
    for (const b of details.querySelectorAll<HTMLButtonElement>('[data-variant-button]')) {
      b.setAttribute('aria-pressed', String(b.dataset.variantButton === chosen));
    }
  }

  function showChannel(product: HTMLElement, channel: string, focus = false): void {
    const list = product.querySelector<HTMLElement>('[data-tabs="channel"]');
    const tab = list?.querySelector<HTMLButtonElement>(`[data-channel-tab="${channel}"]`);
    if (!list || !tab) return;
    markSelected(list, tab, focus);
    for (const d of product.querySelectorAll<HTMLDetailsElement>('[data-channel]')) {
      const on = d.dataset.channel === channel;
      d.open = on;
      d.toggleAttribute('data-active', on);
      if (on) chooseVariant(d);
    }
    remembered.set(product.dataset.product ?? '', channel);
  }

  function showProduct(product: HTMLElement, focus = false): void {
    for (const p of products) p.toggleAttribute('data-active', p === product);
    const tab = productList?.querySelector<HTMLButtonElement>(
      `[data-product-tab="${product.dataset.product}"]`,
    );
    if (productList && tab) markSelected(productList, tab, focus);
  }

  function recommend(): void {
    for (const product of products) {
      const best = defaultChannel(current.os, channelsOf(product));
      for (const t of product.querySelectorAll<HTMLButtonElement>('[data-channel-tab]')) {
        const on = t.dataset.channelTab === best;
        t.toggleAttribute('data-recommended', on);
        if (on) t.setAttribute('aria-describedby', 'install-recommended');
        else t.removeAttribute('aria-describedby');
      }
    }
  }

  function select(
    productId: string | undefined,
    channel: string | undefined,
    opts: { persist?: boolean; focus?: 'product' | 'channel' } = {},
  ): void {
    const product =
      findProduct(productId) ?? findProduct(root.dataset.defaultProduct) ?? products[0];
    if (!product) return;
    showProduct(product, opts.focus === 'product');
    const available = channelsOf(product);
    if (available.length) {
      const name = product.dataset.product ?? '';
      const ch =
        channel && available.includes(channel)
          ? channel
          : (remembered.get(name) ?? defaultChannel(current.os, available));
      if (ch) showChannel(product, ch, opts.focus === 'channel');
    }
    if (opts.persist) {
      const ch = remembered.get(product.dataset.product ?? '');
      const value = ch ? `${product.dataset.product}/${ch}` : (product.dataset.product ?? '');
      history.replaceState(null, '', `#${value}`);
      save(value);
    }
  }

  if (productList) {
    wireTabs(productList, (tab, focus) =>
      select(tab.dataset.productTab, undefined, {
        persist: true,
        ...(focus ? { focus: 'product' as const } : {}),
      }),
    );
  }
  for (const product of products) {
    const list = product.querySelector<HTMLElement>('[data-tabs="channel"]');
    if (!list) continue;
    wireTabs(list, (tab, focus) =>
      select(product.dataset.product, tab.dataset.channelTab, {
        persist: true,
        ...(focus ? { focus: 'channel' as const } : {}),
      }),
    );
  }
  root.addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>('[data-variant-button]');
    const details = b?.closest<HTMLElement>('[data-channel]');
    if (b && details) chooseVariant(details, b.dataset.variantButton);
  });

  function applyInitial(): void {
    const fromHash = parseHash(location.hash);
    const stored = parseHash(load() ?? '');
    const pick = findProduct(fromHash.product) ? fromHash : stored;
    select(pick.product, pick.channel);
  }

  recommend();
  applyInitial();
  addEventListener('hashchange', applyInitial);

  // Arch hints arrive later; they only change which variant is shown.
  return (refined: Platform) => {
    current = refined;
    recommend();
    for (const d of root.querySelectorAll<HTMLDetailsElement>('[data-channel][data-active]'))
      chooseVariant(d);
  };
}

const roots = [...document.querySelectorAll<HTMLElement>('[data-picker]')];
if (roots.length) {
  // Synchronous first guess (no layout wait), refined by high-entropy hints.
  const nav = navigator as Navigator & { userAgentData?: { platform?: string; mobile?: boolean } };
  const quick = fromUserAgent(navigator.userAgent, navigator.maxTouchPoints);
  const os = osFromUAData(nav.userAgentData?.platform) ?? quick.os;
  const first: Platform = { ...quick, os };
  const refiners = roots.map((root) => setup(root, first));
  void detect(navigator).then((p) => refiners.forEach((refine) => refine(p)));
}
