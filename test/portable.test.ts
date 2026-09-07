import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, realpathSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { initializeProfile } from '../src/profile.js';
import { nextGoogleConnectionStep } from '../src/google-oauth.js';
import { planAgentEvent, executeAgentPlan } from '../src/agent-crm.js';
import { CRM } from '../src/core.js';

test('profile is personal and refuses silent replacement', () => {
  const home = mkdtempSync(join(realpathSync(tmpdir()), 'agentcrm-profile-'));
  try {
    const profile = { organization: 'Test Company', owner: 'owner@example.invalid', timezone: 'UTC', host: 'chatgpt-work' };
    initializeProfile(home, profile);
    assert.throws(() => initializeProfile(home, {...profile, owner:'other@example.invalid'}), /already personalized/);
    assert.throws(() => initializeProfile(home, {...profile, timezone:'Invalid/Zone'}));
  } finally { rmSync(home, { recursive:true, force:true }); }
});
test('Tasks-only connection does not request unrelated account permissions', () => {
  const home = mkdtempSync(join(realpathSync(tmpdir()), 'agentcrm-oauth-'));
  try {
    const next = nextGoogleConnectionStep(home, [], ['tasksRead','tasksWrite']);
    assert.equal(next?.step, 'tasksRead');
    assert.deepEqual(next?.capabilities, ['identity','tasksRead']);
    assert.equal(existsSync(join(home,'google-vault')), false);
    assert.equal(nextGoogleConnectionStep(home, ['tasks.read','tasks.write'], ['tasksRead','tasksWrite']), null);
    assert.equal(nextGoogleConnectionStep(home, ['drive.read'], ['driveMetadata'])?.step, 'driveMetadata');
  } finally { rmSync(home, { recursive:true, force:true }); }
});
test('host environment variables never imply working OAuth or workflows', () => {
  const home = mkdtempSync(join(realpathSync(tmpdir()), 'agentcrm-host-'));
  try {
    const result = spawnSync(process.execPath, ['dist/src/agentcrm.js','start'], { encoding:'utf8', env:{...process.env, DELERA_AGENTCRM_HOME:home, CODEX_THREAD_ID:'demo', CODEX_APP_TOOLS_PIPE_PATH:'demo'} });
    assert.equal(result.status, 0, result.stderr);
    const data = JSON.parse(result.stdout);
    assert.equal(data.ready, false); assert.deepEqual(data.automations, []);
  } finally { rmSync(home, { recursive:true, force:true }); }
});
test('planner validates inputs, exact email matches and blocks the live executor before effects', () => {
  const home = mkdtempSync(join(realpathSync(tmpdir()), 'agentcrm-plan-')), crm = new CRM(join(home,'crm.db'));
  try {
    crm.provision('owner@example.invalid','org','local'); const token = crm.issueSession('owner@example.invalid','org');
    crm.create(token,'person',{name:'Not the sender: sender@example.invalid',email:'someone@example.invalid'});
    const event = {type:'gmail.received',messageId:'demo',from:'sender@example.invalid',subject:'Demo'};
    assert.equal(planAgentEvent(crm,token,event).workflow, 'gmail-new-lead');
    assert.throws(()=>planAgentEvent(crm,token,{type:'unsupported'}));
    const plan = planAgentEvent(crm,token,event), before = crm.list(token).length;
    assert.throws(()=>executeAgentPlan(crm,token,plan,'live'), /disabled/);
    assert.equal(crm.list(token).length,before);
    assert.equal(executeAgentPlan(crm,token,plan,'dry-run').externalActions,0);
    assert.equal(crm.list(token).length,before);
    crm.create(token,'person',{name:'One',email:event.from}); crm.create(token,'person',{name:'Two',email:event.from});
    assert.ok(planAgentEvent(crm,token,event).blocked.length);
  } finally { crm.close(); rmSync(home, { recursive:true, force:true }); }
});
