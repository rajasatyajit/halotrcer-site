// Install picker, against a launched-mode build (npm run build:launched-fixture).
// Each OS and arch is mocked through the user agent plus a stubbed
// navigator.userAgentData (or none, as in Safari and Firefox).
import { expect, test, type Page } from '@playwright/test';
import { ORIGINS } from './helpers.ts';

test.skip(process.env.LAUNCHED !== 'true', 'picker tests need a launched build');

const UA = {
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  macSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  win: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  linux:
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  linuxFirefoxArm: 'Mozilla/5.0 (X11; Linux aarch64; rv:142.0) Gecko/20100101 Firefox/142.0',
  iphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
};

interface Mock {
  ua: string;
  // undefined: no userAgentData at all (Safari, Firefox)
  uaData?: { platform: string; mobile: boolean; architecture?: string; bitness?: string };
}

const PLATFORMS: Record<string, Mock> = {
  'macOS arm64': {
    ua: UA.mac,
    uaData: { platform: 'macOS', mobile: false, architecture: 'arm', bitness: '64' },
  },
  'macOS Safari (no hints)': { ua: UA.macSafari },
  'Windows x64': {
    ua: UA.win,
    uaData: { platform: 'Windows', mobile: false, architecture: 'x86', bitness: '64' },
  },
  'Windows arm64': {
    ua: UA.win,
    uaData: { platform: 'Windows', mobile: false, architecture: 'arm', bitness: '64' },
  },
  'Linux x64': {
    ua: UA.linux,
    uaData: { platform: 'Linux', mobile: false, architecture: 'x86', bitness: '64' },
  },
  'Linux arm64 Firefox (no hints)': { ua: UA.linuxFirefoxArm },
  iPhone: { ua: UA.iphone },
};

async function mockPlatform(page: Page, mock: Mock): Promise<void> {
  await page.addInitScript((m: Mock) => {
    const data = m.uaData
      ? {
          platform: m.uaData.platform,
          mobile: m.uaData.mobile,
          brands: [],
          getHighEntropyValues: async () => ({
            architecture: m.uaData?.architecture,
            bitness: m.uaData?.bitness,
          }),
        }
      : undefined;
    Object.defineProperty(Navigator.prototype, 'userAgentData', {
      get: () => data,
      configurable: true,
    });
  }, mock);
}

const channelTab = (page: Page, product: string, channel: string) =>
  page.locator(`#install-${product} [data-channel-tab="${channel}"]`);
const activeVariant = (page: Page, product: string, channel: string) =>
  page.locator(`#install-${product}-${channel} [data-variant][data-active]`);

// [platform, product page, product, expected default channel, expected variant (or undefined)]
const EXPECT: [string, keyof typeof ORIGINS, string, string][] = [
  ['macOS arm64', 'tokvera', 'tokvera', 'brew'],
  ['macOS Safari (no hints)', 'sievant', 'sievant', 'brew'],
  ['Windows x64', 'tokvera', 'tokvera', 'winget'],
  ['Windows arm64', 'sievant', 'sievant', 'winget'],
  ['Linux x64', 'tokvera', 'tokvera', 'script'],
  ['Linux arm64 Firefox (no hints)', 'sievant', 'sievant', 'script'],
  ['Linux x64', 'www', 'halotrcer', 'script'],
  ['Windows x64', 'www', 'halotrcer', 'winget'],
  ['iPhone', 'tokvera', 'tokvera', 'script'],
];

test.describe('recommends a channel per platform', () => {
  for (const [platform, site, product, channel] of EXPECT) {
    test(`${platform}: ${product} -> ${channel}`, async ({ browser }) => {
      const mock = PLATFORMS[platform] as Mock;
      const context = await browser.newContext({
        userAgent: mock.ua,
        isMobile: platform === 'iPhone',
      });
      const page = await context.newPage();
      await mockPlatform(page, mock);
      await page.goto(`${ORIGINS[site]}/`);
      const tab = channelTab(page, product, channel);
      await expect(tab).toHaveAttribute('aria-selected', 'true');
      await expect(tab).toHaveAttribute('data-recommended', '');
      await expect(page.locator(`#install-${product}-${channel}`)).toBeVisible();
      await context.close();
    });
  }
});

test.describe('arch-specific commands follow the detected arch', () => {
  const cases: [string, string, string, string][] = [
    ['Linux x64', 'tokvera', 'apk', 'x64'],
    ['Linux arm64 Firefox (no hints)', 'tokvera', 'apk', 'arm64'],
    ['macOS arm64', 'sievant', 'airgap', 'darwin-arm64'],
    ['Windows x64', 'sievant', 'airgap', 'windows-x64'],
    ['macOS Safari (no hints)', 'sievant', 'airgap', 'darwin-x64'],
  ];
  for (const [platform, product, channel, variant] of cases) {
    test(`${platform}: ${product} ${channel} shows ${variant}`, async ({ browser }) => {
      const mock = PLATFORMS[platform] as Mock;
      const context = await browser.newContext({ userAgent: mock.ua });
      const page = await context.newPage();
      await mockPlatform(page, mock);
      await page.goto(`${ORIGINS[product as 'tokvera' | 'sievant']}/#${product}/${channel}`);
      await expect(activeVariant(page, product, channel)).toHaveAttribute('data-variant', variant);
      await expect(activeVariant(page, product, channel)).toBeVisible();
      const command = await activeVariant(page, product, channel)
        .locator('code')
        .first()
        .textContent();
      expect(command).toContain(
        variant === 'arm64'
          ? 'aarch64'
          : variant === 'x64'
            ? 'x86_64'
            : variant.replace('-x64', '_amd64').replace('-arm64', '_arm64'),
      );
      expect(command).not.toMatch(/\{\w+\}/);
      await context.close();
    });
  }
});

