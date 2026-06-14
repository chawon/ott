import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const args = new Set(process.argv.slice(2));
const allowPlaceholders = args.has('--allow-placeholders');
const appPath = path.resolve('app.json');
const easPath = path.resolve('eas.json');

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not read ${path.basename(filePath)}: ${message}`);
  }
}

function hasPlaceholder(value) {
  return typeof value === 'string' && value.includes('TODO');
}

function assertPresent(label, value, options = {}) {
  if (typeof value !== 'string' || !value.trim()) {
    if (allowPlaceholders && options.allowMissingDuringSetup) {
      return;
    }
    throw new Error(`Missing ${label}.`);
  }
  if (!allowPlaceholders && hasPlaceholder(value)) {
    throw new Error(`Replace placeholder ${label} before running TestFlight build.`);
  }
}

const app = readJson(appPath);
const eas = readJson(easPath);
const bundleIdentifier = app.expo?.ios?.bundleIdentifier;
const projectId = app.expo?.extra?.eas?.projectId;
const testflightBuild = eas.build?.testflight;
const productionBuild = eas.build?.production;
const testflightSubmit = eas.submit?.testflight?.ios;
const ascAppId = testflightSubmit?.ascAppId;

assertPresent('apps/native/app.json expo.ios.bundleIdentifier', bundleIdentifier);
assertPresent('apps/native/app.json expo.extra.eas.projectId', projectId, {
  allowMissingDuringSetup: true,
});
assertPresent('apps/native/eas.json submit.testflight.ios.ascAppId', ascAppId);

if (bundleIdentifier !== 'app.ottline') {
  throw new Error(`Unexpected iOS bundle identifier: ${bundleIdentifier}`);
}

if (testflightBuild?.distribution !== 'store') {
  throw new Error('apps/native/eas.json build.testflight.distribution must be "store".');
}

if (testflightBuild?.autoIncrement !== true) {
  throw new Error('apps/native/eas.json build.testflight.autoIncrement must be true.');
}

if (productionBuild?.distribution !== 'store') {
  throw new Error('apps/native/eas.json build.production.distribution must be "store".');
}

if (productionBuild?.autoIncrement !== true) {
  throw new Error('apps/native/eas.json build.production.autoIncrement must be true.');
}

console.log('Native TestFlight configuration check passed.');
