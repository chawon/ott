import { copyFile, mkdir, readdir } from "node:fs/promises";
import path from "node:path";

const distDir = path.resolve(process.cwd(), "dist");
const defaultLocale = process.env.AIT_DEFAULT_LOCALE || "ko";
const localeHtmlPath = path.join(distDir, `${defaultLocale}.html`);
const localeTxtPath = path.join(distDir, `${defaultLocale}.txt`);
const localeDir = path.join(distDir, defaultLocale);

async function copyDirectoryContents(sourceDir, targetDir) {
  const entries = await readdir(sourceDir, { withFileTypes: true });

  await mkdir(targetDir, { recursive: true });

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      await copyDirectoryContents(sourcePath, targetPath);
      continue;
    }

    if (!entry.isFile()) continue;

    await mkdir(path.dirname(targetPath), { recursive: true });
    await copyFile(sourcePath, targetPath);
  }
}

async function main() {
  await copyFile(localeHtmlPath, path.join(distDir, "index.html"));

  try {
    await copyFile(localeTxtPath, path.join(distDir, "index.txt"));
  } catch {
    // Keep going when the build does not emit a text payload for the root page.
  }

  await copyDirectoryContents(localeDir, distDir);
}

await main();
