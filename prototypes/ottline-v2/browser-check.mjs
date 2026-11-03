import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const option = key => process.argv[process.argv.indexOf(key) + 1];
const modulePath = process.argv.includes('--playwright') ? option('--playwright') : 'playwright';
const match = process.argv.includes('--match') ? option('--match') : '';
const { chromium } = await import(modulePath);
const base = process.env.PREVIEW_URL || 'http://127.0.0.1:4173';
const output = fileURLToPath(new URL('./qa-output/tpo-platform/', import.meta.url));
await mkdir(output, {recursive:true});
const browser = await chromium.launch({headless:true, args:['--no-sandbox'], ...(process.argv.includes('--browser') ? {executablePath:option('--browser')} : {})});
const results=[];
const issues=[];
const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true,timezoneId:'Asia/Seoul'});
page.on('pageerror', e=>issues.push(e.message));
page.on('request', r=>{if(!r.url().startsWith(base)&&!r.url().startsWith('blob:')&&!r.url().startsWith('data:'))issues.push(`Unexpected external request: ${r.url()}`)});
page.on('response', r=>{if(r.status()>=400)issues.push(`HTTP ${r.status()}: ${r.url()}`)});
const test=async(name, fn)=>{if(match&&!name.toLowerCase().includes(match.toLowerCase()))return;await fn();results.push(name);console.log(`PASS ${name}`)};
const start=async(query='')=>{await page.goto(`${base}/?${query}`);await page.locator('h1:visible').waitFor();await page.evaluate(()=>document.fonts.ready)};
const route=async(name)=>{await page.evaluate(name=>{location.hash=name},name);await page.waitForFunction(name=>document.body.dataset.route===name,name)};
const rows=async(count)=>{await page.waitForFunction(n=>document.querySelectorAll('.timeline-row').length===n,count);assert.equal(await page.locator('.timeline-row').count(),count)};
const connect=async()=>{await route('space');await page.getByTestId('connect-entry').click();await page.getByTestId('connection-code').fill('m7k2 p9wx');await page.getByTestId('connect-submit').click()};
try {
 await test('Selected A direction across locales, themes and mobile layouts',async()=>{
  for(const variant of ['archive']) for(const lang of ['ko','en']) for(const theme of ['light','dark']) {
   await start(`variant=${variant}&lang=${lang}&theme=${theme}`);
   for(const width of [1440,390,320]) {
    await page.setViewportSize({width,height:width===1440?1000:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${variant}/${lang}/${theme}/${width} overflow`);
    assert.equal(await page.locator('h1:visible').count(),1);
    assert.equal(await page.evaluate(()=>document.documentElement.lang),lang);
    await page.locator('img:visible').evaluateAll(images=>Promise.all(images.map(img=>{img.loading='eager';return img.decode().catch(()=>{})})));
    assert.equal(await page.locator('img:visible').evaluateAll(images=>images.some(img=>!img.naturalWidth)),false,'broken image');
    if(width!==320)await page.screenshot({path:`${output}/${variant}-${lang}-${theme}-${width}.png`,fullPage:true});
    if(width!==1440)await page.screenshot({path:`${output}/${variant}-${lang}-${theme}-${width}-viewport.png`});
   }
  }
  await page.setViewportSize({width:1440,height:1000});
 });
 await test('Every product route and recording dialog fits a mobile viewport',async()=>{
  await page.setViewportSize({width:390,height:844});
  for(const variant of ['archive'])for(const lang of ['ko','en']) {
   await start(`variant=${variant}&lang=${lang}&theme=dark`);
   for(const name of ['records','together','space','report','title/record-quiet',...(lang==='ko'?['shelf']:[])]) {
    await route(name);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${variant}/${lang}/${name} overflow`);
   }
   await page.getByTestId('record-open-mobile').click();await page.getByTestId('search-result').first().click();assert.equal(await page.locator('dialog').evaluate(dialog=>dialog.scrollWidth>dialog.clientWidth+1),false,'dialog overflow');await page.screenshot({path:`${output}/${variant}-${lang}-mobile-sheet.png`});await page.keyboard.press('Escape');
  }
  await page.setViewportSize({width:1440,height:1000});
 });
 await test('Selected A keeps mobile priorities and normalizes old comparison links',async()=>{
  await page.setViewportSize({width:390,height:844});
  for(const query of ['', 'variant=journal']) {
   await start(query);
   assert.equal(await page.evaluate(()=>document.body.dataset.variant),'archive');
   assert.equal(new URL(page.url()).searchParams.get('variant'),'archive');
   assert.equal(await page.getByTestId('mobile-archive-home').isVisible(),true);
   assert.equal(await page.locator('[data-action="variant"]').count(),0);
   assert.match(await page.getByTestId('selected-variant').innerText(),/A.*아카이브/);
   assert.equal(await page.getByTestId('scenario').isVisible(),false);
   assert.ok((await page.locator('.studio').boundingBox()).height<=64,'collapsed controls should leave room for records');
   const focus=page.getByTestId('mobile-search');
   const bounds=await focus.boundingBox();const navigation=await page.locator('.mobile-nav').boundingBox();
   assert.ok(bounds.y>=0&&bounds.y+bounds.height<navigation.y,'record entry fits above navigation');
   // The revised A leads with a remembered moment; continuing titles follow it.
   // Assert the new content priority instead of fixing the old rail's position.
   const featured=page.locator('[data-testid="archive-featured"]:visible');
   const moment=await featured.boundingBox();
   assert.ok(moment.y>=0&&moment.y<navigation.y,'featured moment begins in the first viewport');
   const context=await featured.locator('.record-context').boundingBox();
   assert.ok(context.y+context.height<navigation.y,'featured TPO is readable above mobile navigation');
   await focus.click();await page.getByTestId('title-search').waitFor();await page.keyboard.press('Escape');
   await page.getByTestId('studio-toggle').click();assert.equal(await page.getByTestId('scenario').isVisible(),true);
   await page.getByTestId('language').click();assert.equal(await page.evaluate(()=>document.documentElement.lang),'en');
   await page.getByTestId('studio-toggle').click();assert.equal(await page.getByTestId('scenario').isVisible(),false);
   assert.match(await page.getByTestId('selected-variant').innerText(),/A.*Archive/);
   await route('records');await rows(6);
  }
  await page.setViewportSize({width:1440,height:1000});
 });
 await test('Archive months and TPO open the matching records and compose with existing filters',async()=>{
  await page.setViewportSize({width:1440,height:1000});await start();
  const featured=()=>page.locator('[data-testid="archive-featured"]:visible');
  const homeControl=(id,attrs='')=>page.locator(`[data-testid="${id}"]${attrs}:visible`).first();
  assert.equal(await featured().getAttribute('data-id'),'record-quiet');
  await homeControl('archive-month','[data-month="2026-10"]').click();
  assert.equal(await featured().getAttribute('data-id'),'record-blue');
  await homeControl('archive-month-records','[data-month="2026-10"]').click();await rows(5);
  assert.equal(await page.getByTestId('archive-filter-month').inputValue(),'2026-10');
  const added=page.locator('.timeline-row').filter({hasText:'작은 숲의 계절'});
  assert.match(await added.locator('.timeline-date').innerText(),/기록한 날/);
  assert.equal(await added.locator('.context-time').count(),0,'no watched time invented for date-free memory');
  await page.getByTestId('archive-filter-occasion').selectOption('FRIENDS');await rows(1);
  assert.match(await page.locator('.timeline-row').innerText(),/밤의 열차/);
  await page.getByTestId('archive-clear-filter').click();await rows(6);

  await route('home');await homeControl('archive-context','[data-place="HOME"]').click();await rows(2);
  assert.equal(await page.getByTestId('archive-filter-month').inputValue(),'','context exploration spans all months');
  await page.getByTestId('status-filter').selectOption('IN_PROGRESS');await rows(1);
  await page.getByTestId('record-search').fill('밤');await rows(1);
  await page.locator('[data-action="filter-type"][data-value="book"]').click();await rows(0);
  await page.getByTestId('archive-clear-filter').click();await rows(0);
  assert.equal(await page.getByTestId('archive-filter-place').inputValue(),'');
  assert.equal(await page.getByTestId('record-search').inputValue(),'밤','clearing archive context preserves typed search');
  assert.equal(await page.getByTestId('status-filter').inputValue(),'IN_PROGRESS');
  assert.equal(await page.locator('[data-action="filter-type"][data-value="book"]').getAttribute('aria-pressed'),'true');
  await page.locator('[data-action="filter-type"][data-value="all"]').click();await rows(1);
  await page.getByTestId('status-filter').selectOption('all');await rows(2);
  await page.getByTestId('record-search').fill('');await rows(6);
  await page.getByTestId('archive-filter-place').selectOption('CAFE');await rows(1);
  await page.getByTestId('scenario').selectOption('new');await page.getByTestId('scenario').selectOption('returning');
  await route('records');await rows(6);
  assert.equal(await page.getByTestId('archive-filter-place').inputValue(),'','scenario reset clears previous account filters');
 });
 await test('Mobile archive month controls keep TPO exploration and detail reachable',async()=>{
  for(const lang of ['ko','en'])for(const width of [390,320]){
   await page.setViewportSize({width,height:844});await start(`lang=${lang}`);
   const month=page.locator('[data-testid="archive-month"][data-month="2026-10"]:visible');
   assert.ok((await month.boundingBox()).height>=48,'month controls have generous touch targets');
   await month.click();
   const featured=page.locator('[data-testid="archive-featured"]:visible');
   assert.equal(await featured.getAttribute('data-id'),'record-blue');
   await featured.locator('[data-action="detail"]').first().click();
   await page.waitForFunction(()=>document.body.dataset.route==='title/record-blue');
   assert.match(await page.getByTestId('detail-place').innerText(),lang==='ko'?/집/:/Home/);
   await route('home');
   await page.locator('[data-testid="archive-context"][data-place="HOME"]:visible').first().click();await rows(2);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.getByTestId('archive-clear-filter').click();await rows(6);
  }
  await page.setViewportSize({width:1440,height:1000});
 });
 await test('Mobile recording sheet stays reachable at short viewport heights',async()=>{
  for(const width of [390,320]) {
   await page.setViewportSize({width,height:500});await start('variant=archive');
   await page.getByTestId('record-open-mobile').click();await page.getByTestId('title-search').waitFor();
   await page.locator('dialog[open]').evaluate(dialog=>Promise.all(dialog.getAnimations().map(animation=>animation.finished)));
   const sheet=await page.locator('dialog[open]').boundingBox();
   assert.ok(sheet.y>=0&&Math.abs(sheet.y+sheet.height-500)<=2,'sheet should end at viewport bottom');
   await page.getByTestId('title-search').fill('느린 빛');await page.getByTestId('search-result').click();
   const save=page.getByTestId('save-DONE');await save.scrollIntoViewIfNeeded();
   assert.ok((await save.boundingBox()).height>=48,'save touch target');
   await save.click();await page.getByTestId('saved-done').click();await rows(7);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.getByTestId('record-open-mobile').click();
   for(let i=0;i<12;i++)await page.keyboard.press('Tab');
   assert.equal(await page.evaluate(()=>!!document.activeElement.closest('dialog')),true);
   await page.keyboard.press('Escape');assert.equal(await page.locator('dialog[open]').count(),0);
  }
  await page.setViewportSize({width:1440,height:1000});
 });
 await test('Long mobile notes preserve text and keep recording actions available',async()=>{
  await page.setViewportSize({width:320,height:844});await start();await route('title/record-quiet');
  const note='오늘의 장면을 오래 기억하고 싶어요. '.repeat(100).slice(0,2000).trim();
  await page.locator('[data-action="edit"]').click();await page.getByTestId('note-input').fill(note);await page.getByTestId('save-edit').click();
  assert.equal(await page.locator('.detail-note').innerText(),note);
  await route('records');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:`${output}/archive-mobile-long-note.png`});
  await page.getByTestId('record-open-mobile').click();await page.getByTestId('title-search').waitFor();await page.keyboard.press('Escape');
  await page.setViewportSize({width:1440,height:1000});
 });
 await test('Mobile home preserves pending records and resumes interrupted restore',async()=>{
  await page.setViewportSize({width:390,height:844});
  for(const variant of ['archive']) {
   await start(`variant=${variant}&scenario=offline`);await page.getByTestId('record-open-mobile').click();
   await page.getByTestId('title-search').fill('느린 빛');await page.getByTestId('search-result').click();
   await page.getByTestId('save-DONE').click();await page.getByTestId('saved-done').click();await rows(7);await route('home');
   assert.equal(await page.getByTestId('mobile-reconnect').count(),0);assert.equal(await page.getByTestId('mobile-sync-retry').count(),0);
   await page.getByTestId('studio-toggle').click();await page.getByTestId('connectivity').click();await page.getByTestId('studio-toggle').click();
   const retry=page.getByTestId('mobile-sync-retry');assert.equal(await retry.isVisible(),true);
   await retry.click();await page.waitForFunction(()=>!document.querySelector('[data-testid="mobile-sync-retry"]'));
   await route('records');await rows(7);assert.equal(await page.locator('main .is-pending').count(),0);
   await start(`variant=${variant}&scenario=restore-error`);await connect();await page.getByTestId('restore-retry').waitFor();
   await page.keyboard.press('Escape');await route('home');assert.equal(await page.getByTestId('mobile-resume-restore').isVisible(),true);
   await page.getByTestId('mobile-resume-restore').click();await page.getByTestId('connected-done').click();await rows(3);
  }
  await page.setViewportSize({width:1440,height:1000});
 });
 await test('Mobile first visit offers both a first record and existing-record connection',async()=>{
  await page.setViewportSize({width:390,height:844});
  for(const variant of ['archive']) {
   await start(`variant=${variant}&scenario=new`);
   assert.equal(await page.getByTestId('mobile-first-record').isVisible(),true);
   assert.equal(await page.getByTestId('mobile-connect-entry').isVisible(),true);
   await page.screenshot({path:`${output}/${variant}-mobile-new.png`});
   await page.getByTestId('mobile-first-record').click();await page.getByTestId('title-search').waitFor();await page.keyboard.press('Escape');
   await page.getByTestId('mobile-connect-entry').click();await page.getByTestId('connection-code').fill('m7k2 p9wx');
   await page.getByTestId('connect-submit').click();await page.getByTestId('connected-done').click();await rows(3);
  }
  await page.setViewportSize({width:1440,height:1000});
 });
 await test('TPO entry keeps the local day through cards, editing, cancellation and export',async()=>{
  await page.setViewportSize({width:390,height:844});
  for(const variant of ['archive']) {
   await start(`variant=${variant}&scenario=new`);await page.getByTestId('mobile-first-record').click();
   await page.getByTestId('title-search').fill('느린 빛');await page.getByTestId('search-result').click();
   assert.equal(await page.getByTestId('tpo-place').inputValue(),'');assert.equal(await page.getByTestId('tpo-occasion').inputValue(),'');
   await page.getByTestId('tpo-when').fill('2026-10-22T00:30');await page.getByTestId('tpo-place').selectOption('CAFE');await page.getByTestId('tpo-occasion').selectOption('FRIENDS');
   await page.screenshot({path:`${output}/${variant}-tpo-input.png`});await page.getByTestId('save-DONE').click();
   assert.match(await page.locator('.saved-context').innerText(),/카페/);assert.match(await page.locator('.saved-context').innerText(),/친구/);
   await page.getByTestId('saved-done').click();await rows(1);assert.match(await page.locator('.timeline-row').innerText(),/10월 22일/);
   await page.locator('.timeline-row .title-link').click();await page.waitForFunction(()=>document.body.dataset.route.startsWith('title/'));
   const detailRoute=await page.evaluate(()=>document.body.dataset.route);
   assert.match(await page.getByTestId('detail-place').innerText(),/카페/);assert.match(await page.getByTestId('detail-occasion').innerText(),/친구/);
   await page.locator('[data-action="edit"]').click();assert.equal(await page.getByTestId('tpo-when').inputValue(),'2026-10-22T00:30');
   await page.getByTestId('tpo-place').selectOption('HOME');await page.getByTestId('tpo-when').fill('2026-10-23T09:00');await page.keyboard.press('Escape');
   assert.match(await page.getByTestId('detail-place').innerText(),/카페/);
   await page.locator('[data-action="edit"]').click();assert.equal(await page.getByTestId('tpo-when').inputValue(),'2026-10-22T00:30');
   await page.getByTestId('tpo-occasion').selectOption('FAMILY');await page.getByTestId('note-input').fill('함께 기억하고 싶은 새벽');await page.getByTestId('save-edit').click();
   await route('home');await page.getByTestId('studio-toggle').click();await page.getByTestId('language').click();await page.getByTestId('studio-toggle').click();
   await route(detailRoute);assert.match(await page.getByTestId('detail-place').innerText(),/Caf[eé]/i);assert.match(await page.getByTestId('detail-occasion').innerText(),/family/i);
   await route('space');const pendingDownload=page.waitForEvent('download');await page.locator('[data-action="export"]').click();const download=await pendingDownload;
   const csv=await readFile(await download.path(),'utf8');assert.match(csv,/2026-10-21T15:30:00\.000Z/);assert.match(csv,/CAFE/);assert.match(csv,/FAMILY/);
   await route(detailRoute);await page.locator('[data-action="publish"]').click();await page.getByTestId('confirm-publish').click();await page.waitForFunction(()=>document.body.dataset.route==='together');
   assert.doesNotMatch(await page.locator('.community-card').first().innerText(),/Caf[eé]|family/i);
  }
  await page.setViewportSize({width:1440,height:1000});
 });
 await test('TPO empty values and wishlist do not invent context or erase existing memories',async()=>{
  await start('scenario=new');await page.getByTestId('first-record').click();await page.getByTestId('title-search').fill('겨울 도서관');await page.getByTestId('search-result').click();
  await page.getByTestId('tpo-place').selectOption('HOME');await page.getByTestId('tpo-occasion').selectOption('ALONE');await page.getByTestId('save-WISHLIST').click();await page.getByTestId('saved-done').click();await rows(1);
  await page.locator('.timeline-row .title-link').click();await page.waitForFunction(()=>document.body.dataset.route.startsWith('title/'));
  await page.locator('[data-action="edit"]').click();assert.equal(await page.getByTestId('tpo-when').inputValue(),'');assert.equal(await page.getByTestId('tpo-place').inputValue(),'');assert.equal(await page.getByTestId('tpo-occasion').inputValue(),'');await page.keyboard.press('Escape');
  await start();await route('title/record-quiet');await page.locator('[data-action="edit"]').click();
  const before={when:await page.getByTestId('tpo-when').inputValue(),place:await page.getByTestId('tpo-place').inputValue(),occasion:await page.getByTestId('tpo-occasion').inputValue()};
  await page.locator('#edit-status').selectOption('WISHLIST');await page.getByTestId('save-edit').click();await page.locator('[data-action="edit"]').click();
  assert.equal(await page.getByTestId('tpo-when').inputValue(),before.when);assert.equal(await page.getByTestId('tpo-place').inputValue(),before.place);assert.equal(await page.getByTestId('tpo-occasion').inputValue(),before.occasion);
  await page.locator('#edit-status').selectOption('DONE');await page.getByTestId('tpo-when').fill('');await page.getByTestId('tpo-place').selectOption('');await page.getByTestId('tpo-occasion').selectOption('');await page.getByTestId('save-edit').click();
  assert.match(await page.getByTestId('detail-place').innerText(),/남기지|기록하지|미기록/);await page.locator('[data-action="edit"]').click();assert.equal(await page.getByTestId('tpo-when').inputValue(),'');await page.keyboard.press('Escape');
 });
 await test('TPO stays with an offline record through sync and new-device restore',async()=>{
  await start('scenario=offline');await page.getByTestId('record-open').click();await page.getByTestId('title-search').fill('느린 빛');await page.getByTestId('search-result').click();
  await page.getByTestId('tpo-when').fill('2026-10-22T00:30');await page.getByTestId('tpo-place').selectOption('LIBRARY');await page.getByTestId('tpo-occasion').selectOption('ALONE');await page.getByTestId('save-DONE').click();await page.getByTestId('saved-done').click();await rows(7);
  await page.getByTestId('connectivity').click();await route('home');await page.getByTestId('sync-retry').click();await page.waitForFunction(()=>!document.querySelector('[data-testid="sync-retry"]'));
  await route('space');const code=await page.getByTestId('own-code').innerText();await page.getByTestId('scenario').selectOption('new-device');await route('space');await page.getByTestId('connect-entry').click();await page.getByTestId('connection-code').fill(code);await page.getByTestId('connect-submit').click();await page.getByTestId('connected-done').click();await rows(7);
  await page.getByTestId('record-search').fill('느린 빛');await rows(1);await page.locator('.timeline-row .title-link').click();await page.waitForFunction(()=>document.body.dataset.route.startsWith('title/'));
  assert.match(await page.getByTestId('detail-place').innerText(),/도서관/);assert.match(await page.getByTestId('detail-occasion').innerText(),/혼자/);
  await page.locator('[data-action="edit"]').click();assert.equal(await page.getByTestId('tpo-when').inputValue(),'2026-10-22T00:30');await page.keyboard.press('Escape');
 });
 await test('TPO layouts fit both languages and the short mobile recording sheet',async()=>{
  for(const variant of ['archive'])for(const lang of ['ko','en']) {
   await page.setViewportSize({width:320,height:844});await start(`variant=${variant}&lang=${lang}&theme=dark`);
   for(const name of ['records','title/record-quiet','title/record-forest']) {
    await route(name);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    if(name==='records') {
     const positions=await page.locator('.timeline-row .timeline-content').evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().x));
     assert.ok(positions.every(x=>Math.abs(x-positions[0])<1),'missing TPO must not shift the record content column');
    }
    await page.screenshot({path:`${output}/tpo-${variant}-${lang}-${name.replaceAll('/','-')}.png`,fullPage:true});
   }
   await page.setViewportSize({width:320,height:500});await page.getByTestId('record-open-mobile').click();await page.getByTestId('search-result').first().click();
   assert.equal(await page.evaluate(()=>document.activeElement.id),'dialog-title','date picker should wait for an explicit tap');
   for(const field of ['tpo-when','tpo-place','tpo-occasion']) {
    const control=page.getByTestId(field);await control.scrollIntoViewIfNeeded();
    const bounds=await control.boundingBox(),footer=await page.locator('.dialog-foot').boundingBox();
    assert.ok(bounds.y+bounds.height<=footer.y+1,`${field} should not be covered by sticky actions`);
   }
   const save=await page.getByTestId('save-DONE').boundingBox();assert.ok(save.y>=0&&save.y+save.height<=500,'save stays visible above bottom edge');
   assert.equal(await page.locator('dialog').evaluate(dialog=>dialog.scrollWidth>dialog.clientWidth+1),false);
   await page.keyboard.press('Escape');
  }
  await page.setViewportSize({width:1440,height:1000});
 });
 await test('First record, optional note, locale preservation and filtering',async()=>{
  await start('scenario=new');await page.getByTestId('first-record').click();
  await page.getByTestId('title-search').fill('바다가');await page.getByTestId('search-result').click();await page.getByTestId('save-IN_PROGRESS').click();
  assert.match(await page.locator('#dialog').innerText(),/서버 동기화 완료/);
  await page.locator('[data-action="edit-saved"]').click();await page.getByTestId('note-input').fill('내가 직접 남긴 문장');await page.getByTestId('save-edit').click();
  await route('records');await page.getByTestId('record-search').fill('내가 직접');assert.equal(await page.locator('.timeline-row').count(),1);
  await page.getByTestId('language').click();assert.match(await page.locator('main').innerText(),/내가 직접 남긴 문장/);
 });
 await test('Invalid connection code and new-device restore',async()=>{
  await start('scenario=new-device');await route('space');await page.getByTestId('connect-entry').click();await page.getByTestId('connection-code').fill('111');await page.getByTestId('connect-submit').click();assert.match(await page.locator('#dialog').innerText(),/8자리/);
  await page.getByTestId('connection-code').fill('m7k2 p9wx');await page.getByTestId('connect-submit').click();await page.getByTestId('connected-done').waitFor();await page.getByTestId('connected-done').click();await rows(3);
 });
 await test('Displayed code restores newly synced records on a simulated new device',async()=>{
  await start('scenario=new');await route('space');assert.doesNotMatch(await page.locator('main').innerText(),/현재 연결됨/);
  await page.getByTestId('record-open').click();await page.getByTestId('title-search').fill('겨울 도서관');await page.getByTestId('search-result').click();await page.getByTestId('save-DONE').click();await page.getByTestId('saved-done').click();await route('space');
  const code=await page.getByTestId('own-code').innerText();await page.getByTestId('scenario').selectOption('new-device');await route('space');await page.getByTestId('connect-entry').click();await page.getByTestId('connection-code').fill(code);await page.getByTestId('connect-submit').click();await page.getByTestId('connected-done').click();await rows(1);assert.match(await page.locator('main').innerText(),/겨울 도서관/);
 });
 await test('Korean composition retains the search input DOM',async()=>{
  await start();await route('records');const stable=await page.getByTestId('record-search').evaluate(input=>{
   input.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));input.value='바';input.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true,data:'바'}));
   const same=document.querySelector('[data-testid="record-search"]')===input;
   input.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'바'}));return same;
  });assert.equal(stable,true);assert.equal(await page.getByTestId('record-search').inputValue(),'바');
 });
 await test('Profile nickname stays private and renders as text',async()=>{
  await start();await page.getByTestId('profile-open').click();await page.getByTestId('nickname-input').fill('<b>나의 기록</b>');await page.getByTestId('save-profile').click();await route('space');assert.match(await page.locator('main').innerText(),/<b>나의 기록<\/b>/);assert.equal(await page.locator('main b').filter({hasText:'나의 기록'}).count(),0);await route('together');assert.doesNotMatch(await page.locator('main').innerText(),/<b>나의 기록<\/b>/);
 });
 await test('Existing records require explicit merge confirmation',async()=>{
  await start();await connect();assert.match(await page.locator('#dialog').innerText(),/이전 연결 코드/);assert.match(await page.locator('#dialog').innerText(),/예전 내용.*사라질/);
  await page.getByTestId('confirm-merge').click();await page.getByTestId('connected-done').waitFor();await page.getByTestId('connected-done').click();await rows(8);assert.match(await page.locator('main').innerText(),/처음엔 놓쳤던/);
 });
 await test('Sync failure blocks merge until retry succeeds',async()=>{
  await start('scenario=sync-error');await connect();assert.equal(await page.getByTestId('confirm-merge').count(),0);await page.getByTestId('sync-before-merge').click();await page.getByTestId('confirm-merge').waitFor();await page.keyboard.press('Escape');
 });
 await test('Restore failure remains recoverable after closing the dialog',async()=>{
  await start('scenario=restore-error');await connect();await page.getByTestId('restore-retry').waitFor();await page.keyboard.press('Escape');await route('space');await page.getByTestId('resume-restore').click();await page.getByTestId('connected-done').waitFor();await page.getByTestId('connected-done').click();await rows(3);
 });
 await test('Offline save survives reconnect and sync',async()=>{
  await start('scenario=offline');await page.getByTestId('record-open').click();await page.getByTestId('title-search').fill('느린 빛');await page.getByTestId('search-result').click();await page.getByTestId('save-DONE').click();assert.match(await page.locator('#dialog').innerText(),/이 기기에 저장됨/);await page.getByTestId('saved-done').click();
  await rows(7);await page.getByTestId('connectivity').click();await route('home');await page.getByTestId('sync-retry').click();await page.waitForFunction(()=>!document.querySelector('[data-testid="sync-retry"]'));await route('records');await rows(7);assert.equal(await page.locator('main .is-pending').count(),0);
 });
 await test('Private record needs confirmation before publishing',async()=>{
  await start();await route('title/record-quiet');await page.locator('[data-action="publish"]').click();assert.equal(await page.locator('[data-action="confirm-publish"]').count(),1);await page.locator('[data-action="confirm-publish"]').click();await page.waitForFunction(()=>document.body.dataset.route==='together');assert.equal(await page.locator('.community-card').count(),4);
 });
 await test('Records without notes stay complete and never acquire a fabricated public quote',async()=>{
  for(const lang of ['ko','en']) {
   await start(`scenario=new&lang=${lang}`);await page.getByTestId('first-record').click();
   await page.locator('[data-testid="search-result"][data-id="quiet-days"]').click();await page.getByTestId('save-DONE').click();await page.getByTestId('saved-done').click();await rows(1);
   assert.doesNotMatch(await page.locator('.timeline-row').innerText(),/메모가 없|남긴 메모|No note yet|Kept with the date|여백으로/);
   await page.locator('.timeline-row .title-link').click();await page.waitForFunction(()=>document.body.dataset.route.startsWith('title/'));
   const detailRoute=await page.evaluate(()=>document.body.dataset.route);
   await page.locator('[data-action="publish"]').click();assert.equal(await page.locator('#dialog blockquote').count(),0);
   await page.getByTestId('confirm-publish').click();await page.waitForFunction(()=>document.body.dataset.route==='together');
   assert.equal(await page.locator('.community-card').first().locator('blockquote').count(),0);
   await page.screenshot({path:`${output}/archive-${lang}-shared-without-note.png`});
   await route(detailRoute);await page.locator('[data-action="edit"]').click();assert.equal(await page.getByTestId('note-input').inputValue(),'');await page.keyboard.press('Escape');
  }
 });
 await test('Offline publication asks for reconnection instead of reporting success',async()=>{
  await start('scenario=offline');await route('title/record-quiet');await page.locator('[data-action="publish"]').click();const confirm=page.locator('[data-action="confirm-publish"]');if(await confirm.count() && await confirm.isEnabled())await confirm.click();assert.match(await page.locator('#dialog').innerText(),/오프라인|연결/);await page.keyboard.press('Escape');await route('together');assert.equal(await page.locator('.community-card').count(),3);
 });
 await test('Recovery image and report exports produce PNG files',async()=>{
  await start();await route('space');let download=page.waitForEvent('download');await page.locator('[data-action="download-code"]').click();const card=await download;assert.match(card.suggestedFilename(),/recovery-card\.png$/);await card.saveAs(`${output}/recovery-card.png`);
  await route('report');download=page.waitForEvent('download');await page.locator('[data-action="download-report"]').click();const report=await download;assert.match(report.suggestedFilename(),/report\.png$/);await report.saveAs(`${output}/report-card.png`);
 });
 await test('Korean bookshelf order and English navigation',async()=>{
  await start();await route('shelf');assert.deepEqual(await page.locator('.shelf-number').allTextContents(),['0','1','2','3','4','5','6','7','8','9']);await page.getByTestId('language').click();await route('records');assert.equal(await page.locator('a[href="#shelf"]').count(),0);
 });
 await test('Keyboard skip link, modal focus and Escape',async()=>{
  await start();await route('records');await page.locator('.skip-link').focus();await page.keyboard.press('Enter');assert.equal(new URL(page.url()).hash,'#records');assert.equal(await page.evaluate(()=>document.activeElement.id),'main');
  await page.getByTestId('record-open').click();for(let i=0;i<12;i++)await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>!!document.activeElement.closest('dialog')),true);await page.keyboard.press('Escape');assert.equal(await page.locator('dialog[open]').count(),0);
 });
 await test('Deep-link capture opens prefilled recording flow',async()=>{await start('quick=1&capture_title=Blue%20Hour&lang=en');assert.equal(await page.getByTestId('title-search').inputValue(),'Blue Hour');assert.equal(await page.getByTestId('search-result').count(),1)});
 assert.deepEqual(issues,[],'Browser console/network errors');
 assert.ok(results.length,'No checks matched');
 await writeFile(`${output}/${match?'focused-results':'results'}.json`,JSON.stringify({base,passed:results,issues},null,2));
 console.log(`${results.length} checks passed; screenshots: ${output}`);
} finally {await browser.close();}
