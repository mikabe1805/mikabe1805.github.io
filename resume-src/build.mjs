// Renders resume-src/resume.html to a one-page, text-selectable Letter PDF.
//
//   node resume-src/build.mjs                                  -> Mika-Be_Resume.pdf
//   node resume-src/build.mjs --focus simulation --out out.pdf -> simulation-first variant
//
// Needs Playwright with Chromium (npm i -g playwright, or a local install).
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};

const focus = option("focus", "");
const out = resolve(option("out", join(here, "..", "Mika-Be_Resume.pdf")));

let playwright;
try {
  playwright = await import("playwright");
} catch {
  const globalRoot = execSync("npm root -g").toString().trim();
  playwright = createRequire(join(globalRoot, "noop.js"))("playwright");
}

const browser = await playwright.chromium.launch();
// Lay out at the printable width (8.5in minus 0.5in side margins) so the
// one-page check below measures the same line breaks as the PDF.
const page = await browser.newPage({ viewport: { width: 720, height: 1000 } });
const url = pathToFileURL(join(here, "resume.html"));
if (focus) url.searchParams.set("focus", focus);
await page.goto(url.href);
await page.evaluate(() => document.fonts.ready);
await page.emulateMedia({ media: "print" });

const pages = await page.evaluate(() => {
  const inch = 96;
  const printable = (11 - 0.46 - 0.4) * inch;
  return Math.ceil(document.querySelector(".page").scrollHeight / printable);
});
if (pages > 1) {
  console.warn(`Warning: content is taller than one page (${pages} pages).`);
}

await page.pdf({ path: out, preferCSSPageSize: true, printBackground: true });
await browser.close();
console.log(`Wrote ${out}`);
