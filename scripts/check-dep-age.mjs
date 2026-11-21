// Fails when any package in package-lock.json was published less than
// MIN_AGE_DAYS ago. This is the project's supply chain rule: no external code
// newer than two weeks. See README.md, "Dependency age rule".
//
// Usage: node scripts/check-dep-age.mjs [--json]
//
// It uses only Node built-ins, so it runs before anything is installed.
// Publish dates never change, so a version that has passed is remembered in
// CACHE_FILE and is not looked up again.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MIN_AGE_DAYS = 14;

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LOCK_FILE = resolve(ROOT, 'package-lock.json');
const CACHE_FILE = resolve(ROOT, '.dep-age-cache.json');
const REGISTRY = 'https://registry.npmjs.org';
const DAY_MS = 24 * 60 * 60 * 1000;
const CONCURRENCY = 12;

/** Every registry package in the lockfile as { name, version }, without duplicates. */
function lockedPackages() {
  const lock = JSON.parse(readFileSync(LOCK_FILE, 'utf8'));
  if (lock.lockfileVersion < 2 || !lock.packages) {
    throw new Error('package-lock.json must be lockfileVersion 2 or 3.');
  }
  const seen = new Map();
  const problems = [];
  for (const [path, entry] of Object.entries(lock.packages)) {
    if (path === '' || entry.link) continue;
    const name = entry.name ?? path.slice(path.lastIndexOf('node_modules/') + 'node_modules/'.length);
    const resolved = entry.resolved ?? '';
    // Anything that does not come from the npm registry has no publish date
    // we can check, so it is not allowed.
    if (resolved && !resolved.startsWith(`${REGISTRY}/`)) {
      problems.push(`${name}@${entry.version} comes from ${resolved}, not the npm registry.`);
      continue;
    }
    seen.set(`${name}@${entry.version}`, { name, version: entry.version });
  }
  return { packages: [...seen.values()], problems };
}

function readCache() {
  try {
    const cache = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
    return cache && typeof cache === 'object' ? cache : {};
  } catch {
    return {};
  }
}

async function publishTime(name, version) {
  const res = await fetch(`${REGISTRY}/${name.replace('/', '%2f')}`, {
    headers: { accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`registry answered ${res.status}`);
  const meta = await res.json();
  const time = meta.time?.[version];
  if (!time) throw new Error('the registry has no publish date for this version');
  return time;
}

async function main() {
  const asJson = process.argv.includes('--json');
  const { packages, problems } = lockedPackages();
  const cache = readCache();
  const now = Date.now();
  const tooNew = [];
  const failed = [];

  const todo = packages.filter((p) => !cache[`${p.name}@${p.version}`]);
  let next = 0;
  const times = new Map();
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, todo.length) }, async () => {
      while (next < todo.length) {
        const p = todo[next++];
        try {
          times.set(`${p.name}@${p.version}`, await publishTime(p.name, p.version));
        } catch (err) {
          failed.push(`${p.name}@${p.version}: ${err.message}`);
        }
      }
    }),
  );

  for (const p of packages) {
    const key = `${p.name}@${p.version}`;
    const time = cache[key] ?? times.get(key);
    if (!time) continue;
    const ageDays = (now - Date.parse(time)) / DAY_MS;
    if (ageDays >= MIN_AGE_DAYS) {
      // Only passing versions are cached. Their age can only grow.
      cache[key] = time;
    } else {
      const allowedOn = new Date(Date.parse(time) + MIN_AGE_DAYS * DAY_MS).toISOString().slice(0, 10);
      tooNew.push({ name: p.name, version: p.version, published: time.slice(0, 10), ageDays: Math.floor(ageDays), allowedOn });
    }
  }

  try {
    mkdirSync(dirname(CACHE_FILE), { recursive: true });
    writeFileSync(CACHE_FILE, `${JSON.stringify(cache, Object.keys(cache).sort(), 1)}\n`);
  } catch {
    // The cache only saves time. The check does not depend on it.
  }

  tooNew.sort((a, b) => a.ageDays - b.ageDays);
  if (asJson) {
    console.log(JSON.stringify({ minAgeDays: MIN_AGE_DAYS, checked: packages.length, tooNew, failed, problems }, null, 2));
  } else {
    console.log(`Checked ${packages.length} locked packages against the ${MIN_AGE_DAYS} day rule.`);
    for (const t of tooNew) {
      console.log(`  too new: ${t.name}@${t.version}, published ${t.published} (${t.ageDays} days ago), allowed from ${t.allowedOn}`);
    }
    for (const f of failed) console.log(`  could not check: ${f}`);
    for (const p of problems) console.log(`  not allowed: ${p}`);
  }

  if (tooNew.length || failed.length || problems.length) {
    if (!asJson) {
      console.log(
        `\nFailed. ${tooNew.length} too new, ${failed.length} could not be checked, ${problems.length} not from the registry.`,
      );
    }
    process.exit(1);
  }
  if (!asJson) console.log('All locked packages are old enough.');
}

main().catch((err) => {
  console.error(`check-dep-age failed: ${err.message}`);
  process.exit(1);
});
