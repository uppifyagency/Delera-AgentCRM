import type { CRM, Kind } from './core.js';
import { WORKFLOW_DEFINITIONS } from './workflows.js';
import { z } from 'zod';

const eventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('gmail.received'), messageId: z.string().min(1), from: z.string().email(), subject: z.string().max(1000), snippet: z.string().optional() }).strict(),
  z.object({ type: z.literal('calendar.completed'), eventId: z.string().min(1), summary: z.string().max(1000), attendees: z.array(z.string().email()) }).strict(),
  z.object({ type: z.literal('opportunity.stage-changed'), recordId: z.string().uuid(), stage: z.enum(['new','qualified','proposal','won','lost']) }).strict(),
  z.object({ type: z.literal('pipeline.audit') }).strict(),
]);

export type AgentEvent =
  | { type: 'gmail.received'; messageId: string; from: string; subject: string; snippet?: string }
  | { type: 'calendar.completed'; eventId: string; summary: string; attendees: string[] }
  | { type: 'opportunity.stage-changed'; recordId: string; stage: 'new'|'qualified'|'proposal'|'won'|'lost' }
  | { type: 'pipeline.audit' };

export type AgentAction = {
  kind: 'internal.create'|'internal.update'|'external.prepare'|'human.review';
  target: string;
  payload: unknown;
  risk: 'low'|'medium'|'high';
  reason: string;
};

export type AgentPlan = {
  workflow: string;
  event: AgentEvent['type'];
  priority: 'low'|'medium'|'high';
  actions: AgentAction[];
  observations: string[];
  blocked: string[];
};

const workflow = (id:string) => WORKFLOW_DEFINITIONS.find(definition=>definition.id===id)?.label ?? id;

export function planAgentEvent(crm:CRM,token:string,input:unknown):AgentPlan {
  const event = eventSchema.parse(input);
  if(event.type==='pipeline.audit') {
    const health=crm.pipelineHealth(token);
    return {
      workflow:'stale-reminders',event:event.type,priority:health.health==='attention'?'high':health.health==='watch'?'medium':'low',
      actions:health.issues.map(issue=>({kind:'human.review',target:issue.recordId,payload:issue,risk:issue.severity==='high'?'medium':'low',reason:issue.message})),
      observations:[`Pipeline health: ${health.health}`,`${health.issues.length} issue(s) found`],blocked:[],
    };
  }
  if(event.type==='gmail.received') {
    const matches=crm.list(token,'person').filter(row=>row.body.email?.trim().toLowerCase()===event.from.trim().toLowerCase());
    if(matches.length>1)return {workflow:'gmail-new-lead',event:event.type,priority:'high',actions:[],observations:['Multiple exact email matches'],blocked:['Review duplicate contacts before importing this email']};
    const existing=matches[0];
    const actions:AgentAction[]=existing
      ? [{kind:'internal.create',target:workflow('email-follow-up'),payload:{kind:'activity',body:{description:`Inbound email: ${event.subject}`,links:[existing.id]}},risk:'low',reason:'Email linked to existing contact'}]
      : [{kind:'internal.create',target:workflow('gmail-new-lead'),payload:{kind:'person',body:{name:event.from,email:event.from}},risk:'low',reason:'No matching contact found'}];
    actions.push({kind:'external.prepare',target:workflow('email-follow-up'),payload:{provider:'google-tasks',operation:'create',title:`Follow up: ${event.subject}`,contact:event.from},risk:'medium',reason:'Incoming email requires a next action'});
    return {workflow:existing? 'email-follow-up':'gmail-new-lead',event:event.type,priority:'medium',actions,observations:[existing?'Existing contact matched':'New lead candidate detected'],blocked:[]};
  }
  if(event.type==='calendar.completed') {
    return {workflow:'meeting-notes',event:event.type,priority:'medium',actions:[
      {kind:'internal.create',target:workflow('calendar-activity'),payload:{kind:'activity',body:{description:`Completed meeting: ${event.summary}`,links:[]}},risk:'low',reason:'Meeting completion must be recorded'},
      {kind:'external.prepare',target:workflow('meeting-notes'),payload:{provider:'google-docs',operation:'create-notes',eventId:event.eventId,attendees:event.attendees},risk:'medium',reason:'Meeting notes and next actions require document preparation'},
    ],observations:[`${event.attendees.length} attendee(s) detected`],blocked:[]};
  }
  const record=crm.read(token,event.recordId);
  if(record.kind!=='opportunity')throw Error('Event target must be an opportunity');
  if(event.type==='opportunity.stage-changed') {
    const actions:AgentAction[]=[];
    if(event.stage==='proposal')actions.push({kind:'external.prepare',target:workflow('opportunity-proposal'),payload:{provider:'google-docs',operation:'create-proposal',recordId:event.recordId},risk:'medium',reason:'Proposal stage requires a customer-facing document'});
    if(event.stage==='won'||event.stage==='lost')actions.push({kind:'external.prepare',target:workflow('closed-opportunity'),payload:{provider:'google-tasks',operation:'reconcile',recordId:event.recordId,stage:event.stage},risk:'medium',reason:'Closed opportunity requires downstream reconciliation'});
    if(!actions.length)actions.push({kind:'human.review',target:event.recordId,payload:{stage:event.stage},risk:'low',reason:'Stage changed; confirm next step and owner'});
    return {workflow:event.stage==='proposal'?'opportunity-proposal':'closed-opportunity',event:event.type,priority:event.stage==='won'||event.stage==='lost'?'high':'medium',actions,observations:[`Requested stage ${event.stage}; stored stage ${record.body.stage}; no stage mutation performed`],blocked:[]};
  }
  throw Error('Unsupported agent event');
}

export function executeAgentPlan(crm:CRM,token:string,plan:AgentPlan,mode:'dry-run'|'live'='dry-run') {
  if(mode!=='dry-run')throw Error('Live executor disabled: use reviewed host-agent procedures until deduplication and provider dispatch are verified');
  const run=crm.beginWorkflow(token,plan.workflow,plan.event,mode,plan);
  const result={mode,created:[],prepared:[],blocked:plan.blocked,plan,effects:'simulation-only',externalActions:0};
  const finished=crm.finishWorkflow(token,run.id,plan.blocked.length?'blocked':'completed',result);
  return {run:finished, ...result};
}

export function workflowCatalog() {
  return WORKFLOW_DEFINITIONS.map(definition=>({id:definition.id,label:definition.label,googleCapabilities:definition.google}));
}
