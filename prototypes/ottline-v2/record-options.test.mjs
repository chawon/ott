import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {platformGroups} from './record-options.js';

const readSource = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const quickLog = readSource('apps/web/components/QuickLogCard.tsx');
const sourceSection = (start, end) => quickLog.slice(quickLog.indexOf(start), quickLog.indexOf(end));

// Read group structure and message keys from the real input, rather than keep
// a second handwritten list that could repeat an omission in the prototype.
function translatedGroups(source, locale) {
  const messages = JSON.parse(readSource(`apps/web/messages/${locale}.json`)).QuickLogCard;
  const groups = [...source.matchAll(/label:\s*(?:tQuick\("([^"]+)"\)|"([^"]+)"),\s*options:\s*\[([\s\S]*?)\],?\s*\}/g)];
  return groups.map(([, key, label, options]) => ({
    label: key ? messages[key] : label,
    options: [...options.matchAll(/tQuick\("([^"]+)"\)/g)].map(([, option]) => messages[option]),
  }));
}

for (const locale of ['ko', 'en']) {
  test(`${locale} movie and series platforms match every original QuickLog group`, () => {
    const expected = translatedGroups(sourceSection('const videoPlatformGroups', 'const bookPlatformGroups'), locale);
    assert.equal(expected.length, 4);
    assert.equal(expected.flatMap(group => group.options).length, 16);
    assert.deepEqual(platformGroups('movie', locale), expected);
    assert.deepEqual(platformGroups('series', locale), expected);
  });
}

test('Korean reading platforms match the original bookstore, ebook, and library choices', () => {
  const expected = translatedGroups(sourceSection('const bookPlatformGroups', 'const platformOptions'), 'ko');
  assert.equal(expected.length, 3);
  assert.equal(expected.flatMap(group => group.options).length, 11);
  assert.deepEqual(platformGroups('book', 'ko'), expected);
});

test('English reading platforms match the shared international presets', () => {
  const source = readSource('shared/bookPlatforms.ts');
  const expected = [...source.matchAll(/label:\s*"([^"]+)",\s*options:\s*\[([\s\S]*?)\],?\s*\}/g)]
    .map(([, label, options]) => ({label, options: [...options.matchAll(/"([^"]+)"/g)].map(([, value]) => value)}));
  assert.equal(expected.length, 4);
  assert.equal(expected.flatMap(group => group.options).length, 12);
  assert.deepEqual(platformGroups('book', 'en'), expected);
});
