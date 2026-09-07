import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { CRM, type Kind } from './core.js';
import { encryptedBackup, restoreEncryptedBackup } from './backup.js';
import { privateHome, readState, writeState } from './onboarding.js';
import { bootstrapCRM } from './workflows.js';
import { persistStartupManifest } from './startup-manifest.js';
import { executeAgentPlan, planAgentEvent, workflowCatalog } from './agent-crm.js';
import { GOOGLE_SCOPES, authorizeGoogle, nextGoogleConnectionStep, readGoogleCredential, type GoogleCapability } from './google-oauth.js';
import { connectorReports, initializeProfile, readProfile, recordConnectorReport } from './profile.js';

export const WORKSPACE = 'Delera-AgentCRM';
function secureFile(path: string) {
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077)) throw Error('Unsafe private file');
}
export function openWorkspace() {
  process.umask(0o077);
  const home = privateHome(), profile = readProfile(home);
  if (!profile) throw Error('Personal setup required: init with organization, owner, timezone and host. Read START_HERE.md.');
  const dbPath = join(home, 'crm.db');
  if (existsSync(dbPath)) secureFile(dbPath);
  const crm = new CRM(dbPath);
  try {
    crm.provision(profile.owner, profile.organization, 'local-synthetic');
    const path = join(home, 'agent-token');
    let token = '';
    if (existsSync(path)) { secureFile(path); token = readFileSync(path, 'utf8'); }
    try { crm.search(token, '__agentcrm_probe__'); }
    catch {
      token = crm.issueSession(profile.owner, profile.organization, 86400000);
      const next = `${path}.${randomUUID()}.next`;
      writeFileSync(next, token, { mode: 0o600, flag: 'wx' }); renameSync(next, path);
    }
    return { home, profile, dbPath, crm, token };
  } catch (error) { crm.close(); throw error; }
}
function setup(input: unknown) {
  process.umask(0o077);
  const home = privateHome(), profile = initializeProfile(home, input);
  if (!existsSync(join(home, 'onboarding.json'))) writeState(home, {
    schemaVersion: 1, answers: { ...profile }, pending: ['data-policy'], activationAuthorized: false,
    reminders: { count: 0, lastSentAt: null, maxCount: 3, minimumHours: 72 },
  });
  return statusWorkspace();
}
export function statusWorkspace() {
  const home = privateHome();
  if (!readProfile(home)) return {
    workspace: WORKSPACE, ready: false, status: 'needs-personal-setup',
    required: ['organization', 'owner', 'timezone', 'host'], next: 'Read START_HERE.md; ask only missing profile fields, then run init.',
    externalActionsEnabled: false, automations: [],
  };
  const w = openWorkspace();
  try {
    const credential = readGoogleCredential(home);
    const accountMatches = !credential || credential.account.toLowerCase() === (w.profile.googleAccount ?? w.profile.owner).toLowerCase();
    const bootstrap = bootstrapCRM(false);
    const manifest = persistStartupManifest(home, bootstrap, { status: accountMatches ? 'verify-in-current-agent-session' : 'account-mismatch' });
    const health = w.crm.pipelineHealth(w.token);
    return {
      workspace: WORKSPACE, profile: w.profile, ready: true, readiness: 'local-core-only',
      database: w.dbPath, state: readState(home), pipeline: { ...health, empty: health.counts.opportunities === 0 },
      bootstrap, connectorCatalog: manifest.connectors, connectorReports: connectorReports(home),
      directOAuth: { credentialStored: Boolean(credential), accountMatches, credentialsNeedLiveProbe: Boolean(credential) },
      externalActionsEnabled: false, automations: [], backgroundRunner: 'not-installed',
      next: 'Follow docs/AGENT_PLAYBOOK.md; probe host connectors in this session before authorizing missing connections.',
    };
  } finally { w.crm.close(); }
}
function backupKey(home: string) {
  const path = join(home, 'backup.key');
  if (!existsSync(path)) writeFileSync(path, randomBytes(32), { mode: 0o600, flag: 'wx' });
  secureFile(path); const key = readFileSync(path);
  if (key.length !== 32) throw Error('Invalid backup key');
  return key;
}
export async function backupWorkspace(destination?: string) {
  const w = openWorkspace();
  try {
    const dir = join(w.home, 'backups'); mkdirSync(dir, { recursive: true, mode: 0o700 });
    const target = resolve(destination ?? join(dir, `${Date.now()}-${randomUUID()}.hcrm`));
    if (existsSync(target)) throw Error('Backup destination already exists; choose a new file.');
    await encryptedBackup(w.dbPath, target, backupKey(w.home));
    return { created: true, destination: target, encrypted: true, keyStoredSeparately: join(w.home, 'backup.key') };
  } finally { w.crm.close(); }
}
export function restoreWorkspace(source: string, destination?: string) {
  const w = openWorkspace();
  try {
    const target = resolve(destination ?? join(w.home, `restored-${randomUUID()}.db`));
    if (existsSync(target)) throw Error('Restore destination already exists; choose a new file.');
    restoreEncryptedBackup(source, target, backupKey(w.home));
    return { restored: true, destination: target, effects: 'disabled-until-explicit-review' };
  } finally { w.crm.close(); }
}
const parse = (value?: string): unknown => { if (!value) throw Error('JSON argument required'); return JSON.parse(value); };
const connectionRequest = z.object({ requested: z.array(z.enum(Object.keys(GOOGLE_SCOPES) as [GoogleCapability, ...GoogleCapability[]])).min(1) }).strict();
async function connectGoogle(input: unknown, authorize: boolean) {
  const home = privateHome(), profile = readProfile(home);
  if (!profile) throw Error('Initialize your profile first.');
  const { requested } = connectionRequest.parse(input);
  const credential = readGoogleCredential(home), account = profile.googleAccount ?? profile.owner;
  if (credential && credential.account.toLowerCase() !== account.toLowerCase()) throw Error('Google credential account mismatch.');
  const next = nextGoogleConnectionStep(home, [], requested);
  if (!next) return { status: 'scopes-stored-needs-live-probe', next: null, account };
  const clientPath = join(home, 'google-client.json');
  if (!authorize || !existsSync(clientPath)) return { status: existsSync(clientPath) ? 'awaiting-consent' : 'awaiting-personal-desktop-oauth-client', next, account, help: 'docs/OAUTH.md' };
  secureFile(clientPath);
  await authorizeGoogle(home, account, next.capabilities);
  // One consent only; the host agent verifies the result before the next step.
  return { status: 'step-authorized-needs-live-probe', completed: next.step, next: nextGoogleConnectionStep(home, [], requested) };
}
function demo() {
  const previous = process.env.DELERA_AGENTCRM_HOME;
  process.env.DELERA_AGENTCRM_HOME = resolve(import.meta.dirname, '../../.agentcrm-demo');
  try {
    setup({ organization: 'Demo Company', owner: 'owner@example.invalid', timezone: 'Europe/Rome', host: 'other' });
    const w = openWorkspace();
    try {
      const seed = (kind: Kind, body: Record<string, unknown>) => {
        const key = body.name ?? body.title ?? body.description;
        const existing = w.crm.list(w.token, kind).find(row => (row.body.name ?? row.body.title ?? row.body.description) === key);
        return existing ?? w.crm.create(w.token, kind, body);
      };
      const company = seed('company', { name: 'DEMO · Aurora Studio', domain: 'aurora.example.invalid' });
      const person = seed('person', { name: 'DEMO · Anna Esempio', email: 'anna@aurora.example.invalid', companyId: company.id });
      seed('person', { name: 'DEMO · Marco Esempio', email: 'marco@example.invalid' });
      const opportunity = seed('opportunity', { title: 'DEMO · Progetto Aurora', owner: w.profile.owner, stage: 'qualified', value: 12000, currency: 'EUR', nextStep: 'Preparare discovery', nextStepDue: '2030-01-10T09:00:00.000Z' });
      seed('opportunity', { title: 'DEMO · Proposta da riattivare', owner: w.profile.owner, stage: 'proposal', value: 7500, currency: 'EUR', lastContacted: '2020-01-01T00:00:00.000Z' });
      seed('opportunity', { title: 'DEMO · Progetto concluso', owner: w.profile.owner, stage: 'won', value: 5000, currency: 'EUR' });
      seed('task', { title: 'DEMO · Follow-up in ritardo', owner: w.profile.owner, status: 'open', due: '2020-01-02T09:00:00.000Z', links: [opportunity.id, person.id] });
      seed('activity', { description: 'DEMO · Discovery di esempio, nessun meeting reale', links: [opportunity.id, person.id] });
      const drafts = join(w.home, 'email-drafts.json');
      if (!existsSync(drafts)) writeFileSync(drafts, JSON.stringify([{ type: 'local-demo-draft', to: 'anna@aurora.example.invalid', subject: '[DEMO] Prossimo incontro', body: 'Bozza fittizia. Nessun invio e nessuna creazione su Gmail.' }], null, 2), { flag: 'wx', mode: 0o600 });
      return { demo: true, externalActions: 0, home: w.home, pipeline: w.crm.pipelineHealth(w.token), contacts: w.crm.list(w.token, 'person'), records: w.crm.list(w.token), localDrafts: drafts, automations: [] };
    } finally { w.crm.close(); }
  } finally { if (previous === undefined) delete process.env.DELERA_AGENTCRM_HOME; else process.env.DELERA_AGENTCRM_HOME = previous; }
}
export async function execute(argv: string[]) {
  const command = argv[0] ?? 'start';
  if (command === 'start' || command === 'status') return statusWorkspace();
  if (command === 'init') return setup(parse(argv[1]));
  if (command === 'demo') return demo();
  if (command === 'backup') return backupWorkspace(argv[1]);
  if (command === 'restore') { if (!argv[1]) throw Error('Backup source required'); return restoreWorkspace(argv[1], argv[2]); }
  if (command === 'connection-plan' || command === 'connect-google') return connectGoogle(parse(argv[1]), command === 'connect-google');
  const w = openWorkspace();
  try {
    switch (command) {
      case 'connector-report': return recordConnectorReport(w.home, parse(argv[1]));
      case 'search': return { results: w.crm.search(w.token, argv.slice(1).join(' ')) };
      case 'list': return { results: w.crm.list(w.token, argv[1] === undefined ? undefined : z.enum(['person','company','opportunity','task','activity']).parse(argv[1])) };
      case 'read': return w.crm.read(w.token, z.string().uuid().parse(argv[1]));
      case 'create': return w.crm.create(w.token, z.enum(['person','company','opportunity','task','activity']).parse(argv[1]), parse(argv[2]));
      case 'update': return w.crm.update(w.token, z.string().uuid().parse(argv[1]), z.coerce.number().int().positive().parse(argv[2]), parse(argv[3]));
      case 'assert': return { assertion: w.crm.assert(w.token, z.string().uuid().parse(argv[1]), parse(argv[2])) };
      case 'prepare': return w.crm.prepare(w.token, parse(argv[1]));
      case 'approve': return w.crm.approve(w.token, z.string().uuid().parse(argv[1]), z.string().min(1).parse(argv[2]));
      case 'revoke': return w.crm.revoke(w.token, z.string().uuid().parse(argv[1]));
      case 'action': return w.crm.action(w.token, z.string().uuid().parse(argv[1]));
      case 'inbox-enqueue': return { accepted: w.crm.enqueue(w.token, z.string().min(1).parse(argv[1]), z.string().min(1).parse(argv[2]), parse(argv[3])) };
      case 'inbox-process': return { processed: w.crm.processEvent(w.token, z.string().min(1).parse(argv[1]), z.string().min(1).parse(argv[2])) };
      case 'audit': return { pipeline: w.crm.pipelineHealth(w.token), workflows: workflowCatalog() };
      case 'proactive': return executeAgentPlan(w.crm, w.token, planAgentEvent(w.crm, w.token, { type: 'pipeline.audit' }), 'dry-run');
      case 'agent-plan': return planAgentEvent(w.crm, w.token, parse(argv[1]));
      case 'agent-run': {
        if (argv[2] && argv[2] !== 'dry-run') throw Error('Automated live execution is disabled in this preview. Use the reviewed host-agent procedures.');
        return executeAgentPlan(w.crm, w.token, planAgentEvent(w.crm, w.token, parse(argv[1])), 'dry-run');
      }
      case 'onboarding': return readState(w.home);
      default: throw Error(`Unknown command: ${command}. See docs/COMMANDS.md.`);
    }
  } finally { w.crm.close(); }
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  execute(process.argv.slice(2)).then(result => console.log(JSON.stringify(result, null, 2))).catch(error => {
    console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) })); process.exitCode = 1;
  });
}
