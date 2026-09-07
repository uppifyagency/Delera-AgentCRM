export const WORKFLOW_DEFINITIONS = [
  { id: 'gmail-new-lead', label: 'Gmail → nuovo lead/contatto', google: ['gmail.read'] },
  { id: 'email-opportunity', label: 'Email → opportunità esistente', google: ['gmail.read'] },
  { id: 'email-follow-up', label: 'Email ricevuta → task di follow-up', google: ['gmail.read', 'tasks.write'] },
  { id: 'calendar-activity', label: 'Meeting Calendar → attività CRM automatica', google: ['calendar.read'] },
  { id: 'meeting-notes', label: 'Meeting concluso → note e prossime azioni', google: ['calendar.read', 'docs.write'] },
  { id: 'opportunity-proposal', label: 'Opportunità → proposta Google Docs salvata su Drive', google: ['docs.write', 'drive.write'] },
  { id: 'proposal-email', label: 'Proposta → email di invio con approvazione', google: ['gmail.write', 'drive.read'] },
  { id: 'task-sync', label: 'Task CRM → sincronizzazione con Google Tasks', google: ['tasks.read', 'tasks.write'] },
  { id: 'contacts-sync', label: 'Contatti Google → deduplicazione e sincronizzazione', google: ['contacts.read', 'contacts.write'] },
  { id: 'pipeline-report', label: 'Pipeline → report e forecast su Sheets', google: ['sheets.write'] },
  { id: 'stale-reminders', label: 'Promemoria automatici su lead inattivi o opportunità ferme', google: ['gmail.write', 'calendar.write'] },
  { id: 'closed-opportunity', label: 'Chiusura vinta/persa → aggiornamento documenti, task e calendario', google: ['docs.write', 'tasks.write', 'calendar.write'] },
] as const;

export type WorkflowId = typeof WORKFLOW_DEFINITIONS[number]['id'];
export type WorkflowMode = 'google-connected' | 'codex-apps' | 'local-synthetic';

export type WorkflowStatus = {
  id: WorkflowId;
  label: string;
  active: false;
  registered: true;
  connectionReady: boolean;
  execution: 'agent-assisted';
  mode: WorkflowMode;
  initializedAt: string;
  googleCapabilities: readonly string[];
  nextStep: string;
};

export type CRMBootstrap = {
  core: {
    active: true;
    mode: 'local-synthetic';
    capabilities: readonly string[];
  };
  workflows: WorkflowStatus[];
  initializedAt: string;
};

export function allWorkflowCapabilities() {
  return [...new Set(WORKFLOW_DEFINITIONS.flatMap(definition => definition.google))];
}

function hasAll(available: ReadonlySet<string>, required: readonly string[]) {
  return required.every(capability => available.has(capability));
}

const CORE_CAPABILITIES = [
  'records',
  'ownership-and-links',
  'optimistic-versioning',
  'evidence-provenance',
  'inbox-idempotency',
  'approval-revoke-dispatch',
  'recovery-and-quarantine',
  'encrypted-backup',
] as const;

export function bootstrapCRM(googleConnected: boolean, now = new Date().toISOString(), provider: 'google-connected' | 'codex-apps' = 'google-connected', availableCapabilities?: ReadonlySet<string>): CRMBootstrap {
  return {
    core: { active: true, mode: 'local-synthetic', capabilities: CORE_CAPABILITIES },
    workflows: WORKFLOW_DEFINITIONS.map(definition => {
      const connected = googleConnected || (availableCapabilities ? hasAll(availableCapabilities, definition.google) : false);
      return {
      id: definition.id,
      label: definition.label,
      active: false as const,
      registered: true as const,
      connectionReady: connected,
      execution: 'agent-assisted' as const,
      mode: connected ? provider : 'local-synthetic',
      initializedAt: now,
      googleCapabilities: definition.google,
      nextStep: connected ? 'requires-agent-execution-and-verification' : 'verify-personal-connectors',
      };
    }),
    initializedAt: now,
  };
}
