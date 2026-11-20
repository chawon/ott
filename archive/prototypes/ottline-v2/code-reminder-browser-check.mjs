import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// All account and device changes below use the sample UI's in-memory model.
// No development or production API is called.
const option = key => process.argv[process.argv.indexOf(key) + 1];
const { chromium } = await import(process.argv.includes('--playwright') ? option('--playwright') : 'playwright');
const base = process.env.PREVIEW_URL || 'http://127.0.0.1:4173';
const match = process.argv.includes('--match') ? option('--match').toLowerCase() : '';
const output = fileURLToPath(new URL('./qa-output/code-reminder/', import.meta.url));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'], ...(process.argv.includes('--browser') ? { executablePath: option('--browser') } : {}) });
const passed = [], issues = [];
const reminder = page => page.locator('[data-testid="code-reminder"],dialog .notice:has([data-action="show-code"])');
const start = async (page, query = '') => { await page.goto(`${base}/?${query}`); await page.locator('h1:visible').waitFor(); };
const route = async (page, name) => { await page.evaluate(value => { location.hash = value; }, name); await page.waitForFunction(value => document.body.dataset.route === value, name); };
const save = async (page, title = '느린 빛') => {
  await page.locator('[data-testid="record-open"]:visible,[data-testid="record-open-mobile"]:visible').first().click();
  await page.getByTestId('title-search').fill(title); await page.getByTestId('search-result').click();
  await page.getByTestId('save-DONE').click(); await page.getByTestId('saved-done').waitFor();
};
const done = page => page.getByTestId('saved-done').click();
const ownCode = async page => { await route(page, 'space'); return (await page.getByTestId('own-code').innerText()).replace(/\s/g, ''); };
const restore = async (page, code) => {
  await route(page, 'space'); await page.getByTestId('connect-entry').click(); await page.getByTestId('connection-code').fill(code);
  await page.getByTestId('connect-submit').click(); await page.getByTestId('connected-done').click();
};
const test = async (name, action) => {
  if (match && !name.toLowerCase().includes(match)) return;
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Asia/Seoul', acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  page.on('pageerror', error => issues.push(error.message));
  page.on('request', request => { if (!request.url().startsWith(base) && !/^(blob:|data:)/.test(request.url())) issues.push(`Unexpected external request: ${request.url()}`); });
  page.on('response', response => { if (response.status() >= 400) issues.push(`HTTP ${response.status()}: ${response.url()}`); });
  try { await action(page); passed.push(name); console.log(`PASS ${name}`); }
  finally { await context.close(); }
};