test.describe('choice', () => {
  test.use({ userAgent: UA.linux });

  test('a click overrides the recommendation, updates the hash and persists', async ({ page }) => {
    await page.goto(`${ORIGINS.tokvera}/`);
    await channelTab(page, 'tokvera', 'scoop').click();
    await expect(page).toHaveURL(/#tokvera\/scoop$/);
    await expect(page.locator('#install-tokvera-scoop')).toBeVisible();
    await expect(page.locator('#install-tokvera-script')).toBeHidden();
    await page.goto(`${ORIGINS.tokvera}/about-blank-then-back`);
    await page.goto(`${ORIGINS.tokvera}/`);
    await expect(channelTab(page, 'tokvera', 'scoop')).toHaveAttribute('aria-selected', 'true');
  });

  test('the URL hash wins over the stored choice', async ({ page }) => {
    await page.goto(`${ORIGINS.tokvera}/`);
    await channelTab(page, 'tokvera', 'scoop').click();
    await page.goto(`${ORIGINS.tokvera}/#tokvera/dnf`);
    await expect(channelTab(page, 'tokvera', 'dnf')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#install-tokvera-dnf')).toBeVisible();
  });

  test('a hash can open another product', async ({ page }) => {
    await page.goto(`${ORIGINS.www}/install#sievant/helm`);
    await expect(page.locator('[data-product-tab="sievant"]')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.locator('#install-sievant-helm')).toBeVisible();
    await expect(page.locator('#install-halotrcer')).toBeHidden();
  });

  test('works when localStorage is blocked', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new Error('blocked');
        },
      });
    });
    await page.goto(`${ORIGINS.tokvera}/`);
    await channelTab(page, 'tokvera', 'brew').click();
    await expect(page).toHaveURL(/#tokvera\/brew$/);
    await expect(page.locator('#install-tokvera-brew')).toBeVisible();
  });

  test('switching product shows its channels', async ({ page }) => {
    await page.goto(`${ORIGINS.www}/install`);
    await page.locator('[data-product-tab="tokvera"]').click();
    await expect(page.locator('#install-tokvera')).toBeVisible();
    await expect(page.locator('#install-halotrcer')).toBeHidden();
    await expect(page).toHaveURL(/#tokvera\/script$/);
  });
});

test.describe('keyboard', () => {
  test.use({ userAgent: UA.linux });
  test('arrow keys, Home and End move between tabs (roving tabindex)', async ({ page }) => {
    await page.goto(`${ORIGINS.tokvera}/`);
    const first = channelTab(page, 'tokvera', 'script');
    await first.focus();
    await page.keyboard.press('ArrowRight');
    const second = channelTab(page, 'tokvera', 'powershell');
    await expect(second).toBeFocused();
    await expect(second).toHaveAttribute('aria-selected', 'true');
    await expect(second).toHaveAttribute('tabindex', '0');
    await expect(first).toHaveAttribute('tabindex', '-1');
    await page.keyboard.press('End');
    await expect(channelTab(page, 'tokvera', 'releases')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(first).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(channelTab(page, 'tokvera', 'releases')).toBeFocused();
    await page.keyboard.press('Home');
    await expect(first).toBeFocused();
  });
});

test.describe('copy', () => {
  test.use({ userAgent: UA.mac, permissions: ['clipboard-write'] });
  test('copies the command and announces it', async ({ page }) => {
    // Our Permissions-Policy denies clipboard-read, so record what is written
    // (the real writeText still runs).
    await page.addInitScript(() => {
      const w = window as unknown as { __copied?: string };
      const original = navigator.clipboard.writeText.bind(navigator.clipboard);
      navigator.clipboard.writeText = (text: string) => {
        w.__copied = text;
        return original(text);
      };
    });
    await page.goto(`${ORIGINS.tokvera}/#tokvera/brew`);
    const panel = page.locator('#install-tokvera-brew');
    await panel.getByRole('button', { name: 'Copy' }).click();
    await expect(page.locator('[data-copy-status]').first()).toHaveText('Copied to the clipboard');
    await expect(panel.getByRole('button', { name: 'Copied' })).toBeVisible();
    const copied = await page.evaluate(() => (window as unknown as { __copied?: string }).__copied);
    expect(copied).toBe('brew install --cask rajasatyajit/tap/tokvera');
  });
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('every channel is a <details> with its command', async ({ page }) => {
    await page.goto(`${ORIGINS.www}/install`);
    await expect(page.locator('[role="tablist"]').first()).toBeHidden();
    await expect(page.locator('.copy-button').first()).toBeHidden();
    for (const product of ['halotrcer', 'tokvera', 'sievant']) {
      const channels = page.locator(`#install-${product} details[data-channel]`);
      expect(await channels.count()).toBeGreaterThan(5);
    }
    const brew = page.locator('#install-sievant-brew');
    await brew.locator(':scope > summary').click();
    await expect(brew.locator('code').first()).toHaveText(
      'brew install --cask rajasatyajit/tap/sievant',
    );
    // Arch-specific commands list every variant without JS.
    const apk = page.locator('#install-sievant-apk');
    await apk.locator(':scope > summary').click();
    await expect(apk.locator('[data-variant]')).toHaveCount(2);
    await expect(apk.locator('[data-variant="arm64"] code').first()).toContainText('aarch64');
  });
});
