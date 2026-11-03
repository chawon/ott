import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// All records and credentials below are synthetic. API requests are intercepted
// in the browser; this suite never pairs with or changes a development account.
const option = key => process.argv[process.argv.indexOf(key) + 1];
const { chromium } = await import(process.argv.includes('--playwright') ? option('--playwright') : 'playwright');
const base = process.env.PREVIEW_URL || 'http://127.0.0.1:4173';
const match = process.argv.includes('--match') ? option('--match').toLowerCase() : '';
const output = fileURLToPath(new URL('./qa-output/date-only/', import.meta.url));
await mkdir(output, { recursive: true });
const imageBytes = await readFile(new URL('./assets/quiet-days.jpg', import.meta.url));
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'], ...(process.argv.includes('--browser') ? { executablePath: option('--browser') } : {}) });
const passed = [], issues = [];
const id = number => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const firstId = id(1), secondId = id(2), emptyId = id(3);
const note = '<img src=x onerror="window.__unsafe=true"> 그날의 기억을 그대로 남겨요. '.repeat(20).trim();
const cursor = 'next+page=/development';
const fixtures = Array.from({ length: 61 }, (_, index) => {
  const timestamp = new Date(Date.UTC(2026, 10, 1, 5) - index * 86400000).toISOString();
  return {
    id: id(index + 1),
    title: {
      id: index < 2 ? id(1000) : id(1000 + index),
      type: index < 2 ? 'series' : index % 3 === 2 ? 'book' : 'movie',
      name: index < 2 ? '개발 시리즈 <script>window.__unsafe=true</script>' : `개발 작품 ${String(index).padStart(2, '0')}`,
      year: 2025, genres: [], directors: ['개발 감독'], cast: [], overview: '',
      posterUrl: index === 2 ? null : index === 3 ? 'javascript:alert(1)' : 'https://image.tmdb.org/t/p/w342/base.jpg',
      author: index % 3 === 2 ? '개발 작가 <b>그대로</b>' : null,
      publisher: null, isbn10: null, isbn13: index % 3 === 2 ? `978000000${String(index).padStart(4, '0')}` : null,
      pubdate: null, provider: index % 3 === 2 ? 'KAKAO' : 'TMDB', providerId: `${index}`,
    },
    status: index % 3 === 0 ? 'IN_PROGRESS' : index % 3 === 1 ? 'DONE' : 'WISHLIST',
    rating: index === 0 ? 4.5 : null, note: index === 0 ? note : index === 2 ? null : `개발 메모 ${index}`,
    spoiler: false, ott: 'NETFLIX', seasonNumber: index < 2 ? index + 1 : null,
    episodeNumber: index < 2 ? index + 3 : null,
    seasonPosterUrl: index < 2 ? `https://image.tmdb.org/t/p/w342/season-${index + 1}.jpg` : null,
    seasonYear: index < 2 ? 2026 : null, origin: 'MANUAL',
    watchedAt: index === 0 ? '2026-10-31T15:30:00Z' : index === 2 ? null : timestamp,
    place: index === 0 ? 'CAFE' : null, occasion: index === 0 ? 'BREAK' : null,
    createdAt: timestamp, updatedAt: timestamp,
  };
});

