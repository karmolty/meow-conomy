#!/usr/bin/env node

// Lightweight environment sanity-checks.
// Intentionally dependency-free.

import process from 'node:process';
import { execFileSync } from 'node:child_process';

function parseMajor(v) {
  const m = String(v).match(/^(\d+)/);
  return m ? Number(m[1]) : null;
}

const node = process.versions.node;
const major = parseMajor(node);
const ok = major != null && major >= 22;

function has(cmd, args = ['--version']) {
  try {
    const out = execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString('utf8')
      .trim();
    return out || true;
  } catch {
    return null;
  }
}

const lines = [];
lines.push(`meow-conomy doctor`);
lines.push(`- node: ${node}${ok ? '' : '  (expected >= 22)'}`);
lines.push(`- platform: ${process.platform} (${process.arch})`);
lines.push(`- cwd: ${process.cwd()}`);

const npm = has('npm');
lines.push(`- npm: ${npm ?? 'not found (install Node/npm)'}`);
const python = has('python3', ['--version']) ?? has('python', ['--version']);
lines.push(`- python: ${python ?? 'not found (needed for npm run serve)'}`);

if (!ok) {
  lines.push('');
  lines.push('Your Node version is below the supported range for this repo.');
  lines.push('Fix: install Node 22+ (or use nvm) and re-run: npm run check');
}

process.stdout.write(lines.join('\n') + '\n');
process.exitCode = ok ? 0 : 1;
