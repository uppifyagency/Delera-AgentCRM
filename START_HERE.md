# Delera-AgentCRM

Il tuo CRM assistito da un agente. Cartella personale, pipeline ordinata, azioni tracciate e collegamenti ai tuoi account.

## Per iniziare

1. Estrai lo ZIP in una cartella nuova. In ChatGPT Work o Claude Cowork, rendi questa cartella accessibile all’agente. Per i file sul computer scegli una modalità con accesso ai file locali.
2. Copia questo messaggio nella conversazione:

   **«Leggi START_HERE.md e docs/AGENT_PLAYBOOK.md. Avvia il mio Delera-AgentCRM da questa cartella: verifica l’ambiente, chiedimi solo i dati personali mancanti e riutilizza i connettori già verificati. Guidami nelle autorizzazioni mancanti, una alla volta. Mostrami prima la demo locale, poi la mia pipeline. Non inviare messaggi o modificare account esterni senza l’approvazione richiesta dalla policy.»**

3. Fornisci il nome dell’organizzazione, la tua email e il fuso orario. Completa personalmente eventuali schermate di login e consenso. L’agente si occupa dei passaggi tecnici consentiti dal suo ambiente.

Non inserire password, codici di accesso o token nella chat. Ogni persona usa i propri account: questo pacchetto non ne contiene nessuno.

## Cosa troverai

- CRM locale con aziende, persone, opportunità, task e attività; audit della pipeline e backup cifrati.
- Demo con due contatti, tre opportunità, un task, un’attività e una bozza email **locale**, senza operazioni sui tuoi account.
- Procedura di avvio ripetibile, mappa lettura/scrittura dei connettori e istruzioni per i dodici workflow CRM.
- Regole di autonomia, controlli prima delle scritture e registro delle verifiche dei connettori.

## Stato della versione

**0.2.0-preview — starter operativo assistito dall’agente, non servizio autonomo 24/7.** Il core locale è eseguibile; l’agente può orchestrare gli strumenti realmente disponibili nella sua sessione. Il pacchetto non include un ponte automatico verso gli MCP dell’app né dodici esecutori completi in background. Gli OAuth personali, le capacità di scrittura e gli eventuali job vanno verificati nell’ambiente di chi lo riceve. Work e Cowork non sono stati collaudati end-to-end con un secondo account.

Richiede un ambiente con file persistenti, esecuzione comandi, Node.js 22.23+ della serie 22 e accesso alla rete per la prima installazione. Se manca uno di questi elementi, l’agente deve segnalarlo; caricare solo un allegato in una chat non garantisce l’esecuzione del CRM.

## Dopo il primo avvio

Chiedi: «Avvia il CRM», «Mostrami pipeline e prossime azioni», «Controlla duplicati e opportunità ferme» oppure «Prepara il follow-up, senza inviarlo».

Per regalarlo a un’altra persona, condividi **lo ZIP pulito originale**. Non condividere la cartella dopo averla usata: conterrà anche i tuoi dati privati in `.agentcrm`. Per una nuova esportazione pulita segui [PRIVACY.md](docs/PRIVACY.md).

Manuale agente: [AGENT_PLAYBOOK.md](docs/AGENT_PLAYBOOK.md). Copertura reale: [WORKFLOWS.md](docs/WORKFLOWS.md). Compatibilità: [COMPATIBILITY.md](docs/COMPATIBILITY.md).
