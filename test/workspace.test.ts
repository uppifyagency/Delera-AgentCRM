import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, realpathSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function run(home: string, ...args: string[]) {
  const result = spawnSync(process.execPath, ['dist/src/agentcrm.js', ...args], {
    env: { ...process.env, DELERA_AGENTCRM_HOME: home },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout) as Record<string, unknown>;
}

test('portable workspace requires personal setup, then starts idempotently', () => {
  const home = mkdtempSync(join(realpathSync(tmpdir()), 'delera-workspace-'));
  try {
    const started = run(home, 'start');
    assert.equal(started.ready, false);
    assert.equal(started.status, 'needs-personal-setup');
    const profile = { organization: 'Example Team', owner: 'owner@example.invalid', timezone: 'Europe/Rome', host: 'claude-cowork' };
    assert.equal(run(home, 'init', JSON.stringify(profile)).ready, true);
    assert.equal(run(home, 'init', JSON.stringify(profile)).ready, true);
    const person = run(home, 'create', 'person', JSON.stringify({ name: 'Synthetic Codex contact', email: 'synthetic@example.invalid' }));
    assert.equal(typeof person.id, 'string');
    const search = run(home, 'search', 'Synthetic Codex');
    assert.equal((search.results as unknown[]).length, 1);
    const status = run(home, 'status');
    assert.equal((status.pipeline as {counts:{records:number}}).counts.records, 1);
    assert.equal(status.readiness, 'local-core-only');
    assert.deepEqual(status.automations, []);
    assert.equal(status.externalActionsEnabled, false);
    const backup = join(home, 'backup.hcrm');
    const backed = run(home, 'backup', backup);
    assert.equal(backed.encrypted, true);
    assert.equal((statSync(backup).mode & 0o077), 0);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
