# Comandi per l’agente

Esegui dalla cartella del pacchetto. L’utente può usare solo la chat: questi comandi sono per l’agente che dispone di esecuzione locale.

## Avvio

`node scripts/start.mjs doctor` verifica runtime e prerequisiti senza installare.

`node scripts/start.mjs` installa le dipendenze mancanti tramite `npm ci`, compila e mostra lo stato. La prima volta risponde `needs-personal-setup`.

`node dist/src/agentcrm.js init '{"organization":"Example Company","owner":"owner@example.invalid","timezone":"Europe/Rome","host":"chatgpt-work"}'`

L’esempio è fittizio: sostituisci i campi con quelli confermati. `host` accetta `chatgpt-work`, `claude-cowork`, `codex`, `other`. `googleAccount` è opzionale se diverso dal proprietario. L’init identico è ripetibile; un proprietario diverso richiede una cartella nuova.

## Uso quotidiano

Prefisso dei comandi seguenti: `node dist/src/agentcrm.js`.

| Comando | Effetto |
| --- | --- |
| `start` / `status` | Core, profilo, pipeline, registri e limiti; non apre OAuth né schedula job |
| `demo` | Crea/riusa dati fittizi solo in `.agentcrm-demo`; restituisce contatti e pipeline |
| `list [person\|company\|opportunity\|task\|activity]` | Elenco completo della categoria o di tutti i record |
| `search testo` | Ricerca locale testuale, massimo 100 risultati; usare `list` per report completi |
| `read ID` | Record, corpo e versione |
| `create KIND JSON` | Crea un record locale validato |
| `update ID VERSION JSON` | Sostituisce il corpo completo con verifica di versione |
| `audit` | Qualità pipeline e catalogo workflow, nessun effetto esterno |
| `proactive` | Registra una simulazione di audit, senza contattare clienti |
| `agent-plan JSON` | Piano da evento validato, non persistito |
| `agent-run JSON dry-run` | Registra piano/esito di simulazione; zero scritture su Google |
| `connector-report JSON` | Registra il controllo riferito dall’agente, non una credenziale |
| `connection-plan JSON` | Prossimo consenso diretto per le sole capability richieste |
| `connect-google JSON` | Un singolo passo OAuth desktop opzionale, vedi OAUTH.md |
| `onboarding` | Stato delle scelte e approvazioni di onboarding |
| `backup [NUOVO_FILE]` | Snapshot DB cifrato, senza sovrascrivere destinazioni esistenti |
| `restore FILE [NUOVO_DB]` | Ripristino separato, in quarantena; non sostituisce il DB corrente |

Esempi di corpi compatibili:

```json
{"name":"Anna Esempio","email":"anna@example.invalid"}
```

```json
{"title":"Progetto esempio","owner":"owner@example.invalid","stage":"qualified","value":12000,"currency":"EUR","nextStep":"Confermare discovery","nextStepDue":"2030-01-10T09:00:00.000Z"}
```

Per `person` sono ammessi `name`, `email?`, `companyId?`; per `company`: `name`, `domain?`; per `task`: `title`, `owner`, `status` (`open/doing/done/cancelled`), `due?`, `links` (array di ID); per `activity`: `description`, `links`. Le fasi opportunità sono `new/qualified/proposal/won/lost`. Owner e referenze devono esistere nella stessa organizzazione. Al momento la CLI configura un solo proprietario; non aggiungere arbitrariamente altri utenti.

Le date degli esempi non sono impegni reali. I campi non presenti nello schema vengono rifiutati; non inventare `contactId` sulle opportunità. Per collegare contatto e opportunità usa un’attività con entrambi gli ID e la sua fonte, finché lo schema non viene esteso.

Esempio di report del connettore:

```json
{"connector":"gmail","account":"owner@example.invalid","session":"sessione-corrente","read":["profile","search"],"write":[],"evidence":"Lettura minima eseguita; riferimento risposta, nessun contenuto sensibile"}
```

`write` contiene solo capacità effettivamente provate; quelle soltanto esposte possono essere annotate nell’evidenza. L’esempio non deve essere registrato come verifica reale.

## API del core per sviluppo

`assert ID JSON` aggiunge provenienza secondo lo schema del core. `prepare`, `approve`, `revoke`, `action`, `inbox-enqueue` e `inbox-process` sono operazioni di basso livello prevalentemente sintetiche: non sono un ponte ai connettori dell’app e non autorizzano a dichiarare un invio reale completato. Leggi il codice e i test prima di usarle. `agent-run live` è intenzionalmente rifiutato nella preview.

## Stato e distribuzione

Il runtime personale è `.agentcrm` nella cartella concessa; la demo è `.agentcrm-demo`. L’override facoltativo `DELERA_AGENTCRM_HOME` accetta un percorso assoluto privato; non importare variabili del progetto originario. Non cambiare variabili globali di sistema. I collegamenti simbolici nel percorso runtime sono rifiutati.

`npm run verify` esegue i test e una prova d’installazione da esportazione pulita; richiede rete e crea solo cartelle temporanee proprie.

`node scripts/package.mjs /percorso/nuovo/Delera-AgentCRM` esporta una selezione esplicita di sorgenti, documentazione ed esempi, con checksum. Non include runtime, database, chiavi, dipendenze o output di build. Non sovrascrive una destinazione esistente.
