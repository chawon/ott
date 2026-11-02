import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const option = key => process.argv[process.argv.indexOf(key) + 1];
const modulePath = process.argv.includes('--playwright') ? option('--playwright') : 'playwright';
const { chromium } = await import(modulePath);
const base = process.env.PREVIEW_URL || 'http://127.0.0.1:4173';
const output = fileURLToPath(new URL('./qa-output/', import.meta.url));
await mkdir(output, {recursive:true});
const browser = await chromium.launch({headless:true, args:['--no-sandbox'], ...(process.argv.includes('--browser') ? {executablePath:option('--browser')} : {})});
const results=[];
const issues=[];
const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});
page.on('pageerror', e=>issues.push(e.message));
page.on('request', r=>{if(!r.url().startsWith(base)&&!r.url().startsWith('blob:')&&!r.url().startsWith('data:'))issues.push(`Unexpected external request: ${r.url()}`)});
page.on('response', r=>{if(r.status()>=400)issues.push(`HTTP ${r.status()}: ${r.url()}`)});
const test=async(name, fn)=>{await fn();results.push(name);console.log(`PASS ${name}`)};
const start=async(query='')=>{await page.goto(`${base}/?${query}`);await page.locator('h1').waitFor();await page.evaluate(()=>document.fonts.ready)};
const route=async(name)=>{await page.evaluate(name=>{location.hash=name},name);await page.waitForFunction(name=>document.body.dataset.route===name,name)};
const rows=async(count)=>{await page.waitForFunction(n=>document.querySelectorAll('.timeline-row').length===n,count);assert.equal(await page.locator('.timeline-row').count(),count)};
const connect=async()=>{await route('space');await page.getByTestId('connect-entry').click();await page.getByTestId('connection-code').fill('m7k2 p9wx');await page.getByTestId('connect-submit').click()};
try {
 await test('Both visual directions, locales, themes and mobile layouts',async()=>{
  for(const variant of ['archive','journal']) for(const lang of ['ko','en']) for(const theme of ['light','dark']) {
   await start(`variant=${variant}&lang=${lang}&theme=${theme}`);
   for(const width of [1440,390,320]) {
    await page.setViewportSize({width,height:width===1440?1000:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${variant}/${lang}/${theme}/${width} overflow`);
    assert.equal(await page.locator('h1').count(),1);
    assert.equal(await page.evaluate(()=>document.documentElement.lang),lang);
    await page.locator('img').evaluateAll(images=>Promise.all(images.map(img=>img.decode().catch(()=>{}))));
    assert.equal(await page.locator('img').evaluateAll(images=>images.some(img=>!img.naturalWidth)),false,'broken image');
    if(width!==320)await page.screenshot({path:`${output}/${variant}-${lang}-${theme}-${width}.png`,fullPage:true});
   }
  }
  await page.setViewportSize({width:1440,height:1000});
 });
 await test('Every product route and recording dialog fits a mobile viewport',async()=>{
  await page.setViewportSize({width:390,height:844});
  for(const variant of ['archive','journal'])for(const lang of ['ko','en']) {
   await start(`variant=${variant}&lang=${lang}&theme=dark`);
   for(const name of ['records','together','space','report','title/record-quiet',...(lang==='ko'?['shelf']:[])]) {
    await route(name);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${variant}/${lang}/${name} overflow`);
   }
   await page.getByTestId('record-open-mobile').click();await page.getByTestId('search-result').first().click();assert.equal(await page.locator('dialog').evaluate(dialog=>dialog.scrollWidth>dialog.clientWidth+1),false,'dialog overflow');await page.keyboard.press('Escape');
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
  await start();await connect();assert.match(await page.locator('#dialog').innerText(),/이전 연결 코드/);assert.match(await page.locator('#dialog').innerText(),/덮어써질/);
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
 await writeFile(`${output}/results.json`,JSON.stringify({passed:results,issues},null,2));
 console.log(`${results.length} checks passed; screenshots: ${output}`);
} finally {await browser.close();}
