import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join, extname } from 'node:path';

const root = new URL('../', import.meta.url);
const basePath = decodeURIComponent(root.pathname).replace(/^\/(.:\/)/, '$1');

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes:true });
  const out = [];
  for (const entry of entries) {
    if (entry.name === 'node_modules') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(full));
    else out.push(full);
  }
  return out;
}

const jsFiles = (await walk(basePath)).filter((file) => ['.js','.mjs'].includes(extname(file)) && !file.endsWith('keys.local.js'));
for (const file of jsFiles) {
  const r = spawnSync(process.execPath, ['--check', file], { encoding:'utf8' });
  if (r.status !== 0) {
    console.error(`FAIL syntax: ${file}`);
    console.error(r.stderr || r.stdout);
    process.exit(1);
  }
}
console.log(`PASS syntax: ${jsFiles.length} JS/MJS files`);
