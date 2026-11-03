import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Sample mode is entirely in memory. No account or live API is used here.
const option = key => process.argv[process.argv.indexOf(key) + 1];
const { chromium } = await import(process.argv.includes('--playwright') ? option('--playwright') : 'playwright');
const base = process.env.PREVIEW_URL || 'http://127.0.0.1:4173';
const match = process.argv.includes('--match') ? option('--match').toLowerCase() : '';
const output = fileURLToPath(new URL('./qa-output/tpo-platform/', import.meta.url));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'], ...(process.argv.includes('--browser') ? { executablePath: option('--browser') } : {}) });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true, timezoneId: 'Asia/Seoul' });
const passed = [], issues = [];
page.on('pageerror', error => issues.push(error.message));
page.on('request', request => { if (!request.url().startsWith(base) && !/^(blob:|data:)/.test(request.url())) issues.push(`Unexpected external request: ${request.url()}`); });
page.on('response', response => { if (response.status() >= 400) issues.push(`HTTP ${response.status()}: ${response.url()}`); });
const start = async (query = '') => { await page.goto(`${base}/?${query}`); await page.locator('h1:visible').waitFor(); await page.evaluate(() => document.fonts.ready); };
const route = async name => { await page.evaluate(value => { location.hash = value; }, name); await page.waitForFunction(value => document.body.dataset.route === value, name); };
const rows = async count => { await page.waitForFunction(value => document.querySelectorAll('.timeline-row').length === value, count); };
const open = async name => { await page.locator('[data-testid="record-open"]:visible,[data-testid="record-open-mobile"]:visible').first().click(); await page.getByTestId('title-search').fill(name); await page.getByTestId('search-result').click(); };
const savedDetail = async () => { await page.getByTestId('saved-done').click(); await page.locator('.timeline-row .title-link').first().click(); await page.waitForFunction(() => document.body.dataset.route.startsWith('title/')); };
const edit = () => page.locator('[data-action="edit"]').click();
const custom = async value => { await page.getByTestId('tpo-platform').selectOption('__custom__'); await page.getByTestId('tpo-platform-custom').fill(value); };
const platformValue = async () => await page.getByTestId('tpo-platform').inputValue() === '__custom__' ? page.getByTestId('tpo-platform-custom').inputValue() : page.getByTestId('tpo-platform').inputValue();
const contextValue = async () => ({ when: await page.getByTestId('tpo-when').inputValue(), place: await page.getByTestId('tpo-place').inputValue(), occasion: await page.getByTestId('tpo-occasion').inputValue() });
const exportCSV = async () => { await route('space'); const pending = page.waitForEvent('download'); await page.locator('[data-action="export"]').click(); return readFile(await (await pending).path(), 'utf8'); };
const test = async (name, action) => { if (match && !name.toLowerCase().includes(match)) return; await action(); passed.push(name); console.log(`PASS ${name}`); };

