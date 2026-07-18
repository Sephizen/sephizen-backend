import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(full));
    } else if (entry.isFile() && full.endsWith('.js')) {
      files.push(full);
    }
  }
  return files;
}

const root = process.cwd();
const files = walk(root);
let hasError = false;

for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    hasError = true;
    process.stdout.write(`\nSyntax error in ${file}\n`);
    process.stdout.write(result.stdout || '');
    process.stdout.write(result.stderr || '');
  }
}

if (hasError) {
  process.exit(1);
}

console.log(`Syntax check passed for ${files.length} JS files.`);
