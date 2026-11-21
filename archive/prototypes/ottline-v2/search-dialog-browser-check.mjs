import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Sample-only browser focus checks. Touch emulation does not exercise a real
// phone's software keyboard or its native IME.
const option = key => process.argv[process.argv.indexOf(key) + 1];
const { chromium } = await import(process.argv.includes('--playwright') ? option('--playwright') : 'playwright');
const base = process.env.PREVIEW_URL || 'http://127.0.0.1:4173';
const phase = process.argv.includes('--phase') ? option('--phase') : 'verification';
const output = fileURLToPath(new URL('./qa-output/search-dialog/', import.meta.url));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'], ...(process.argv.includes('--browser') ? { executablePath: option('--browser') } : {}) });
const passed = [], failures = [], observations = [], issues = [];
const check = async (name, fn) => {
  try { await fn(); passed.push(name); console.log(`PASS ${name}`); }
  catch (error) { failures.push({ name, message: error.message }); console.error(`FAIL ${name}: ${error.message}`); }
};
const snapshot = page => page.evaluate(() => {
  const input = document.querySelector('[data-testid="title-search"]');
  const active = document.activeElement;
  return { active: { tag: active?.tagName, id: active?.id, testid: active?.dataset.testid, action: active?.dataset.action, value: active?.dataset.value }, search: input?.value, selectionStart: input?.selectionStart, selectionEnd: input?.selectionEnd };
});
const open = async (page, lang = 'en') => {
  await page.goto(`${base}/?lang=${lang}`); await page.locator('h1:visible').waitFor();
  await page.locator('[data-testid="record-open"]:visible,[data-testid="record-open-mobile"]:visible').first().click();
  await page.getByTestId('title-search').waitFor();
  await page.locator('dialog[open]').evaluate(dialog => Promise.all(dialog.getAnimations().map(animation => animation.finished)));
};

