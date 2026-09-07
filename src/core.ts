import Database from 'better-sqlite3';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';

const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const fields = {
  person: z.object({ name: z.string().min(1), email: z.string().email().optional(), companyId: z.string().uuid().optional() }).strict(),
  company: z.object({ name: z.string().min(1), domain: z.string().optional() }).strict(),
  opportunity: z.object({ title: z.string().min(1), owner: z.string().min(1), stage: z.enum(['new','qualified','proposal','won','lost']), value: z.number().nonnegative(), currency: z.string().regex(/^[A-Z]{3}$/), nextStep: z.string().min(1).optional(), nextStepDue: z.string().datetime().optional(), lastContacted: z.string().datetime().optional() }).strict(),
  task: z.object({ title: z.string().min(1), owner: z.string().min(1), status: z.enum(['open','doing','done','cancelled']), due: z.string().datetime().optional(), links: z.array(z.string().uuid()) }).strict(),
  activity: z.object({ description: z.string().min(1), links: z.array(z.string().uuid()) }).strict(),
};
export type Kind = keyof typeof fields;
export type Session = Readonly<{ user: string; org: string; role: string }>;
type Row = {id:string; org:string; kind:Kind; version:number; body:string};
export type Action = {id:string; org:string; actor:string; account:string; kind:string; body:string; hash:string; expires:number; state:string; receipt:string|null};
export class CRM {
  private db: Database.Database;
  constructor(path: string) {
    this.db = new Database(path);
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('busy_timeout = 5000');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS controls(key TEXT PRIMARY KEY,value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS memberships(user TEXT, org TEXT, role TEXT NOT NULL CHECK(role IN ('owner','operator')), PRIMARY KEY(user,org));
      CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user TEXT,org TEXT, expires INTEGER NOT NULL, FOREIGN KEY(user,org) REFERENCES memberships(user,org));
      CREATE TABLE IF NOT EXISTS records(id TEXT PRIMARY KEY,org TEXT NOT NULL,kind TEXT NOT NULL,version INTEGER NOT NULL,body TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS records_org ON records(org);
      CREATE TABLE IF NOT EXISTS assertions(id TEXT PRIMARY KEY,org TEXT NOT NULL,record TEXT NOT NULL REFERENCES records(id),field TEXT NOT NULL,value TEXT NOT NULL,source TEXT NOT NULL,position TEXT,observed TEXT NOT NULL,acquired TEXT NOT NULL,transformation TEXT NOT NULL,verification TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY,org TEXT NOT NULL,provider TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS actions(id TEXT PRIMARY KEY,org TEXT NOT NULL,actor TEXT NOT NULL,account TEXT NOT NULL REFERENCES accounts(id),kind TEXT NOT NULL,body TEXT NOT NULL,hash TEXT NOT NULL,expires INTEGER NOT NULL,state TEXT NOT NULL,receipt TEXT);
      CREATE TABLE IF NOT EXISTS restrictions(org TEXT NOT NULL,target TEXT NOT NULL,blocked INTEGER NOT NULL,PRIMARY KEY(org,target));
      CREATE TABLE IF NOT EXISTS events(org TEXT NOT NULL,provider TEXT NOT NULL,event TEXT NOT NULL,PRIMARY KEY(org,provider,event));
      CREATE TABLE IF NOT EXISTS inbox(org TEXT NOT NULL,provider TEXT NOT NULL,event TEXT NOT NULL,payload TEXT NOT NULL,state TEXT NOT NULL,PRIMARY KEY(org,provider,event));
      CREATE TABLE IF NOT EXISTS workflow_runs(id TEXT PRIMARY KEY,org TEXT NOT NULL,workflow TEXT NOT NULL,event TEXT NOT NULL,mode TEXT NOT NULL,state TEXT NOT NULL,plan TEXT NOT NULL,result TEXT,created TEXT NOT NULL,updated TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS workflow_runs_org ON workflow_runs(org,created);
    `);
  }
  // Administrative provisioning is deliberately absent from operational tools.
  provision(user:string,org:string,account:string) {
    this.db.transaction(()=>{
      this.db.prepare('INSERT OR IGNORE INTO memberships VALUES (?,?,?)').run(user,org,'owner');
      this.db.prepare('INSERT INTO accounts VALUES (?,?,?) ON CONFLICT(id) DO NOTHING').run(account,org,'synthetic');
    })();
  }
  issueSession(user:string,org:string,ttlMs=3600000) {
    if (!this.db.prepare('SELECT 1 FROM memberships WHERE user=? AND org=?').get(user,org)) throw Error('forbidden');
    const token=randomBytes(32).toString('hex');
    this.db.prepare('INSERT INTO sessions VALUES (?,?,?,?)').run(digest(token),user,org,Date.now()+ttlMs);
    return token;
  }
  private auth(token:string): Session {
    if(this.db.prepare("SELECT 1 FROM controls WHERE key='effects_enabled' AND value='false'").get())throw Error('restore quarantined');
    const session=this.db.prepare('SELECT m.user,m.org,m.role FROM sessions s JOIN memberships m ON s.user=m.user AND s.org=m.org WHERE s.token=? AND s.expires>?').get(digest(token),Date.now()) as Session|undefined;
    if(!session) throw Error('unauthorized');
    return session;
  }
  create(token:string,kind:Kind,input:unknown) {
    const s=this.auth(token); const body=fields[kind].parse(input); this.checkLinks(s,body);
    const id=randomUUID(); this.db.prepare('INSERT INTO records VALUES (?,?,?,?,?)').run(id,s.org,kind,1,JSON.stringify(body));
    return {id,version:1,...body};
  }
  private checkLinks(s:Session,body:object) {
    const b=body as {links?:string[];companyId?:string;owner?:string};
    if(b.owner&&!this.db.prepare('SELECT 1 FROM memberships WHERE user=? AND org=?').get(b.owner,s.org))throw Error('invalid owner');
    if(b.companyId&&!this.db.prepare("SELECT 1 FROM records WHERE id=? AND org=? AND kind='company'").get(b.companyId,s.org))throw Error('invalid company');
    for(const id of [...(b.links??[]),...(b.companyId?[b.companyId]:[])]) {
      if(!this.db.prepare('SELECT 1 FROM records WHERE id=? AND org=?').get(id,s.org)) throw Error('invalid reference');
    }
  }
  read(token:string,id:string) {
    const s=this.auth(token);const row=this.db.prepare('SELECT * FROM records WHERE id=? AND org=?').get(id,s.org) as Row|undefined;
    if(!row) throw Error('not found'); return {...row,body:JSON.parse(row.body)};
  }
  update(token:string,id:string,version:number,input:unknown) {
    const row=this.read(token,id);const body=fields[row.kind].parse(input);this.checkLinks(this.auth(token),body);
    const r=this.db.prepare('UPDATE records SET body=?,version=version+1 WHERE id=? AND org=? AND version=?').run(JSON.stringify(body),id,row.org,version);
    if(r.changes!==1) throw Error('version conflict');return this.read(token,id);
  }
  search(token:string,query:string) {
    const s=this.auth(token);if(query.length>500)throw Error('query too long');
    return (this.db.prepare('SELECT * FROM records WHERE org=? AND instr(lower(body),lower(?))>0 LIMIT 100').all(s.org,query) as Row[]).map(r=>({...r,body:JSON.parse(r.body)}));
  }
  list(token:string,kind?:Kind) {
    const s=this.auth(token);
    const rows=(kind
      ? this.db.prepare('SELECT * FROM records WHERE org=? AND kind=? ORDER BY rowid').all(s.org,kind)
      : this.db.prepare('SELECT * FROM records WHERE org=? ORDER BY rowid').all(s.org)) as Row[];
    return rows.map(r=>({...r,body:JSON.parse(r.body)}));
  }
  accounts(token:string) {
    const s=this.auth(token);
    return this.db.prepare('SELECT id,org,provider FROM accounts WHERE org=? ORDER BY id').all(s.org) as Array<{id:string;org:string;provider:string}>;
  }
  pipelineHealth(token:string) {
    const rows=this.list(token);
    const opportunities=rows.filter(row=>row.kind==='opportunity') as Array<Row & {body:{stage:string;nextStep?:string;nextStepDue?:string;lastContacted?:string}}>;
    const tasks=rows.filter(row=>row.kind==='task') as Array<Row & {body:{status:string;due?:string}}>;
    const now=Date.now();
    const issues=opportunities.flatMap(row=>[
      ...(!row.body.nextStep&&row.body.stage!=='won'&&row.body.stage!=='lost'?[{code:'missing-next-step',severity:'high',recordId:row.id,message:`Opportunity ${row.body.stage} has no next step`}] : []),
      ...(row.body.nextStepDue&&Date.parse(row.body.nextStepDue)<now&&row.body.stage!=='won'&&row.body.stage!=='lost'?[{code:'overdue-next-step',severity:'high',recordId:row.id,message:'Opportunity next step is overdue'}] : []),
      ...(row.body.lastContacted&&now-Date.parse(row.body.lastContacted)>14*86400000&&row.body.stage!=='won'&&row.body.stage!=='lost'?[{code:'stale-opportunity',severity:'medium',recordId:row.id,message:'Opportunity has had no contact for more than 14 days'}] : []),
    ]).concat(tasks.flatMap(row=>row.body.due&&Date.parse(row.body.due)<now&&!['done','cancelled'].includes(row.body.status)?[{code:'overdue-task',severity:'medium',recordId:row.id,message:'Task is overdue'}]:[]));
    const stageCounts=Object.fromEntries(['new','qualified','proposal','won','lost'].map(stage=>[stage,opportunities.filter(row=>row.body.stage===stage).length]));
    return {counts:{records:rows.length,people:rows.filter(row=>row.kind==='person').length,companies:rows.filter(row=>row.kind==='company').length,opportunities:opportunities.length,tasks:tasks.length,activities:rows.filter(row=>row.kind==='activity').length},stageCounts,issues,health:issues.some(issue=>issue.severity==='high')?'attention':issues.length?'watch':'clean'};
  }
  beginWorkflow(token:string,workflow:string,event:string,mode:'dry-run'|'live'='dry-run',plan:unknown={}) {
    const s=this.auth(token),now=new Date().toISOString(),id=randomUUID();
    this.db.prepare('INSERT INTO workflow_runs VALUES (?,?,?,?,?,?,?,?,?,?)').run(id,s.org,workflow,event,mode,'planned',JSON.stringify(plan),null,now,now);
    return this.workflow(token,id);
  }
  workflow(token:string,id:string) {
    const s=this.auth(token);const row=this.db.prepare('SELECT * FROM workflow_runs WHERE id=? AND org=?').get(id,s.org) as {id:string;org:string;workflow:string;event:string;mode:string;state:string;plan:string;result:string|null;created:string;updated:string}|undefined;
    if(!row)throw Error('workflow run not found');return {...row,plan:JSON.parse(row.plan),result:row.result?JSON.parse(row.result):null};
  }
  finishWorkflow(token:string,id:string,state:'completed'|'blocked'|'failed',result:unknown) {
    const s=this.auth(token),updated=new Date().toISOString();
    const changed=this.db.prepare('UPDATE workflow_runs SET state=?,result=?,updated=? WHERE id=? AND org=?').run(state,JSON.stringify(result),updated,id,s.org);
    if(changed.changes!==1)throw Error('workflow run not found');return this.workflow(token,id);
  }
  assert(token:string,record:string,input:unknown) {
    const s=this.auth(token);this.read(token,record);
    const a=z.object({field:z.string(),value:z.unknown(),source:z.string().min(1),position:z.string().optional(),observed:z.string().datetime(),transformation:z.string(),verification:z.enum(['unverified','inference'])}).strict().parse(input);
    const id=randomUUID();this.db.prepare('INSERT INTO assertions VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(id,s.org,record,a.field,JSON.stringify(a.value),a.source,a.position??null,a.observed,new Date().toISOString(),a.transformation,a.verification);
    return id; // Evidence cannot overwrite authoritative record fields.
  }
  prepare(token:string,input:unknown) {
    const s=this.auth(token);
    const p=z.object({account:z.string(),kind:z.literal('synthetic.send'),target:z.string().email(),subject:z.string().min(1).max(998),text:z.string().max(100000),expires:z.number().int()}).strict().parse(input);
    if(p.expires<=Date.now()||p.expires>Date.now()+86400000)throw Error('invalid expiry');
    if(!this.db.prepare('SELECT 1 FROM accounts WHERE id=? AND org=?').get(p.account,s.org))throw Error('forbidden account');
    const id=randomUUID(),body=JSON.stringify(p),hash=digest(body);
    this.db.prepare('INSERT INTO actions VALUES (?,?,?,?,?,?,?,?,?,NULL)').run(id,s.org,s.user,p.account,p.kind,body,hash,p.expires,'prepared');
    return this.action(token,id);
  }
  prepareExternal(token:string,input:unknown) {
    const s=this.auth(token);
    const p=z.object({account:z.string(),provider:z.enum(['gmail','google-calendar','google-drive','google-docs','google-sheets','google-tasks','google-contacts']),operation:z.string().min(1).max(100),payload:z.unknown(),target:z.string().optional(),expires:z.number().int()}).strict().parse(input);
    if(p.expires<=Date.now()||p.expires>Date.now()+86400000)throw Error('invalid expiry');
    if(!this.db.prepare('SELECT 1 FROM accounts WHERE id=? AND org=?').get(p.account,s.org))throw Error('forbidden account');
    const id=randomUUID(),body=JSON.stringify(p),hash=digest(body);
    this.db.prepare('INSERT INTO actions VALUES (?,?,?,?,?,?,?,?,?,NULL)').run(id,s.org,s.user,p.account,`external.${p.provider}.${p.operation}`,body,hash,p.expires,'prepared');
    return this.action(token,id);
  }
  action(token:string,id:string):Action {
    const s=this.auth(token);const a=this.db.prepare('SELECT * FROM actions WHERE id=? AND org=? AND actor=?').get(id,s.org,s.user) as Action|undefined;
    if(!a)throw Error('not found');return a;
  }
  approve(token:string,id:string,hash:string) {
    const a=this.action(token,id);if(a.hash!==hash||a.expires<=Date.now())throw Error('invalid approval');
    if(a.state==='approved')return a;
    if(a.state!=='prepared')throw Error('invalid state');
    this.db.prepare("UPDATE actions SET state='approved' WHERE id=? AND state='prepared'").run(id);
    return this.action(token,id);
  }
  revoke(token:string,id:string) {
    const a=this.action(token,id);
    if(a.state!=='prepared'&&a.state!=='approved')throw Error('invalid state');
    this.db.prepare("UPDATE actions SET state='revoked' WHERE id=? AND state IN ('prepared','approved')").run(id);
    return this.action(token,id);
  }
  restrict(token:string,target:string,blocked:boolean) {
    const s=this.auth(token);if(s.role!=='owner')throw Error('forbidden');
    this.db.prepare('INSERT INTO restrictions VALUES (?,?,?) ON CONFLICT(org,target) DO UPDATE SET blocked=excluded.blocked').run(s.org,target.toLowerCase(),blocked?1:0);
  }
  async dispatch(token:string,id:string,send:(payload:unknown)=>Promise<string>) {
    const a=this.db.transaction(()=>{
      if(this.db.prepare("SELECT 1 FROM controls WHERE key='effects_enabled' AND value='false'").get())throw Error('restored effects disabled');
      const a=this.action(token,id),p=JSON.parse(a.body);
      if(a.state!=='approved'||a.expires<=Date.now())throw Error('not dispatchable');
      if(typeof p.target==='string'&&this.db.prepare('SELECT 1 FROM restrictions WHERE org=? AND target=? AND blocked=1').get(a.org,p.target.toLowerCase()))throw Error('restricted');
      const r=this.db.prepare("UPDATE actions SET state='dispatching' WHERE id=? AND state='approved'").run(id);if(r.changes!==1)throw Error('claimed');return a;
    })();
    try {const receipt=await send(JSON.parse(a.body));const recorded=this.db.prepare("UPDATE actions SET state='accepted',receipt=? WHERE id=? AND state IN ('dispatching','unknown')").run(receipt,id);if(recorded.changes!==1)throw Error('receipt not persisted');}
    catch {this.db.prepare("UPDATE actions SET state='unknown' WHERE id=? AND state='dispatching'").run(id);}
    return this.action(token,id);
  }
  recoverInterrupted() {return this.db.prepare("UPDATE actions SET state='unknown' WHERE state='dispatching'").run().changes;}
  ingest(token:string,provider:string,event:string) {const s=this.auth(token);return this.db.prepare('INSERT OR IGNORE INTO events VALUES (?,?,?)').run(s.org,provider,event).changes===1;}
  enqueue(token:string,provider:string,event:string,payload:unknown) {
    const s=this.auth(token),body=JSON.stringify(payload);if(body.length>100000)throw Error('event too large');
    return this.db.prepare("INSERT OR IGNORE INTO inbox VALUES (?,?,?,?,'pending')").run(s.org,provider,event,body).changes===1;
  }
  processEvent(token:string,provider:string,event:string) {
    const s=this.auth(token);
    return this.db.transaction(()=>{
      const row=this.db.prepare('SELECT payload,state FROM inbox WHERE org=? AND provider=? AND event=?').get(s.org,provider,event) as {payload:string;state:string}|undefined;
      if(!row)throw Error('event not found');if(row.state==='done')return false;
      const payload=z.object({operations:z.array(z.object({kind:z.enum(['person','company','opportunity','task','activity']),body:z.unknown()}).strict()).min(1).max(100)}).strict().parse(JSON.parse(row.payload));
      for(const operation of payload.operations)this.create(token,operation.kind,operation.body);
      this.db.prepare("UPDATE inbox SET state='done' WHERE org=? AND provider=? AND event=?").run(s.org,provider,event);return true;
    })();
  }
  close(){this.db.close();}
}