try {
  await test('Platform presets retain video and locale-specific book choices alongside complete TPO choices', async () => {
    for (const lang of ['ko', 'en']) for (const kind of ['movie', 'book']) {
      await start(`scenario=new&lang=${lang}`);
      await open(kind === 'movie' ? (lang === 'ko' ? '밤의 열차' : 'Night Train') : (lang === 'ko' ? '느린 빛' : 'Slow Light'));
      const presets = await page.getByTestId('tpo-platform').locator('optgroup option').allTextContents();
      assert.equal(presets.length, kind === 'movie' ? 16 : lang === 'ko' ? 11 : 12);
      assert.equal(new Set(presets).size, presets.length);
      if (kind === 'movie') assert.ok(presets.some(value => /Netflix|넷플릭스/.test(value)) && presets.some(value => /Blu-ray|블루레이/.test(value)));
      else assert.ok(presets.some(value => lang === 'ko' ? /리디/.test(value) : /Libby/.test(value)));
      assert.equal(await page.getByTestId('tpo-platform').inputValue(), '', 'a new record does not invent a platform');
      assert.equal(await page.getByTestId('tpo-platform').locator('option[value="__custom__"]').count(), 1);
      assert.equal(await page.getByTestId('tpo-place').locator('option:not([value=""])').count(), kind === 'book' ? 9 : 6);
      assert.equal(await page.getByTestId('tpo-occasion').locator('option:not([value=""])').count(), 6);
      assert.equal(await page.getByTestId('tpo-season').count(), 0, 'non-series titles do not show episode controls');
      assert.equal(await page.getByTestId('tpo-episode').count(), 0);
      await page.keyboard.press('Escape');
    }
  });

  await test('Custom platform survives save, display, language, edit and cancel, and can be cleared', async () => {
    await start('scenario=new'); await open('느린 빛');
    const raw = '<b>나의 서점, "책방" & 책</b>';
    await custom(raw); await page.getByTestId('tpo-when').fill('2026-10-22T00:30');
    await page.getByTestId('tpo-place').selectOption('LIBRARY'); await page.getByTestId('tpo-occasion').selectOption('ALONE');
    await page.getByTestId('save-DONE').click(); assert.ok((await page.locator('.saved-context').innerText()).includes(raw));
    await savedDetail(); const detailRoute = await page.evaluate(() => document.body.dataset.route);
    assert.equal(await page.getByTestId('detail-platform').innerText(), raw);
    assert.equal(await page.getByTestId('detail-platform').locator('b').count(), 0, 'custom text is escaped');
    await edit(); assert.equal(await platformValue(), raw); await custom('취소할 플랫폼'); await page.keyboard.press('Escape');
    assert.equal(await page.getByTestId('detail-platform').innerText(), raw);
    await page.getByTestId('language').click(); await edit(); assert.equal(await platformValue(), raw); await page.keyboard.press('Escape');
    await route('home'); assert.ok((await page.locator('[data-testid="archive-featured"]:visible .record-context').innerText()).includes(raw));
    await route('records'); assert.ok((await page.locator('.timeline-row .record-context').innerText()).includes(raw));
    const csv = await exportCSV(); assert.ok(csv.includes(`"${raw.replaceAll('"', '""')}"`), 'custom platform commas and quotes are escaped in CSV');
    await route(detailRoute); await edit(); await page.getByTestId('tpo-platform').selectOption(''); await page.getByTestId('save-edit').click();
    assert.doesNotMatch(await page.getByTestId('detail-platform').innerText(), /나의 서점/);
    await edit(); assert.equal(await page.getByTestId('tpo-platform').inputValue(), ''); await page.keyboard.press('Escape');
  });

  await test('A saved Korean preset remains unchanged when edited in English', async () => {
    await start('scenario=new'); await open('느린 빛');
    const preset = await page.getByTestId('tpo-platform').locator('optgroup option').first().getAttribute('value');
    await page.getByTestId('tpo-platform').selectOption(preset); await page.getByTestId('save-IN_PROGRESS').click(); await savedDetail();
    await page.getByTestId('language').click(); await edit(); assert.equal(await platformValue(), preset);
    await page.getByTestId('note-input').fill('Kept in either language.'); await page.getByTestId('save-edit').click();
    assert.equal(await page.getByTestId('detail-platform').innerText(), preset);
  });

  await test('Series editions validate atomically, preserve cancellation and support specials and wishlist', async () => {
    await start('scenario=new'); await open('블루 아워');
    assert.equal(await page.getByTestId('tpo-season').inputValue(), ''); assert.equal(await page.getByTestId('tpo-episode').isDisabled(), true);
    await custom('나의 영상실'); await page.getByTestId('tpo-season').fill('2'); await page.getByTestId('tpo-episode').fill('3');
    await page.getByTestId('save-IN_PROGRESS').click(); assert.match(await page.locator('dialog').innerText(), /시즌 2.*3화/); await savedDetail();
    const before = await page.locator('.record-edition').innerText(); assert.match(before, /시즌 2.*3화/);
    await edit(); await page.getByTestId('tpo-season').fill('3'); assert.equal(await page.getByTestId('tpo-episode').inputValue(), '');
    await page.getByTestId('tpo-episode').fill('4'); await custom('취소할 영상실'); await page.keyboard.press('Escape');
    assert.equal(await page.locator('.record-edition').innerText(), before); assert.equal(await page.getByTestId('detail-platform').innerText(), '나의 영상실');
    for (const [field, invalid] of [['tpo-season', '-1'], ['tpo-season', '1.5'], ['tpo-episode', '0'], ['tpo-episode', '2.5']]) {
      await edit(); await custom('실패하면 남으면 안 돼요'); await page.getByTestId(field).fill(invalid); await page.getByTestId('save-edit').click();
      assert.equal(await page.locator('dialog[open]').count(), 1, `${field}=${invalid} keeps correction open`);
      assert.match(await page.getByTestId('tpo-error').innerText(), /.+/);
      await page.keyboard.press('Escape'); assert.equal(await page.locator('.record-edition').innerText(), before);
      assert.equal(await page.getByTestId('detail-platform').innerText(), '나의 영상실', 'validation never saves a partial platform change');
    }
    await edit(); await page.getByTestId('tpo-season').fill('0'); await page.getByTestId('tpo-episode').fill('1');
    await page.locator('#edit-status').selectOption('WISHLIST'); await custom('다음에 볼 곳'); await page.getByTestId('save-edit').click();
    assert.match(await page.locator('.record-edition').innerText(), /시즌 0.*1화/); assert.equal(await page.getByTestId('detail-platform').innerText(), '다음에 볼 곳');
    await edit(); await page.getByTestId('tpo-season').fill(''); assert.equal(await page.getByTestId('tpo-episode').inputValue(), '');
    assert.equal(await page.getByTestId('tpo-episode').isDisabled(), true); await page.getByTestId('save-edit').click();
    assert.equal(await page.locator('.record-edition').count(), 0);
  });

  await test('Wishlist accepts a platform without inventing a date and retains existing date, place and occasion', async () => {
    await start('scenario=new'); await open('겨울 도서관'); await custom('동네 책방');
    await page.getByTestId('tpo-when').fill('2026-10-22T00:30'); await page.getByTestId('tpo-place').selectOption('HOME'); await page.getByTestId('tpo-occasion').selectOption('ALONE');
    await page.getByTestId('save-WISHLIST').click(); await savedDetail(); assert.equal(await page.getByTestId('detail-platform').innerText(), '동네 책방');
    await edit(); assert.deepEqual(await contextValue(), { when: '', place: '', occasion: '' }); assert.equal(await platformValue(), '동네 책방'); await page.keyboard.press('Escape');
    await start(); await route('title/record-quiet'); await edit(); const context = await contextValue();
    await page.locator('#edit-status').selectOption('WISHLIST'); assert.equal(await page.getByTestId('tpo-when').isDisabled(), true);
    assert.equal(await page.getByTestId('tpo-platform').isEnabled(), true); await custom('다음에 볼 플랫폼'); await page.getByTestId('save-edit').click();
    await edit(); assert.deepEqual(await contextValue(), context); assert.equal(await platformValue(), '다음에 볼 플랫폼'); await page.keyboard.press('Escape');
  });

  await test('Platform and edition survive offline sync, new-device restore and formula-safe CSV export', async () => {
    await start('scenario=offline'); await open('궤도 밖에서'); await custom('=1+2');
    await page.getByTestId('tpo-season').fill('2'); await page.getByTestId('tpo-episode').fill('5');
    await page.getByTestId('tpo-when').fill('2026-10-22T00:30'); await page.getByTestId('tpo-place').selectOption('TRANSIT'); await page.getByTestId('tpo-occasion').selectOption('ALONE');
    await page.getByTestId('save-IN_PROGRESS').click(); await page.getByTestId('saved-done').click(); await rows(7);
    await page.getByTestId('connectivity').click(); await route('home'); await page.getByTestId('sync-retry').click(); await page.waitForFunction(() => !document.querySelector('[data-testid="sync-retry"]'));
    await route('space'); const code = await page.getByTestId('own-code').innerText(); await page.getByTestId('scenario').selectOption('new-device');
    await route('space'); await page.getByTestId('connect-entry').click(); await page.getByTestId('connection-code').fill(code); await page.getByTestId('connect-submit').click(); await page.getByTestId('connected-done').click(); await rows(7);
    await page.getByTestId('record-search').fill('궤도'); await rows(1); await page.locator('.timeline-row .title-link').click();
    assert.equal(await page.getByTestId('detail-platform').innerText(), '=1+2'); assert.match(await page.locator('.record-edition').innerText(), /시즌 2.*5화/);
    await edit(); assert.equal(await page.getByTestId('tpo-when').inputValue(), '2026-10-22T00:30'); await page.keyboard.press('Escape');
    const csv = await exportCSV(); assert.ok(csv.startsWith('\uFEFF"title","type","status","date","place","occasion","note","rating","platform","season","episode"'));
    assert.match(csv, /"'=1\+2","2","5"/); assert.match(csv, /2026-10-21T15:30:00\.000Z/);
  });

  await test('Platform filter composes with month, place, occasion, status, type and search and clears selectively', async () => {
    await start(); await route('title/record-quiet'); await edit(); await custom('한 곳'); await page.getByTestId('save-edit').click();
    await route('records'); await page.getByTestId('archive-filter-platform').selectOption('한 곳'); await rows(1);
    await page.getByTestId('archive-filter-month').selectOption('2026-11'); await page.getByTestId('archive-filter-place').selectOption('HOME'); await page.getByTestId('archive-filter-occasion').selectOption('FAMILY');
    await page.getByTestId('status-filter').selectOption('DONE'); await page.locator('[data-action="filter-type"][data-value="movie"]').click(); await page.getByTestId('record-search').fill('조용한'); await rows(1);
    await page.locator('[data-action="filter-type"][data-value="book"]').click(); await rows(0);
    await page.getByTestId('archive-clear-filter').click(); await rows(0);
    for (const field of ['month', 'place', 'occasion', 'platform']) assert.equal(await page.getByTestId(`archive-filter-${field}`).inputValue(), '');
    assert.equal(await page.getByTestId('record-search').inputValue(), '조용한'); assert.equal(await page.getByTestId('status-filter').inputValue(), 'DONE');
    assert.equal(await page.locator('[data-action="filter-type"][data-value="book"]').getAttribute('aria-pressed'), 'true');
    await page.getByTestId('record-search').fill(''); await page.getByTestId('status-filter').selectOption('all'); await page.locator('[data-action="filter-type"][data-value="all"]').click();
    await page.getByTestId('archive-filter-platform').selectOption('한 곳'); await rows(1); await page.locator('.timeline-row .title-link').click();
    await edit(); await page.getByTestId('tpo-platform').selectOption(''); await page.getByTestId('save-edit').click(); await route('records'); await rows(6);
    assert.equal(await page.getByTestId('archive-filter-platform').inputValue(), '', 'editing the final matching platform removes its stale filter');
    await page.getByTestId('scenario').selectOption('new'); await page.getByTestId('scenario').selectOption('returning'); await route('records'); await rows(6);
    assert.equal(await page.getByTestId('archive-filter-platform').inputValue(), '');
  });

  await test('Complete TPO controls and sticky actions fit short mobile sheets in both languages', async () => {
    for (const lang of ['ko', 'en']) for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 500 }); await start(`lang=${lang}`); await open(lang === 'ko' ? '궤도 밖에서' : 'Beyond the Orbit'); await custom(lang === 'ko' ? '내가 남기는 플랫폼' : 'My own viewing platform');
      await page.getByTestId('tpo-season').fill('2'); await page.getByTestId('tpo-episode').fill('3');
      for (const field of ['tpo-when', 'tpo-platform', 'tpo-platform-custom', 'tpo-place', 'tpo-occasion', 'tpo-season', 'tpo-episode']) {
        const control = page.getByTestId(field); await control.scrollIntoViewIfNeeded(); const box = await control.boundingBox(), foot = await page.locator('.dialog-foot').boundingBox();
        assert.ok(box.y >= 0 && box.y + box.height <= foot.y + 1, `${lang}/${width}/${field} remains above the sticky actions`);
      }
      assert.equal(await page.locator('dialog').evaluate(dialog => dialog.scrollWidth > dialog.clientWidth + 1), false);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      const save = await page.getByTestId('save-DONE').boundingBox(); assert.ok(save.height >= 48 && save.y >= 0 && save.y + save.height <= 500);
      await page.screenshot({ path: `${output}/platform-${lang}-${width}-short-sheet.png` });
      await page.getByTestId('save-IN_PROGRESS').click(); await page.getByTestId('saved-done').click();
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
  });

  assert.deepEqual(issues, [], 'Browser console/network errors'); assert.ok(passed.length, 'No checks matched');
  await writeFile(`${output}/${match ? 'platform-focused-results' : 'platform-results'}.json`, JSON.stringify({ base, passed, issues }, null, 2));
  console.log(`${passed.length} platform checks passed; screenshots: ${output}`);
} finally { await browser.close(); }
