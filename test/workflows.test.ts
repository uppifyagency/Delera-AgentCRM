import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootstrapCRM, WORKFLOW_DEFINITIONS } from '../src/workflows.js';
import { ALL_GOOGLE_CAPABILITIES } from '../src/google-oauth.js';

test('startup registers all workflows without claiming they are running', () => {
  const bootstrap = bootstrapCRM(false, '2026-09-07T10:00:00.000Z');
  assert.equal(bootstrap.core.active, true);
  assert.equal(bootstrap.workflows.length, 12);
  assert.equal(bootstrap.workflows.every(workflow => !workflow.active && workflow.registered), true);
  assert.equal(bootstrap.workflows.every(workflow => workflow.mode === 'local-synthetic'), true);
  assert.deepEqual(bootstrap.workflows.map(workflow => workflow.id), WORKFLOW_DEFINITIONS.map(definition => definition.id));
});

test('a connection does not prove end-to-end workflow execution', () => {
  const bootstrap = bootstrapCRM(true, '2026-09-07T10:00:00.000Z');
  assert.equal(bootstrap.workflows.every(workflow => workflow.mode === 'google-connected'), true);
  assert.equal(bootstrap.workflows.every(workflow => workflow.connectionReady && !workflow.active), true);
  assert.equal(bootstrap.workflows.every(workflow => workflow.nextStep === 'requires-agent-execution-and-verification'), true);
});

test('the Google connection plan covers every external workflow capability', () => {
  const required = new Set(WORKFLOW_DEFINITIONS.flatMap(definition => definition.google));
  assert.deepEqual([...required].sort(), [
    'calendar.read', 'calendar.write', 'contacts.read', 'contacts.write', 'docs.write',
    'drive.read', 'drive.write', 'gmail.read', 'gmail.write', 'sheets.write', 'tasks.read', 'tasks.write',
  ].sort());
  assert.equal(ALL_GOOGLE_CAPABILITIES.length, 13);
});
