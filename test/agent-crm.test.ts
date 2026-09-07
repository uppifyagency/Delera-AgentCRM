import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CRM } from '../src/core.js';
import { planAgentEvent } from '../src/agent-crm.js';

function fixture() {
  const dir=mkdtempSync(join(tmpdir(),'delera-agent-')); const crm=new CRM(join(dir,'crm.db'));
  crm.provision('owner@example.com','org','account'); const token=crm.issueSession('owner@example.com','org');
  return {dir,crm,token};
}

test('pipeline audit detects missing next step and overdue work',()=>{
  const {dir,crm,token}=fixture();
  try {
    const opportunity=crm.create(token,'opportunity',{title:'Stale',owner:'owner@example.com',stage:'proposal',value:10,currency:'EUR'});
    crm.create(token,'task',{title:'Late task',owner:'owner@example.com',status:'open',due:'2020-01-01T00:00:00.000Z',links:[opportunity.id]});
    const health=crm.pipelineHealth(token);
    assert.equal(health.stageCounts.proposal,1);
    assert.equal(health.health,'attention');
    assert.ok(health.issues.some(issue=>issue.code==='missing-next-step'));
    assert.ok(health.issues.some(issue=>issue.code==='overdue-task'));
  } finally {crm.close();rmSync(dir,{recursive:true,force:true});}
});

test('agent plans a new lead and a guarded external follow-up',()=>{
  const {dir,crm,token}=fixture();
  try {
    const plan=planAgentEvent(crm,token,{type:'gmail.received',messageId:'m1',from:'new@example.com',subject:'Need a proposal'});
    assert.equal(plan.workflow,'gmail-new-lead');
    assert.equal(plan.actions.some(action=>action.kind==='internal.create'),true);
    assert.equal(plan.actions.some(action=>action.kind==='external.prepare'),true);
    assert.equal(plan.actions.every(action=>action.kind!=='external.prepare'||action.risk==='medium'),true);
  } finally {crm.close();rmSync(dir,{recursive:true,force:true});}
});