async function setup(options = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Asia/Seoul' });
  const page = await context.newPage();
  const mock = { connected: true, configured: true, records: fixtures, requests: [], failure: '', invalidCode: false, secondPageGate: null, ...options };
  page.on('pageerror', error => issues.push(error.message));
  await context.route('https://image.tmdb.org/**', route => route.fulfill({ status: 200, contentType: 'image/jpeg', body: imageBytes }));
  await context.route(`${base}/preview-api/**`, async route => {
    const request = route.request(), url = new URL(request.url());
    mock.requests.push({ method: request.method(), path: url.pathname, query: url.search, body: request.postDataJSON() });
    const reply = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }).catch(() => {});
    if (url.pathname === '/preview-api/session') {
      if (request.method() === 'DELETE') { mock.connected = false; return reply({ configured: mock.configured, connected: false }); }
      if (request.method() === 'POST') {
        if (mock.invalidCode) return reply({ error: 'INVALID_CODE' }, 400);
        mock.connected = true;
      }
      return reply({ configured: mock.configured, connected: mock.connected });
    }
    if (!mock.connected) return reply({ error: 'SESSION_REQUIRED' }, 401);
    if (mock.failure) return reply({ error: mock.failure }, mock.failure === 'SESSION_EXPIRED' ? 401 : 502);
    if (url.pathname === '/preview-api/auth/profile') return reply({ userId: id(9000), nickname: '개발 닉네임 <img src=x>', personaKey: null, profileUpdatedAt: null });
    if (url.pathname === '/preview-api/logs/page') {
      assert.equal(url.searchParams.get('limit'), '50');
      const second = url.searchParams.has('cursor');
      if (second) {
        assert.equal(url.searchParams.get('cursor'), cursor);
        if (mock.secondPageGate) await mock.secondPageGate;
      }
      return reply({ items: second ? mock.records.slice(50) : mock.records.slice(0, 50), nextCursor: !second && mock.records.length > 50 ? cursor : null });
    }
    throw new Error(`Unexpected API request: ${request.method()} ${url.pathname}`);
  });
  return { page, context, mock };
}
async function start(page, hash = 'records', query = '') {
  await page.goto(`${base}/?data=development${query}#${hash}`);
  await page.getByTestId('data-source').waitFor({ state: 'attached' });
  await page.evaluate(() => document.fonts.ready);
}
async function route(page, name) {
  await page.evaluate(value => { location.hash = value; }, name);
  await page.waitForFunction(value => document.body.dataset.route === value, name);
}
async function rows(page, count) {
  await page.waitForFunction(value => document.querySelectorAll('.timeline-row').length === value, count);
  assert.equal(await page.locator('.timeline-row').count(), count);
}
async function studio(page) {
  if (!await page.getByTestId('data-source').isVisible()) await page.getByTestId('studio-toggle').click();
}
async function noSamples(page) {
  const body = await page.locator('body').innerText();
  for (const text of ['우리의 조용한 날들', 'Our Quiet Days', '블루 아워', 'Blue Hour', 'H4N8 Q6RT', 'M7K2 P9WX']) assert.equal(body.includes(text), false, `Sample leaked into development view: ${text}`);
}
async function noWrites(page) {
  for (const action of ['edit', 'publish', 'save-edit', 'confirm-publish', 'confirm-merge', 'save-status', 'save-profile', 'download-code', 'show-code']) {
    assert.equal(await page.locator(`[data-action="${action}"]:visible:enabled`).count(), 0, `${action} should not be actionable for development records`);
  }
}
async function noOverflow(page, label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  if (overflow) {
    await page.screenshot({ path: `${output}/development-overflow.png` });
    const offenders = await page.locator('body *').evaluateAll(elements => elements.map(element => {
      const box = element.getBoundingClientRect();
      return { tag: element.tagName, className: element.className, right: box.right, width: box.width };
    }).filter(box => box.right > innerWidth).slice(0, 12));
    const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth, main: document.querySelector('main')?.scrollWidth, focused: document.activeElement.outerHTML.slice(0, 120), overflowing: [...document.querySelectorAll('body *')].filter(element => element.scrollWidth > element.clientWidth + 1).slice(0, 12).map(element => ({ className: element.className, scroll: element.scrollWidth, client: element.clientWidth })) }));
    console.error(JSON.stringify({ label, offenders, dimensions }));
  }
  assert.equal(overflow, false, `${label} overflows viewport`);
}
async function test(name, action) {
  if (match && !name.toLowerCase().includes(match)) return;
  await action(); passed.push(name); console.log(`PASS ${name}`);
}

