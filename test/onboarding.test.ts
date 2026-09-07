import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,chmodSync,symlinkSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {privateHome,readState,writeState,reminderDue,nextRequirement,type OnboardingState} from '../src/onboarding.js';
const state:OnboardingState={schemaVersion:1,answers:{},pending:['codex-workspace-permission'],activationAuthorized:false,reminders:{count:0,lastSentAt:null,maxCount:3,minimumHours:72}};
test('private state survives restart; unsafe paths and permissions are refused',()=>{const p=mkdtempSync(join(realpathSync(tmpdir()),'codex-onboarding-'));try{const home=privateHome(p);writeState(home,state);assert.equal(nextRequirement(readState(home))?.id,'codex-workspace-permission');chmodSync(join(home,'onboarding.json'),0o644);assert.throws(()=>readState(home));symlinkSync(home,join(home,'link'));assert.throws(()=>privateHome(join(home,'link')));}finally{rmSync(p,{recursive:true,force:true})}});
test('reminders obey 72 hours and cap of three',()=>{assert.equal(reminderDue(state),true);assert.equal(reminderDue({...state,reminders:{...state.reminders,count:3}}),false);assert.equal(reminderDue({...state,reminders:{...state.reminders,lastSentAt:new Date().toISOString()}}),false);});

test('first reminder waits 72 hours after the most recent pending request',()=>{const now=Date.now();const pending={...state,requests:{'codex-workspace-permission':{lastRequestedAt:new Date(now).toISOString()}}};assert.equal(reminderDue(pending,now+71*3600000),false);assert.equal(reminderDue(pending,now+72*3600000),true);assert.equal(reminderDue({...pending,lastRequestAt:'invalid'},now),false);});