try {
  await test('Single-device reminder appears once and closing it preserves the saved note and date', async page => {
    await start(page); await route(page, 'title/record-quiet');
    const note = await page.locator('.detail-note').innerText();
    const date = await page.getByTestId('detail-when').locator('time').getAttribute('datetime');
    await save(page, '우리의 조용한 날들'); assert.equal(await reminder(page).count(), 1);
    await page.keyboard.press('Escape'); await route(page, 'title/record-quiet');
    assert.equal(await page.locator('.detail-note').innerText(), note);
    assert.equal(await page.getByTestId('detail-when').locator('time').getAttribute('datetime'), date);
    await save(page); assert.equal(await reminder(page).count(), 0, 'closing the first saved sheet consumes the one-time reminder');
    await done(page); await route(page, 'space');
    assert.equal(await page.getByTestId('copy-code').isVisible(), true, 'My space always keeps the code accessible');
    assert.equal(await page.getByTestId('download-code').isVisible(), true);
  });

  await test('Multi-device restored accounts do not prompt even without a downloaded recovery card', async page => {
    await start(page, 'scenario=new-device'); await restore(page, 'M7K2P9WX');
    await route(page, 'space'); assert.equal(await page.locator('.device-row').count(), 2);
    assert.doesNotMatch(await page.locator('.code-block').innerText(), /보관 카드를 만들었어요/);
    await save(page, '작은 숲'); assert.equal(await reminder(page).count(), 0);
    await done(page); await page.getByTestId('scenario').selectOption('new-device'); await restore(page, 'M7K2P9WX');
    await save(page, '밤의 열차'); assert.equal(await reminder(page).count(), 0, 'device metadata survives scenario changes');
  });

  await test('Pending and failed saves do not consume the reminder before the next synced save', async page => {
    for (const scenario of ['offline', 'sync-error']) {
      await start(page, `scenario=${scenario}`); await save(page);
      assert.equal(await reminder(page).count(), 0, `${scenario} does not offer to keep an unsynced record`);
      await done(page); if (scenario === 'offline') await page.getByTestId('connectivity').click();
      await route(page, 'space'); await page.getByTestId('sync-retry').click();
      await page.waitForFunction(() => !document.querySelector('[data-testid="sync-retry"]'));
      assert.equal(await page.locator('dialog[open]').count(), 0, 'background sync does not interrupt with a reminder');
      await save(page, '우리의 조용한 날들'); assert.equal(await reminder(page).count(), 1, 'first eligible synced save may still show the reminder');
      await page.getByTestId('dismiss-code-reminder').click(); assert.equal(await reminder(page).count(), 0);
      assert.equal(await page.locator('dialog[open]').count(), 1, 'Later keeps the saved confirmation open');
      await done(page); await save(page, '밤의 열차'); assert.equal(await reminder(page).count(), 0);
    }
  });

  await test('Successfully copying the code before saving suppresses the reminder', async page => {
    await start(page); const code = await ownCode(page); await page.getByTestId('copy-code').click();
    await page.waitForFunction(() => document.querySelector('#toast')?.textContent.includes('복사했어요'));
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), code);
    assert.doesNotMatch(await page.locator('.code-block').innerText(), /보관 카드를 만들었어요/, 'copying does not claim a card was created');
    await save(page); assert.equal(await reminder(page).count(), 0);
    await done(page); await route(page, 'space'); assert.equal(await page.getByTestId('copy-code').isVisible(), true);
  });

  await test('Creating a recovery card before saving suppresses the reminder', async page => {
    await start(page); await route(page, 'space');
    const pending = page.waitForEvent('download'); await page.getByTestId('download-code').click(); const download = await pending;
    assert.match(download.suggestedFilename(), /recovery-card\.png$/);
    await page.waitForFunction(() => document.querySelector('.code-block')?.textContent.includes('보관 카드를 만들었어요'));
    await save(page); assert.equal(await reminder(page).count(), 0);
  });

  await test('Reminder state belongs to each account, survives scenario changes and resets only with the full reset', async page => {
    await start(page); await save(page, '우리의 조용한 날들'); assert.equal(await reminder(page).count(), 1);
    await page.getByTestId('dismiss-code-reminder').click(); await done(page); const firstCode = await ownCode(page);
    await page.getByTestId('scenario').selectOption('new'); await save(page); assert.equal(await reminder(page).count(), 1, 'a new account has its own first reminder');
    await page.getByTestId('dismiss-code-reminder').click(); await done(page); assert.notEqual(await ownCode(page), firstCode);
    await page.getByTestId('scenario').selectOption('returning'); await save(page, '우리의 조용한 날들'); assert.equal(await reminder(page).count(), 0);
    await done(page); await page.locator('[data-action="reset"]').click();
    await save(page, '우리의 조용한 날들'); assert.equal(await reminder(page).count(), 1, 'explicit full reset restores the sample reminder');
  });

  await test('A failed copy does not count as keeping the code', async page => {
    // Mock browser clipboard failure, without injecting application state.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('Clipboard unavailable'); } } });
      document.execCommand = () => false;
    });
    await start(page); await route(page, 'space'); await page.getByTestId('copy-code').click();
    await page.waitForFunction(() => document.querySelector('#toast')?.textContent.includes('직접 선택해 복사'));
    await save(page); assert.equal(await reminder(page).count(), 1);
  });

  await test('Korean and English mobile confirmations keep record actions and optional code access reachable', async page => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const lang of ['ko', 'en']) {
      await start(page, `scenario=new&lang=${lang}`); await save(page, lang === 'ko' ? '느린 빛' : 'Slow Light');
      assert.equal(await reminder(page).count(), 1);
      assert.equal(await page.locator('dialog').evaluate(dialog => dialog.scrollWidth > dialog.clientWidth + 1), false);
      const action = page.getByTestId('saved-done'); await action.scrollIntoViewIfNeeded(); const bounds = await action.boundingBox();
      assert.ok(bounds.height >= 48 && bounds.y >= 0 && bounds.y + bounds.height <= 844);
      await page.screenshot({ path: `${output}/saved-${lang}-390.png` });
      await page.getByTestId('keep-code').click(); assert.equal(await page.locator('dialog[open]').getByTestId('copy-code').isVisible(), true);
      await page.keyboard.press('Escape'); await route(page, 'space'); assert.equal(await page.locator('main').getByTestId('copy-code').isVisible(), true);
      await save(page, lang === 'ko' ? '밤의 열차' : 'Night Train'); assert.equal(await reminder(page).count(), 0, 'opening the code screen does not repeat the saved-sheet reminder');
      await done(page);
    }
  });

  assert.deepEqual(issues, [], 'Unexpected browser errors or external requests'); assert.ok(passed.length, 'No checks matched');
  await writeFile(`${output}/${match ? 'focused-results' : 'results'}.json`, JSON.stringify({ base, passed, issues }, null, 2));
  console.log(`${passed.length} code reminder checks passed; screenshots: ${output}`);
} finally { await browser.close(); }
