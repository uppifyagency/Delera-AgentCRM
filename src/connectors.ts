// Desired operation inventory, not a claim of implemented or authorized tools.
export type ConnectorDefinition = {
  id: string;
  label: string;
  category: 'external' | 'host-runtime';
  authentication: string;
  read: readonly string[];
  write: readonly string[];
  crmWorkflows: readonly string[];
};

export const CONNECTOR_DEFINITIONS: readonly ConnectorDefinition[] = [
  {
    id: 'gmail', label: 'Gmail', category: 'external', authentication: 'Codex app oppure Google OAuth',
    read: ['profilo', 'ricerca email', 'lettura email e thread', 'allegati', 'etichette', 'bozze'],
    write: ['creazione e aggiornamento bozze', 'invio email', 'inoltro', 'etichette', 'archiviazione', 'cestino'],
    crmWorkflows: ['gmail-new-lead', 'email-opportunity', 'email-follow-up', 'proposal-email', 'stale-reminders'],
  },
  {
    id: 'google-calendar', label: 'Google Calendar', category: 'external', authentication: 'Codex app oppure Google OAuth',
    read: ['profilo', 'calendari', 'eventi', 'ricerca eventi', 'disponibilità', 'partecipanti'],
    write: ['creazione evento', 'aggiornamento', 'cancellazione', 'risposta invito', 'etichette evento'],
    crmWorkflows: ['calendar-activity', 'meeting-notes', 'stale-reminders', 'closed-opportunity'],
  },
  {
    id: 'google-drive', label: 'Google Drive', category: 'external', authentication: 'Codex app oppure Google OAuth',
    read: ['profilo', 'ricerca file', 'metadati', 'revisioni', 'commenti', 'cartelle', 'export'],
    write: ['creazione file e cartelle', 'upload', 'copia', 'aggiornamento', 'condivisione', 'commenti'],
    crmWorkflows: ['opportunity-proposal', 'proposal-email', 'pipeline-report', 'closed-opportunity'],
  },
  {
    id: 'google-docs', label: 'Google Docs', category: 'external', authentication: 'tramite Google Drive / Codex app oppure Google OAuth',
    read: ['testo documento', 'paragrafi', 'tabelle', 'intervalli di testo', 'commenti'],
    write: ['creazione documento', 'aggiornamento testo', 'tabelle', 'commenti'],
    crmWorkflows: ['meeting-notes', 'opportunity-proposal', 'closed-opportunity'],
  },
  {
    id: 'google-sheets', label: 'Google Sheets', category: 'external', authentication: 'tramite Google Drive / Codex app oppure Google OAuth',
    read: ['metadati foglio', 'celle', 'intervalli', 'righe pipeline', 'commenti'],
    write: ['creazione foglio', 'scrittura celle', 'aggiornamento intervalli', 'duplicazione tab', 'commenti'],
    crmWorkflows: ['pipeline-report'],
  },
  {
    id: 'google-slides', label: 'Google Slides', category: 'external', authentication: 'strumenti ospiti oppure integrazione OAuth aggiuntiva',
    read: ['testo presentazione', 'outline', 'slide', 'tabelle', 'commenti', 'thumbnail'],
    write: ['creazione da template', 'aggiornamento presentazione', 'slide', 'tabelle', 'commenti'],
    crmWorkflows: ['opportunity-proposal'],
  },
  {
    id: 'google-tasks', label: 'Google Tasks', category: 'external', authentication: 'Google OAuth incrementale',
    read: ['liste attività', 'task', 'stato', 'scadenze', 'note', 'task completati'],
    write: ['creazione task', 'aggiornamento', 'completamento', 'riapertura', 'cancellazione'],
    crmWorkflows: ['email-follow-up', 'task-sync', 'closed-opportunity'],
  },
  {
    id: 'google-contacts', label: 'Google Contacts / People', category: 'external', authentication: 'Google OAuth incrementale',
    read: ['profili contatto', 'email e telefoni', 'organizzazioni', 'gruppi', 'ricerca contatti'],
    write: ['creazione contatto', 'aggiornamento', 'unione dati deduplicati', 'gruppi'],
    crmWorkflows: ['contacts-sync', 'gmail-new-lead'],
  },
  {
    id: 'slack', label: 'Slack', category: 'external', authentication: 'Codex app',
    read: ['workspace', 'canali', 'utenti', 'messaggi', 'thread', 'file', 'canvas'],
    write: ['messaggi', 'bozze', 'messaggi programmati', 'reazioni', 'canvas', 'promemoria'],
    crmWorkflows: [],
  },
  {
    id: 'documents', label: 'Documents runtime', category: 'host-runtime', authentication: 'strumenti disponibili nella sessione ospite',
    read: ['DOCX e documenti locali', 'struttura e testo', 'render per verifica'],
    write: ['creazione e modifica documenti', 'redline e commenti', 'render verificato'],
    crmWorkflows: ['meeting-notes', 'opportunity-proposal'],
  },
  {
    id: 'pdf', label: 'PDF runtime', category: 'host-runtime', authentication: 'strumenti disponibili nella sessione ospite',
    read: ['testo PDF', 'tabelle', 'metadati', 'pagine renderizzate', 'moduli'],
    write: ['creazione PDF', 'compilazione moduli', 'render e verifica'],
    crmWorkflows: ['opportunity-proposal', 'closed-opportunity'],
  },
  {
    id: 'spreadsheets', label: 'Spreadsheets runtime', category: 'host-runtime', authentication: 'strumenti disponibili nella sessione ospite',
    read: ['XLSX, XLS, CSV, TSV', 'formule', 'fogli', 'grafici', 'stili'],
    write: ['creazione e modifica fogli', 'formule', 'formattazione', 'grafici', 'ricalcolo'],
    crmWorkflows: ['pipeline-report'],
  },
  {
    id: 'presentations', label: 'Presentations runtime', category: 'host-runtime', authentication: 'strumenti disponibili nella sessione ospite',
    read: ['PPTX e slide', 'layout', 'note', 'elementi visivi'],
    write: ['creazione e modifica deck', 'layout', 'speaker notes', 'render e verifica'],
    crmWorkflows: ['opportunity-proposal'],
  },
  {
    id: 'sites', label: 'Sites', category: 'external', authentication: 'Codex app',
    read: ['siti', 'versioni', 'deployment', 'log', 'database overview e righe'],
    write: ['creazione sito', 'salvataggio versione', 'deploy', 'metadata', 'domini', 'variabili ambiente'],
    crmWorkflows: [],
  },
] as const;