try {
  for (const width of [1440, 390, 320]) {
    const touch = width < 1000;
    const context = await browser.newContext({ viewport: { width, height: touch ? 844 : 1000 }, hasTouch: touch, timezoneId: 'Asia/Seoul' });
    const page = await context.newPage();
    page.on('pageerror', error => issues.push(error.message));
    page.on('request', request => { if (!request.url().startsWith(base) && !/^(blob:|data:)/.test(request.url())) issues.push(`Unexpected external request: ${request.url()}`); });
    page.on('response', response => { if (response.status() >= 400) issues.push(`HTTP ${response.status()}: ${response.url()}`); });
    try {
      await check(`${width}: opening, consecutive typing and composition retain the search input`, async () => {
        await open(page);
        const input = page.getByTestId('title-search');
        const original = await input.elementHandle();
        assert.equal(await input.evaluate(element => document.activeElement === element), true, JSON.stringify(await snapshot(page)));
        for (const character of 'Blue') {
          await page.keyboard.type(character);
          assert.equal(await original.evaluate(element => element === document.querySelector('[data-testid="title-search"]')), true, 'typing must keep the input DOM node');
          assert.equal(await input.evaluate(element => document.activeElement === element), true, 'typing must keep focus');
        }
        assert.equal(await input.inputValue(), 'Blue');
        assert.equal(await page.getByTestId('search-result').count(), 1);
        await input.fill('');
        const composing = await input.evaluate(element => {
          const states = [];
          element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
          for (const value of ['바', '바다']) {
            element.value = value; element.setSelectionRange(value.length, value.length);
            element.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true, inputType: 'insertCompositionText', data: value }));
            states.push({ same: element === document.querySelector('[data-testid="title-search"]'), focused: document.activeElement === element, value: element.value });
          }
          element.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '바다' }));
          element.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: false, inputType: 'insertText', data: '바다' }));
          return states;
        });
        assert.deepEqual(composing, [{ same: true, focused: true, value: '바' }, { same: true, focused: true, value: '바다' }]);
        await page.keyboard.insertText('가'); assert.equal(await input.inputValue(), '바다가');
        assert.equal(await input.evaluate(element => document.activeElement === element), true);
        observations.push({ width, scenario: 'opening-and-input', ...await snapshot(page) });
      });

      await check(`${width}: search field and type chips have a visible gap`, async () => {
        await open(page);
        const search = await page.locator('dialog .search-field').boundingBox();
        const chips = await page.locator('dialog .filter-chips').boundingBox();
        const gap = chips.y - (search.y + search.height);
        observations.push({ width, scenario: 'spacing', gap });
        await page.screenshot({ path: `${output}/${phase}-${width}-search.png` });
        assert.ok(gap >= 12, `search→types gap=${gap}px; expected at least 12px`);
        assert.equal(await page.locator('dialog').evaluate(dialog => dialog.scrollWidth > dialog.clientWidth + 1), false);
      });

      await check(`${width}: input focus outline stays inside its search wrapper`, async () => {
        await open(page);
        const geometry = await page.getByTestId('title-search').evaluate(input => {
          const wrapper = input.closest('.search-field');
          const rect = node => { const b = node.getBoundingClientRect(); return {left:b.left,top:b.top,right:b.right,bottom:b.bottom,width:b.width,height:b.height}; };
          const style = node => { const s = getComputedStyle(node); return {outlineStyle:s.outlineStyle,outlineWidth:s.outlineWidth,outlineOffset:s.outlineOffset,outlineColor:s.outlineColor,boxShadow:s.boxShadow,borderColor:s.borderColor}; };
          const inputStyle = style(input), wrapperStyle = style(wrapper), bounds = rect(input), outer = rect(wrapper);
          const expansion = inputStyle.outlineStyle === 'none' ? 0 : parseFloat(inputStyle.outlineWidth) + parseFloat(inputStyle.outlineOffset);
          const overflow = {top:Math.max(0,outer.top-(bounds.top-expansion)),bottom:Math.max(0,bounds.bottom+expansion-outer.bottom),left:Math.max(0,outer.left-(bounds.left-expansion)),right:Math.max(0,bounds.right+expansion-outer.right)};
          return {active:document.activeElement===input,input:bounds,wrapper:outer,inputStyle,wrapperStyle,overflow};
        });
        observations.push({width,scenario:'focus-outline',...geometry});
        console.log(`OBSERVE ${width} focus outline ${JSON.stringify(geometry)}`);
        await page.screenshot({path:`${output}/${phase}-${width}-focus.png`});
        assert.equal(geometry.active,true,'search retains input focus');
        assert.ok(Object.values(geometry.overflow).every(value=>value<=0.5),`input outline escapes wrapper: ${JSON.stringify(geometry.overflow)}`);
        assert.ok(geometry.inputStyle.outlineStyle!=='none'||geometry.wrapperStyle.outlineStyle!=='none'||geometry.wrapperStyle.boxShadow!=='none'||geometry.wrapperStyle.borderColor==='rgb(255, 153, 51)','a visible focus indicator remains');
      });
    } finally { await context.close(); }
  }
  const capture = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Seoul' });
  try {
    const page = await capture.newPage();
    await open(page, 'ko'); await page.screenshot({path:`${output}/${phase}-390-ko-search.png`});
    await page.keyboard.press('Escape'); await page.evaluate(()=>{location.hash='records';});
    await page.getByTestId('record-search').waitFor(); await page.setViewportSize({width:1440,height:1000});
    await page.getByTestId('record-search').focus();
    observations.push({scenario:'shared-timeline-focus',active:await page.getByTestId('record-search').evaluate(input=>document.activeElement===input)});
    await page.screenshot({path:`${output}/${phase}-1440-ko-timeline-focus.png`});
  } finally { await capture.close(); }
  const report = { base, phase, passed, failures, observations, issues, limitation: 'Chromium focus, DOM and emulated touch only; no physical phone software-keyboard or native IME validation.' };
  await writeFile(`${output}/${phase}-results.json`, JSON.stringify(report, null, 2));
  assert.deepEqual(issues, [], 'Unexpected browser errors');
  assert.equal(failures.length, 0, `${failures.length} checks failed; evidence: ${output}/${phase}-results.json`);
  console.log(`${passed.length} search dialog checks passed; evidence: ${output}/${phase}-results.json`);
} finally { await browser.close(); }
