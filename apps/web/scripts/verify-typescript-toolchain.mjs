import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const webDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const rootDir = resolve(webDir, "../..");
const requireWeb = createRequire(resolve(webDir, "package.json"));
const requireNative = createRequire(
  resolve(rootDir, "apps/native/package.json"),
);
const { getTypeScriptPackageInfo } = requireWeb(
  "next/dist/lib/typescript/runTypeScriptCli",
);
const compiler = getTypeScriptPackageInfo(webDir);

// Exercise the same CLI integration used by next build in an isolated project.
if (process.argv[2] === "--fixture") {
  const { verifyAndRunTypeScript } = requireWeb(
    "next/dist/lib/verify-typescript-setup",
  );
  const result = await verifyAndRunTypeScript({
    dir: webDir,
    distDir: ".next",
    cacheDir: resolve(dirname(process.argv[3]), "cache"),
    tsconfigPath: relative(webDir, process.argv[3]),
    shouldRunTypeCheck: true,
    hasAppDir: true,
    hasPagesDir: false,
    appDir: resolve(webDir, "app"),
    useTypeScriptCli: true,
  });
  console.log(
    JSON.stringify({ version: result.version, mode: result.typeCheckMode }),
  );
  process.exit(0);
}

assert.match(compiler.version, /^7\./);
assert.ok(compiler.tscPath);
assert.equal(compiler.apiPath, undefined);
const webVersion = spawnSync(
  process.execPath,
  [compiler.tscPath, "--version"],
  {
    cwd: webDir,
    encoding: "utf8",
  },
);
assert.equal(webVersion.status, 0, webVersion.stderr);
assert.match(
  webVersion.stdout,
  new RegExp(compiler.version.replaceAll(".", "\\.")),
);

const nativePackagePath = requireNative.resolve("typescript/package.json");
const nativePackage = requireNative(nativePackagePath);
assert.match(nativePackage.version, /^5\.9\./);
for (const [workspace, expected] of [
  ["ott", compiler.version],
  ["native", nativePackage.version],
]) {
  const invoked = spawnSync(
    "npm",
    ["exec", "--workspace", workspace, "--no", "--", "tsc", "--version"],
    {
      cwd: rootDir,
      encoding: "utf8",
    },
  );
  assert.equal(invoked.status, 0, invoked.stderr);
  assert.equal(
    invoked.stdout.trim(),
    `Version ${expected}`,
    `${workspace} selects its own compiler`,
  );
}

const settings = JSON.parse(
  await readFile(resolve(rootDir, ".vscode/settings.json"), "utf8"),
);
const editorPath = resolve(
  rootDir,
  settings["typescript.tsdk"],
  "typescript.js",
);
assert.equal(
  editorPath,
  resolve(dirname(nativePackagePath), "lib/typescript.js"),
);
const ts = requireWeb(editorPath);
assert.equal(typeof ts.createLanguageService, "function");

const config = await requireWeb("next/dist/server/config").default(
  requireWeb("next/constants").PHASE_PRODUCTION_BUILD,
  webDir,
);
assert.equal(config.experimental.useTypeScriptCli, true);
assert.equal(config.typescript.ignoreBuildErrors, false);

const fixtureDir = await mkdtemp(resolve(tmpdir(), "ott-typescript-"));
let languageService;
try {
  const fixtureConfig = resolve(fixtureDir, "tsconfig.json");
  const fixtureFile = resolve(fixtureDir, "fixture.ts");
  await writeFile(
    fixtureConfig,
    JSON.stringify({
      compilerOptions: {
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        types: [],
        target: "ES2022",
        module: "esnext",
        moduleResolution: "bundler",
      },
      files: [fixtureFile],
    }),
  );
  function checkFixture() {
    return spawnSync(
      process.execPath,
      [fileURLToPath(import.meta.url), "--fixture", fixtureConfig],
      {
        cwd: webDir,
        encoding: "utf8",
        timeout: 30_000,
      },
    );
  }
  await writeFile(fixtureFile, "export const value: string = 123;\n");
  const invalid = checkFixture();
  assert.equal(invalid.status, 1, invalid.stderr);
  assert.match(
    invalid.stdout + invalid.stderr,
    /TS2322|not assignable to type/,
  );
  await writeFile(fixtureFile, 'export const value: string = "valid";\n');
  const valid = checkFixture();
  assert.equal(valid.status, 0, valid.stdout + valid.stderr);
  assert.deepEqual(JSON.parse(valid.stdout.trim().split("\n").at(-1)), {
    version: compiler.version,
    mode: "typescript-cli",
  });

  const pageFile = resolve(fixtureDir, "app/page.tsx");
  await mkdir(dirname(pageFile));
  await writeFile(
    pageFile,
    "export const invalidPageExport = 1;\nexport default function Page() { return null; }\n",
  );
  let revision = 0;
  const options = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    types: [],
    strict: true,
  };
  const host = {
    getScriptFileNames: () => [pageFile],
    getScriptVersion: () => String(revision),
    getScriptSnapshot: (file) => {
      const source = ts.sys.readFile(file);
      return source === undefined
        ? undefined
        : ts.ScriptSnapshot.fromString(source);
    },
    getCurrentDirectory: () => fixtureDir,
    getCompilationSettings: () => options,
    getDefaultLibFileName: (settings) => ts.getDefaultLibFilePath(settings),
    fileExists: ts.sys.fileExists,
    readFile: ts.sys.readFile,
    readDirectory: ts.sys.readDirectory,
  };
  languageService = ts.createLanguageService(host);
  const plugin = requireWeb("next/dist/server/typescript")
    .createTSPlugin({ typescript: ts })
    .create({
      languageService,
      languageServiceHost: host,
      config: {},
      project: {
        getCurrentDirectory: () => fixtureDir,
        projectService: { logger: { info() {} } },
      },
    });
  const invalidDiagnostics = plugin.getSemanticDiagnostics(pageFile);
  assert.ok(
    invalidDiagnostics.some((diagnostic) => diagnostic.code === 71002),
    "Next.js editor plugin rejects invalid page exports",
  );
  await writeFile(
    pageFile,
    'export const dynamic = "force-dynamic";\nexport default function Page() { return null; }\n',
  );
  revision++;
  assert.deepEqual(plugin.getSemanticDiagnostics(pageFile), []);
  console.log(
    `PASS: Next.js CLI ${compiler.version} rejects type errors; native CLI and Next.js editor plugin use ${nativePackage.version}`,
  );
} finally {
  languageService?.dispose();
  await rm(fixtureDir, { recursive: true, force: true });
}
