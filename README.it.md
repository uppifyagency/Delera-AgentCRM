# Delera-AgentCRM · Portable Starter

Parti da [START_HERE.md](START_HERE.md). È il punto di ingresso comune per ChatGPT Work, Claude Cowork e Codex: nessun modello, account o server MCP obbligatorio è preimpostato.

## Contenuto

| Percorso | Contenuto |
| --- | --- |
| `START_HERE.md` | Avvio per l’utente e messaggio da dare all’agente |
| `AGENTS.md`, `CLAUDE.md` | Indirizzamento alle istruzioni comuni |
| `docs/AGENT_PLAYBOOK.md` | Procedura di avvio, autonomia e ripresa |
| `docs/CONNECTORS.md` | Mappa delle operazioni da verificare |
| `docs/WORKFLOWS.md` | Dodici procedure e loro copertura effettiva |
| `docs/OAUTH.md` | Collegamento progressivo e limiti del percorso diretto |
| `docs/COMMANDS.md` | Comandi utilizzabili dall’agente |
| `docs/PRIVACY.md` | Separazione, backup e condivisione |
| `docs/REVIEW.md` | Verifiche, limiti e priorità di sviluppo |
| `src/`, `test/` | Core TypeScript/SQLite e test riproducibili |
| `examples/` | Esempi fittizi, mai account preconfigurati |

## Per chi gestisce l’ambiente

L’agente esegue dalla cartella `node scripts/start.mjs doctor`, poi `node scripts/start.mjs`. Il launcher installa le dipendenze bloccate nel lockfile se mancanti e ricompila il progetto. Dopo l’installazione, per leggere JSON senza log di compilazione, usare `node dist/src/agentcrm.js status`.

Verifica: `npm run verify`. Esportazione pulita: `node scripts/package.mjs /percorso/nuovo/Delera-AgentCRM`.

Le dipendenze e i binari nativi non vengono distribuiti: si installano per l’architettura di destinazione. Il CRM non chiama direttamente un modello e non richiede una chiave API di un fornitore LLM. Usa la sessione e gli strumenti dell’agente ospite, soggetti ai suoi permessi e limiti.

La versione conserva il nucleo del progetto CRM originario e sostituisce l’avvio personalizzato con una configurazione per destinatario. Non contiene dati della pipeline originale, bozze Gmail originali, account Google, automazioni di Codex o credenziali.
