import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {CRM} from '../src/core.js';
test('process crash after possible external acceptance becomes unknown on reopen',()=>{
 const dir=mkdtempSync(join(tmpdir(),'hermes-crash-')),db=join(dir,'test.db');const c=new CRM(db);c.provision('a','org','acc');const token=c.issueSession('a','org');const action=c.prepare(token,{account:'acc',kind:'synthetic.send',target:'test@example.invalid',subject:'Synthetic',text:'Test',expires:Date.now()+60000});c.approve(token,action.id,action.hash);c.close();
 try {
 const child=spawnSync(process.execPath,['--input-type=module','-e',`import {CRM} from ${JSON.stringify(new URL('../src/core.js',import.meta.url).href)};const c=new CRM(process.env.TEST_DB);await c.dispatch(process.env.TEST_TOKEN,process.env.TEST_ACTION,async()=>{process.exit(23)});`],{env:{PATH:process.env.PATH,TEST_DB:db,TEST_TOKEN:token,TEST_ACTION:action.id}});
 assert.equal(child.status,23);const reopened=new CRM(db);try{assert.equal(reopened.action(token,action.id).state,'dispatching');assert.equal(reopened.recoverInterrupted(),1);assert.equal(reopened.action(token,action.id).state,'unknown');}finally{reopened.close();}
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('separate database connections observe versions and only one dispatch claim',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'hermes-concurrency-')),db=join(dir,'test.db');const c=new CRM(db),d=new CRM(db);try{c.provision('a','org','acc');const token=c.issueSession('a','org');const p=c.create(token,'person',{name:'Synthetic'});d.update(token,p.id,1,{name:'Changed'});assert.throws(()=>c.update(token,p.id,1,{name:'Overwrite'}));const action=c.prepare(token,{account:'acc',kind:'synthetic.send',target:'test@example.invalid',subject:'Synthetic',text:'Test',expires:Date.now()+60000});c.approve(token,action.id,action.hash);let count=0;await Promise.allSettled([c.dispatch(token,action.id,async()=>{count++;return '1'}),d.dispatch(token,action.id,async()=>{count++;return '2'})]);assert.equal(count,1);}finally{d.close();c.close();rmSync(dir,{recursive:true,force:true});}
});
