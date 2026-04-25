#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function usage() {
  console.error('Usage: npm run search:node -- "pattern" [path...]');
  console.error('  SEARCH_RE=1 enables JS RegExp search (default: plain substring)');
  console.error('  SEARCH_I=1 enables case-insensitive search');
  process.exit(2);
}

const args = process.argv.slice(2);
if (args.length < 1) usage();

const patternRaw = args[0];
const roots = args.slice(1);
const useRegex = process.env.SEARCH_RE === '1';
const ignoreCase = process.env.SEARCH_I === '1';

let matcher;
if (useRegex) {
  let re;
  try {
    re = new RegExp(patternRaw, ignoreCase ? 'i' : undefined);
  } catch (e) {
    console.error(`Invalid RegExp: ${patternRaw}`);
    console.error(String(e?.message ?? e));
    process.exit(2);
  }
  matcher = (line) => re.test(line);
} else {
  const needle = ignoreCase ? patternRaw.toLowerCase() : patternRaw;
  matcher = (line) => {
    if (!ignoreCase) return line.includes(needle);
    return line.toLowerCase().includes(needle);
  };
}

const SKIP_DIRS = new Set(['node_modules', '.git', '.cache', 'dist', 'build']);

function isProbablyBinary(buf) {
  // crude: if NUL appears early, treat as binary
  const n = Math.min(buf.length, 8000);
  for (let i = 0; i < n; i++) if (buf[i] === 0) return true;
  return false;
}

function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }

  for (const ent of entries) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (SKIP_DIRS.has(ent.name)) continue;
      walk(p, out);
    } else if (ent.isFile()) {
      out.push(p);
    }
  }
  return out;
}

let searchRoots = roots.length ? roots : ['src', 'site', 'scripts'];

let files = [];
for (const r of searchRoots) {
  try {
    const st = fs.statSync(r);
    files.push(...(st.isFile() ? [r] : walk(r)));
  } catch {
    // ignore missing roots
  }
}

let hits = 0;

// If output is being piped (e.g. to `head`), ignore EPIPE so we exit cleanly.
process.stdout.on('error', (err) => {
  if (err && err.code === 'EPIPE') process.exit(0);
  throw err;
});

for (const file of files) {
  let buf;
  try {
    buf = fs.readFileSync(file);
  } catch {
    continue;
  }

  if (isProbablyBinary(buf)) continue;

  const text = buf.toString('utf8');
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (matcher(line)) {
      hits++;
      process.stdout.write(`${file}:${i + 1}:${line}\n`);
    }
  }
}

process.exitCode = hits ? 0 : 1;
