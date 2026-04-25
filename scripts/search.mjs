#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function usage() {
  console.error('Usage: npm run search:node -- "pattern" [dir]');
  console.error('  SEARCH_RE=1 enables JS RegExp search (default: plain substring)');
  process.exit(2);
}

const args = process.argv.slice(2);
if (args.length < 1) usage();

const patternRaw = args[0];
const root = args[1] ?? '.';
const useRegex = process.env.SEARCH_RE === '1';

let matcher;
if (useRegex) {
  let re;
  try {
    re = new RegExp(patternRaw);
  } catch (e) {
    console.error(`Invalid RegExp: ${patternRaw}`);
    console.error(String(e?.message ?? e));
    process.exit(2);
  }
  matcher = (line) => re.test(line);
} else {
  matcher = (line) => line.includes(patternRaw);
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

const files = walk(root);
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
