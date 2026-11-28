#!/usr/bin/env node
/**
 * Headless Chrome for Testing with a Playwright video.
 *
 * Run from this skill directory, after `npm install`:
 *   node scripts/record.mjs --url http://127.0.0.1:3000 --seconds 8 --out out
 *
 * Optional --actions file.json: [{ "goto"|"click"|"fill"|"press"|"wait": ... }]
 * Prints the video path as the last line: video: <path>
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  return process.argv[i + 1];
}

function chromeExecutable() {
  if (process.env.CHROME_FOR_TESTING) return process.env.CHROME_FOR_TESTING;
  const cache = process.env.CFT_CACHE || path.join(homedir(), '.cache', 'chrome-for-testing');
  mkdirSync(cache, { recursive: true });
  const out = execFileSync(
    'npx',
    ['--yes', '@puppeteer/browsers', 'install', 'chrome@stable', '--path', cache],
    { encoding: 'utf8' },
  );
  const line = out.trim().split('\n').filter(Boolean).at(-1) ?? '';
  const parsed = line.match(/^chrome@\S+\s+(.+)$/);
  if (parsed?.[1] && statSync(parsed[1], { throwIfNoEntry: false })?.isFile()) return parsed[1];
  const hits = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (name === 'Google Chrome for Testing') hits.push(full);
      else if (statSync(full).isDirectory() && name !== 'node_modules') walk(full);
    }
  };
  walk(cache);
  if (hits.length === 0) throw new Error(`Chrome for Testing not found under ${cache}`);
  return hits.sort().at(-1);
}

function loadActions(file) {
  if (!file) return null;
  const list = JSON.parse(readFileSync(path.resolve(file), 'utf8'));
  if (!Array.isArray(list)) throw new Error('--actions must be a JSON array');
  return list;
}

async function runActions(page, actions, fallbackUrl) {
  if (!actions) {
    await page.goto(fallbackUrl, { waitUntil: 'domcontentloaded' });
    return;
  }
  for (const step of actions) {
    if (step.goto) await page.goto(step.goto, { waitUntil: 'domcontentloaded' });
    else if (step.click) await page.click(step.click);
    else if (step.fill) await page.fill(step.fill, step.value ?? '');
    else if (step.press) await page.keyboard.press(step.press);
    else if (step.wait != null) await page.waitForTimeout(Number(step.wait));
    else throw new Error(`Unknown action: ${JSON.stringify(step)}`);
  }
}

const url = arg('url');
const actions = loadActions(arg('actions'));
if (!url && !actions?.some((step) => step.goto)) {
  console.error('Usage: node scripts/record.mjs --url <url> [--seconds 8] [--out out] [--actions file.json]');
  process.exit(1);
}

const seconds = Math.min(180, Math.max(0, Number(arg('seconds', '8')) || 0));
const width = Number(arg('width', '1280'));
const height = Number(arg('height', '720'));
const outDir = path.resolve(skillRoot, arg('out', 'out'));
mkdirSync(outDir, { recursive: true });

const executablePath = chromeExecutable();
const browser = await chromium.launch({
  executablePath,
  headless: true,
});
const context = await browser.newContext({
  viewport: { width, height },
  recordVideo: { dir: outDir, size: { width, height } },
});
const page = await context.newPage();
try {
  await runActions(page, actions, url);
  if (seconds > 0) await page.waitForTimeout(seconds * 1000);
} finally {
  const video = page.video();
  await context.close();
  await browser.close();
  const saved = video ? await video.path() : '';
  console.log(`chrome: ${executablePath}`);
  console.log(`video: ${saved}`);
}