try {
  await test('Development pagination keeps all records and distinct season artwork, text and TPO', async () => {
    const { page, context, mock } = await setup();
    try {
      await start(page); await rows(page, 61); await noSamples(page);
      assert.equal(mock.requests.filter(request => request.path === '/preview-api/logs/page').length, 2);
      await route(page, `title/${firstId}`);
      assert.equal(await page.locator('h1').innerText(), fixtures[0].title.name);
      assert.equal(await page.locator('.detail-note').innerText(), note);
      assert.equal(await page.getByTestId('detail-place').innerText(), '카페');
      assert.equal(await page.getByTestId('detail-occasion').innerText(), '휴식');
      assert.equal(await page.getByTestId('detail-when').locator('time').getAttribute('datetime'), '2026-10-31T15:30:00Z');
      assert.match(await page.getByTestId('detail-when').innerText(), /11월 1일/);
      assert.match(await page.locator('[aria-label="별점"]').innerText(), /4\.5/);
      assert.match(await page.locator('.detail-copy .record-edition').innerText(), /시즌 1.*3화/);
      assert.equal(await page.getByTestId('detail-platform').innerText(), 'NETFLIX');
      assert.doesNotMatch(await page.locator('.detail-copy .record-edition').innerText(), /NETFLIX/, 'platform has its own labelled context field');
      assert.equal(await page.locator('.detail-art img').getAttribute('src'), fixtures[0].seasonPosterUrl);
      assert.equal(await page.evaluate(() => window.__unsafe), undefined);
      await noWrites(page);
      // Exercise the delegated handler as well as visible affordances. Hiding a
      // button alone must not leave the sample mutation flow reachable.
      await page.evaluate(recordId => {
        for (const action of ['edit', 'save-edit', 'publish', 'confirm-publish', 'confirm-merge', 'save-status', 'save-profile']) {
          const button = document.createElement('button');
          button.dataset.action = action; button.dataset.id = recordId; button.dataset.value = 'DONE';
          document.body.append(button); button.click(); button.remove();
        }
      }, firstId);
      assert.equal(await page.locator('dialog[open]').count(), 0);
      assert.equal(await page.locator('.detail-note').innerText(), note);
      await route(page, `title/${secondId}`);
      assert.equal(await page.locator('.detail-art img').getAttribute('src'), fixtures[1].seasonPosterUrl);
      await route(page, `title/${emptyId}`);
      assert.equal(await page.locator('.detail-art img').count(), 0);
      assert.equal(await page.getByTestId('detail-when').innerText(), '기록하지 않았어요');
      assert.equal(await page.locator('img[src=""], img[src^="javascript:"]').count(), 0);
      assert.equal(mock.requests.every(request => request.method === 'GET'), true);
    } finally { await context.close(); }
  });

  await test('Development date-only display hides time and duplicate dates while preserving API timestamps', async () => {
    const {page,context,mock} = await setup({records:fixtures.slice(0,3)});
    try {
      for(const lang of ['ko','en']) {
        await start(page,'home',`&lang=${lang}`);const featured=page.locator('[data-testid="archive-featured"]:visible');await featured.waitFor();
        for(const width of [1440,390,320]) {
          await page.setViewportSize({width,height:width===1440?1000:844});
          await route(page,'home');
          assert.equal(await featured.locator('.context-time').count(),0,'archive date heading is not repeated in context');
          assert.doesNotMatch(await featured.locator('.archive-date').innerText(),/\b\d{1,2}:\d{2}\b|오전|오후/);
          await noOverflow(page,`date-only/${lang}/${width}/home`);
          await route(page,'records');await rows(page,3);
          assert.equal(await page.locator('.timeline-row .context-time').count(),0);
          await noOverflow(page,`date-only/${lang}/${width}/records`);
          await route(page,`title/${firstId}`);
          assert.equal(await page.getByTestId('detail-when').locator('time').getAttribute('datetime'),fixtures[0].watchedAt);
          const shown=await page.getByTestId('detail-when').innerText();
          assert.match(shown,/2026/);assert.doesNotMatch(shown,/\b\d{1,2}:\d{2}\b|오전|오후|\b(?:AM|PM)\b/);
          await noOverflow(page,`date-only/${lang}/${width}/detail`);
          if(width===390)await page.screenshot({path:`${output}/development-${lang}-date-detail.png`,fullPage:true});
        }
      }
      await route(page,'space');const pending=page.waitForEvent('download');await page.locator('[data-action="export"]').click();
      const csv=await readFile(await (await pending).path(),'utf8');
      assert.ok(csv.includes(`"${fixtures[0].watchedAt}"`),'presentation does not rewrite API timestamps in export');
      assert.equal(mock.requests.every(request=>request.method==='GET'),true);
    } finally { await context.close(); }
  });

  await test('Development routes fit desktop and narrow mobile in Korean and English', async () => {
    const { page, context } = await setup();
    try {
      for (const lang of ['ko', 'en']) {
        await start(page, 'records', `&lang=${lang}`); await rows(page, 61);
        for (const width of [1440, 390, 320]) {
          await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
          for (const name of ['home', 'records', `title/${firstId}`, 'space', 'report', 'shelf', 'together']) {
            await route(page, name); await noOverflow(page, `${lang}/${width}/${name}`); await noWrites(page); await noSamples(page);
            if (name === 'together') assert.equal(await page.locator('.community-card').count(), 0);
          }
          await route(page, 'home');
          await page.screenshot({ path: `${output}/development-${lang}-${width}.png`, fullPage: true });
          if (width === 390) {
            await page.screenshot({ path: `${output}/development-${lang}-390-viewport.png` });
            await route(page, `title/${firstId}`);
            await page.locator('.detail-context').scrollIntoViewIfNeeded();
            await page.screenshot({ path: `${output}/development-${lang}-390-detail-viewport.png` });
          }
        }
      }
    } finally { await context.close(); }
  });

  await test('Development archive months and context filters use only loaded records', async () => {
    const { page, context, mock } = await setup();
    try {
      await start(page, 'home');
      const homeControl=(id,attrs='')=>page.locator(`[data-testid="${id}"]${attrs}:visible`).first();
      await page.locator('[data-testid="archive-featured"]:visible').waitFor();
      assert.equal(await page.locator('[data-testid="archive-featured"]:visible').getAttribute('data-id'),firstId);
      await homeControl('archive-month','[data-month="2026-10"]').click();
      assert.equal(await page.locator('[data-testid="archive-featured"]:visible').getAttribute('data-id'),secondId);
      await homeControl('archive-month-records','[data-month="2026-10"]').click();await rows(page,31);
      assert.equal(await page.getByTestId('archive-filter-month').inputValue(),'2026-10');
      await page.getByTestId('archive-clear-filter').click();await rows(page,61);
      await route(page,'home');await homeControl('archive-month','[data-month="2026-11"]').click();
      await homeControl('archive-context','[data-place="CAFE"]').click();await rows(page,1);
      assert.equal(await page.locator('.timeline-row .title-link').innerText(),fixtures[0].title.name);
      assert.equal(await page.getByTestId('archive-filter-month').inputValue(),'');
      await noWrites(page);await noSamples(page);
      await page.getByTestId('data-source').selectOption('sample');await route(page,'records');await rows(page,6);
      assert.equal(await page.getByTestId('archive-filter-place').inputValue(),'');
      await page.getByTestId('data-source').selectOption('development');await route(page,'records');await rows(page,61);
      assert.equal(await page.getByTestId('archive-filter-place').inputValue(),'');
      assert.equal(mock.requests.every(request=>request.method==='GET'),true,'archive exploration never mutates development data');
    } finally { await context.close(); }
  });

  await test('Reloading a changed development archive normalizes its selected month', async () => {
    const { page, context, mock } = await setup();
    try {
      await start(page,'home');await page.locator('[data-testid="archive-featured"]:visible').waitFor();
      await page.locator('[data-testid="archive-month"][data-month="2026-10"]:visible').click();
      await page.locator('[data-testid="archive-month-records"][data-month="2026-10"]:visible').click();await rows(page,31);
      await page.getByTestId('archive-filter-place').selectOption('CAFE');
      await page.getByTestId('archive-filter-occasion').selectOption('BREAK');await rows(page,0);
      await page.getByTestId('archive-filter-platform').selectOption('NETFLIX');
      mock.records=[{...fixtures[0],place:null,occasion:null,ott:null}];
      await route(page,'space');await page.getByTestId('development-refresh').click();
      await page.waitForFunction(()=>document.querySelector('[data-testid="development-status"]')?.dataset.phase==='ready');
      await route(page,'home');
      assert.equal(await page.locator('[data-testid="archive-featured"]:visible').getAttribute('data-id'),firstId);
      assert.equal(await page.locator('[data-testid="archive-month"][data-month="2026-10"]:visible').count(),0);
      assert.equal(await page.locator('[data-testid="archive-month"][data-month="2026-11"]:visible').getAttribute('aria-pressed'),'true');
      await route(page,'records');await rows(page,1);
      for(const field of ['month','place','occasion','platform'])assert.equal(await page.getByTestId(`archive-filter-${field}`).inputValue(),'','reload drops filters missing from new data');
      await route(page,'home');
      await page.setViewportSize({width:390,height:844});
      const status=await page.getByTestId('development-status').boundingBox();
      assert.ok(status.height<=100,'connected development chrome stays compact above the archive');
      await noOverflow(page,'development compact status');
    } finally { await context.close(); }
  });

  await test('Undated and wishlist archive pages do not invent viewing time or a note', async () => {
    for(const kind of ['undated','wishlist']) {
      const raw={...fixtures[2],id:id(700),status:kind==='wishlist'?'WISHLIST':'DONE',watchedAt:null,createdAt:kind==='undated'?null:'2026-10-14T08:00:00Z',updatedAt:null,note:null,place:null,occasion:null};
      const {page,context}=await setup({records:[raw]});
      try{
        await start(page,'home');const featured=page.locator('[data-testid="archive-featured"]:visible');await featured.waitFor();
        assert.equal(await featured.getAttribute('data-id'),raw.id);
        assert.equal(await featured.locator('.context-time').count(),0);
        assert.equal(await featured.locator('blockquote').count(),0,'blank notes do not become invented quotes');
        assert.doesNotMatch(await featured.innerText(),/1970|NaN|Invalid Date/);
        const month=kind==='undated'?'undated':'2026-10';
        await page.locator(`[data-testid="archive-month-records"][data-month="${month}"]:visible`).click();await rows(page,1);
        if(kind==='undated')assert.match(await page.locator('.timeline-date').innerText(),/날짜 미기록/);
        else assert.match(await page.locator('.timeline-date').innerText(),/기록한 날|담아/);
        await route(page,`title/${raw.id}`);
        assert.equal(await page.getByTestId('detail-when').innerText(),'기록하지 않았어요');
        await noSamples(page);await noWrites(page);
      }finally{await context.close();}
    }
  });

  await test('Development raw platforms stay escaped, locale-stable and filterable across source changes', async () => {
    const raw = '<img src=x onerror="window.__platformUnsafe=true"> & 나의 플랫폼';
    const records = [{...fixtures[0], ott:raw}, {...fixtures[1], ott:'NETFLIX'}, {...fixtures[2], ott:null}];
    const {page,context,mock} = await setup({records});
    try {
      await start(page,'home');
      const featured=page.locator('[data-testid="archive-featured"]:visible');await featured.waitFor();
      assert.ok((await featured.locator('.record-context').innerText()).includes(raw));
      for(const lang of ['ko','en']) {
        if(lang==='en')await page.getByTestId('language').click();
        await route(page,`title/${firstId}`);
        assert.equal(await page.getByTestId('detail-platform').innerText(),raw);
        assert.equal(await page.getByTestId('detail-platform').locator('img').count(),0);
        assert.equal(await page.evaluate(()=>window.__platformUnsafe),undefined);
        await route(page,'records');await rows(page,3);
        assert.ok((await page.locator('.timeline-row').first().locator('.record-context').innerText()).includes(raw));
        assert.doesNotMatch(await page.locator('main').innerText(),/undefined|\[object Object\]/);
      }
      await page.getByTestId('archive-filter-platform').selectOption(raw);await rows(page,1);
      await page.getByTestId('archive-filter-month').selectOption('2026-11');
      await page.getByTestId('archive-filter-place').selectOption('CAFE');
      await page.getByTestId('archive-filter-occasion').selectOption('BREAK');
      await page.getByTestId('status-filter').selectOption('IN_PROGRESS');
      await page.locator('[data-action="filter-type"][data-value="series"]').click();
      await page.getByTestId('record-search').fill('그날의 기억');await rows(page,1);
      await page.getByTestId('status-filter').selectOption('DONE');await rows(page,0);
      await page.getByTestId('archive-clear-filter').click();await rows(page,0);
      assert.equal(await page.getByTestId('archive-filter-platform').inputValue(),'');
      assert.equal(await page.getByTestId('record-search').inputValue(),'그날의 기억');
      assert.equal(await page.getByTestId('status-filter').inputValue(),'DONE');
      await page.getByTestId('status-filter').selectOption('all');await page.getByTestId('record-search').fill('');
      await page.locator('[data-action="filter-type"][data-value="all"]').click();await rows(page,3);
      await page.getByTestId('archive-filter-platform').selectOption(raw);await rows(page,1);
      await page.getByTestId('data-source').selectOption('sample');await route(page,'records');await rows(page,6);
      assert.equal(await page.getByTestId('archive-filter-platform').inputValue(),'');
      await page.getByTestId('data-source').selectOption('development');await route(page,'records');await rows(page,3);
      assert.equal(await page.getByTestId('archive-filter-platform').inputValue(),'');
      assert.equal(mock.requests.every(request=>request.method==='GET'),true);
    } finally { await context.close(); }
  });

  await test('Development account connection and invalid code stay separate from sample account', async () => {
    const { page, context, mock } = await setup({ connected: false, invalidCode: true });
    try {
      await start(page, 'home'); await noSamples(page);
      await page.getByTestId('development-connect').first().click();
      await page.getByTestId('development-code').fill('ABCDEFGH');
      await page.getByTestId('development-connect-submit').click();
      await page.waitForFunction(() => document.querySelector('#development-code-error')?.textContent.trim());
      assert.equal(await page.locator('.timeline-row').count(), 0); await noSamples(page);
      mock.invalidCode = false;
      await page.getByTestId('development-code').fill('qrstuvwx');
      await page.getByTestId('development-connect-submit').click();
      await page.waitForFunction(() => !document.querySelector('dialog[open]'));
      await route(page, 'records'); await rows(page, 61);
      const posts = mock.requests.filter(request => request.method === 'POST');
      assert.equal(posts.length, 2);
      assert.equal(posts.every(request => request.path === '/preview-api/session' && Object.keys(request.body).join() === 'code'), true);
      assert.equal(page.url().toUpperCase().includes('QRSTUVWX'), false);
      assert.equal(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }).toUpperCase().includes('QRSTUVWX')), false);
      await route(page, 'space'); await noSamples(page); await noWrites(page);
      await page.getByTestId('development-disconnect').click();
      await page.waitForFunction(() => !document.body.textContent.includes('개발 닉네임'));
      await route(page, 'records'); assert.equal(await page.locator('.timeline-row').count(), 0);
    } finally { await context.close(); }
  });

  await test('Empty, unavailable and expired development sessions never show sample records', async () => {
    for (const configuration of [{ records: [] }, { failure: 'API_UNAVAILABLE' }, { failure: 'SESSION_EXPIRED' }, { configured: false, connected: false }]) {
      const { page, context, mock } = await setup(configuration);
      try {
        await start(page, 'home');
        await page.waitForFunction(() => ['ready', 'error', 'disconnected'].includes(document.querySelector('[data-testid="development-status"]')?.dataset.phase));
        await noSamples(page);
        await route(page, 'records'); assert.equal(await page.locator('.timeline-row').count(), 0);
        await route(page, 'space'); assert.equal(await page.getByTestId('own-code').count(), 0);
        if (configuration.failure) {
          mock.failure = ''; await page.getByTestId(configuration.failure === 'SESSION_EXPIRED' ? 'development-connect' : 'development-refresh').first().waitFor();
        }
      } finally { await context.close(); }
    }
  });

  await test('Refreshing a revoked session removes previously visible private records', async () => {
    const { page, context, mock } = await setup();
    try {
      await start(page); await rows(page, 61);
      mock.failure = 'SESSION_EXPIRED';
      await route(page, 'space'); await page.getByTestId('development-refresh').first().click();
      await page.waitForFunction(() => document.querySelectorAll('.timeline-row').length === 0);
      await page.waitForFunction(() => !document.body.textContent.includes('개발 닉네임'));
      await noSamples(page);
      await route(page, `title/${firstId}`);
      assert.equal(await page.locator('.detail-note').count(), 0);
    } finally { await context.close(); }
  });

  await test('Switching to sample during pagination discards the delayed development response', async () => {
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    const { page, context, mock } = await setup({ secondPageGate: gate });
    try {
      await start(page);
      await page.waitForFunction(() => document.body.textContent.includes('50'));
      assert.equal(mock.requests.filter(request => request.path === '/preview-api/logs/page').length, 2);
      assert.equal(await page.locator('.timeline-row').count(), 0, 'Do not render a partial snapshot as the complete account');
      await page.getByTestId('data-source').selectOption('sample'); await route(page, 'records'); await rows(page, 6);
      release();
      await page.waitForTimeout(150);
      await rows(page, 6);
      assert.equal(await page.locator('body').innerText().then(text => text.includes('개발 시리즈')), false);
      assert.notEqual(new URL(page.url()).searchParams.get('data'), 'development');
      await page.getByTestId('data-source').selectOption('development'); await route(page, 'records'); await rows(page, 61);
      await noSamples(page);
    } finally { release(); await context.close(); }
  });

  assert.deepEqual(issues, [], 'Unexpected browser errors');
  assert.ok(passed.length, 'No checks matched');
  await writeFile(`${output}/${match ? 'development-focused-results' : 'development-results'}.json`, JSON.stringify({ base, passed, issues }, null, 2));
  console.log(`${passed.length} development checks passed; screenshots: ${output}`);
} finally { await browser.close(); }
