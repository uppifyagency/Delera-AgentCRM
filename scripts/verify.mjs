import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const temp = mkdtempSync(join(realpathSync(tmpdir()), 'agentcrm-portability-'));
const env = { ...process.env }; delete env.DELERA_AGENTCRM_HOME; delete env.DELERA_CRM_CODEX_HOME;
function run(cwd, executable, args) {
  const result = spawnSync(executable, args, { cwd, env, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout || result.error?.message);
  return result.stdout;
}
try {
  const clean = join(temp, 'Recipient folder with spaces');
  run(root, process.execPath, ['scripts/package.mjs', clean]);
  // Exercise the actual first-start launcher, including install and compilation.
  run(clean, process.execPath, ['scripts/start.mjs']);
  const cli = (...args) => JSON.parse(run(clean, process.execPath, ['dist/src/agentcrm.js', ...args]));
  assert.equal(cli('start').ready, false);
  assert.equal(existsSync(join(clean, '.agentcrm', 'profile.json')), false);
  const profile = { organization: 'Recipient Example', owner: 'recipient@example.invalid', timezone: 'UTC', host: 'claude-cowork' };
  assert.equal(cli('init', JSON.stringify(profile)).ready, true);
  run(clean, process.execPath, ['--input-type=module','-e', "import {Vault} from './dist/src/vault.js'; import {resolve} from 'node:path'; const v=new Vault(resolve('.agentcrm/google-vault')); v.put('demo-entry',{value:'synthetic'}); if(v.get('demo-entry').value!=='synthetic')process.exit(1);"]);
  const first = cli('demo'), second = cli('demo');
  assert.equal(first.externalActions, 0); assert.equal(second.externalActions, 0);
  assert.equal(first.pipeline.counts.records, 8); assert.equal(second.pipeline.counts.records, 8);
  assert.deepEqual(first.records.map(x => x.id), second.records.map(x => x.id));
  assert.equal(cli('status').pipeline.counts.records, 0);
  cli('create', 'person', JSON.stringify({ name: 'Private Recipient Data', email: 'private@example.invalid' }));
  assert.equal(cli('status').pipeline.counts.records, 1);
  const secondExport = join(temp, 'Shared again');
  run(clean, process.execPath, ['scripts/package.mjs', secondExport]);
  for (const name of ['.agentcrm','.agentcrm-demo','node_modules','dist']) assert.equal(existsSync(join(secondExport,name)), false);
  const checksums = JSON.parse(readFileSync(join(secondExport, 'CHECKSUMS.json'), 'utf8'));
  for (const file of Object.keys(checksums)) {
    const content = readFileSync(join(secondExport,file),'utf8');
    if (!file.startsWith('scripts/verify')) assert.ok(!content.includes('Private Recipient Data'), file);
    assert.ok(!/\/(?:Users|home)\/[^'"\s/]+/.test(content), `Machine-bound path in ${file}`);
  }
  console.log(JSON.stringify({ passed:true, cleanInstall:true, relocationWithSpaces:true, firstRunPersonalization:true,
    demoRecords:8, demoRepeatIdempotent:true, personalRuntimeIsolated:true, exportExcludesRuntime:true,
    filesChecked:Object.keys(checksums).length, externalAccountActions:0 }, null, 2));
} finally {
  // Only the fresh mkdtemp directory created by this verification.
  rmSync(temp, { recursive:true, force:true });
}
