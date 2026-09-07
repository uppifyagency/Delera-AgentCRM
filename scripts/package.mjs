// Share source and instructions only; never export a used working directory wholesale.
import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = resolve(process.argv[2] ?? join(dirname(root), `Delera-AgentCRM-clean-${Date.now()}`));
if (target === root || !relative(root, target).startsWith('..')) throw Error('Export destination must be outside this bundle.');
if (existsSync(target)) throw Error('Destination exists; choose a fresh destination.');
const allowed = ['START_HERE.md','README.md','README.it.md','CONTRIBUTING.md','SECURITY.md','AGENTS.md','CLAUDE.md','PACKAGE-INFO.json','.gitignore','.vercelignore','vercel.json','package.json','package-lock.json','tsconfig.json','src','test','scripts','docs','examples','assets',...['index.html','styles.css','app.js','build.mjs','serve.mjs','test.mjs','site.config.json'].map(name=>`website/${name}`)];
const files = [];
function inventory(path) {
  const stat = lstatSync(path);
  if (stat.isSymbolicLink()) throw Error('Symlink forbidden in distributable source');
  if (stat.isDirectory()) { for (const name of readdirSync(path)) inventory(join(path, name)); return; }
  const rel = relative(root, path).replaceAll('\\', '/');
  if (!/\.(?:md|json|ts|mjs|js|svg|html|css)$/.test(rel) && !['.gitignore','.vercelignore'].includes(rel)) throw Error(`Unexpected distributable file: ${rel}`);
  const content = readFileSync(path, 'utf8');
  if (/-----BEGIN [A-Z ]*PRIVATE KEY-----|(?:access_token|refresh_token|client_secret)\s*["']?\s*:\s*["'][^"']{24,}/.test(content)) throw Error(`Possible credential in ${rel}; export stopped`);
  files.push(rel);
}
for (const name of allowed) inventory(join(root, name));
mkdirSync(target, { mode: 0o755 });
for (const name of allowed) { mkdirSync(dirname(join(target,name)),{recursive:true}); cpSync(join(root, name), join(target, name), { recursive: true, errorOnExist: true, force: false }); }
const checksums = Object.fromEntries(files.sort().map(name => [name, createHash('sha256').update(readFileSync(join(target, name))).digest('hex')]));
writeFileSync(join(target, 'CHECKSUMS.json'), JSON.stringify(checksums, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ created: target, files: files.length, personalRuntimeIncluded: false, warning: 'Review custom edits for personal content before sharing.' }, null, 2));
