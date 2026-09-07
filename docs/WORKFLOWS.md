# I dodici workflow CRM

Sono inclusi catalogo, istruzioni operative e alcune funzioni locali. **Nessuno dei dodici viene schedulato dal pacchetto.** Il planner supporta quattro famiglie di eventi: email ricevuta, meeting concluso, cambio fase richiesto e audit pipeline. La simulazione registra il piano, non crea lead né chiama Google.

L’agente può svolgere le procedure seguenti nella sessione, se ha accesso agli strumenti necessari e l’autorità dell’utente. Ogni procedura richiede verifiche proprie: una connessione funzionante non significa workflow collaudato.

| # | Flusso e trigger | Procedura dell’agente e verifica | Codice presente / parti mancanti |
| --- | --- | --- | --- |
| 1 | Gmail → lead/contatto | Query approvata; escludi automatiche/newsletter; verifica email esatta, duplicati e fonte; crea solo lead pertinenti e rileggi | Planner per candidato persona, CRUD e provenienza. Mancano ingestione continua, filtro commerciale robusto e replay completo |
| 2 | Email → opportunità esistente | Cerca persona e opportunità; in caso di più candidati chiedi; collega un’attività con ID messaggio e fonte | Attività con `links` disponibili. Nessun matcher completo delle opportunità o collegamento nativo persona↔opportunità nel relativo schema |
| 3 | Email → follow-up | Valuta se richiede risposta; cerca task già aperto con stessa fonte; proponi owner/scadenza; task locale, poi eventuale Tasks | Planner propone un task esterno. Mancano decisione robusta, esecutore e mapping alla lista personale |
| 4 | Calendar → attività CRM | Leggi eventi nel calendario approvato; registra una sola attività per ID evento/revisione; aggiorna senza duplicare | CRUD attività; il planner attuale gestisce meeting conclusi. Nessun trigger di calendario o checkpoint delta |
| 5 | Meeting concluso → note/azioni | Cerca note/trascrizione autorizzate; senza contenuto prepara un modello vuoto; separa decisioni confermate e azioni proposte | Planner prepara intenzione Docs e attività, non produce un verbale attendibile da solo |
| 6 | Opportunità → proposta Docs/Drive | Leggi opportunità, requisiti e template; segnala prezzi/termini mancanti; crea proposta privata; registra ID e rileggi | Intenzione di proposta nel planner. Mancano template commerciale, generatore Docs e gestione Drive automatica |
| 7 | Proposta → email con approvazione | Verifica versione/file, destinatari e accesso; prepara bozza; mostra contenuto/allegati; invia solo dopo approvazione specifica; registra ID e rileggi inviata | Catalogo e meccanismo generico di approvazione nel core. Nessun esecutore Gmail collegato; approvazione interna non autorizza implicitamente strumenti dell’app |
| 8 | Task CRM ↔ Google Tasks | Lista dedicata, ID remoto e versione; definisci quale sistema prevale; confronta prima di scrivere; non cancellare task sconosciuti | Wrappers read/write con mock. Mancano mapping durevole, paginazione completa, conflitti, tombstone e retry sicuro |
| 9 | Contacts ↔ CRM | Email normalizzata; nomi uguali sono solo candidati; preserva campi non CRM ed etag; approva fusioni e rileggi | Wrappers e dedup preliminare. Nessun motore di sync completo; update contatti non pronto per uso indiscriminato |
| 10 | Pipeline → report/forecast Sheets | Leggi tutti i record; separa aperte/vinte/perse e valute; usa probabilità concordate e data del report; verifica totali e formule | Audit locale e conteggi per fase. Nessun motore forecast/export Sheets; non inventare probabilità standard |
| 11 | Inattività → promemoria | Audit: owner, prossima azione, scadenza, ultimo contatto; prepara priorità locali; eventuale reminder esterno approvato | Audit eseguibile e planner con revisione umana. Nessuno scheduler o invio automatico |
| 12 | Vinta/persa → riconciliazione | Richiedi conferma e motivo; aggiorna fase, controlla task/documenti/meeting; prepara cambiamenti per approvazione; verifica ogni esito | Planner di riconciliazione, CRUD opportunità. Nessuna transazione distribuita o chiusura a cascata implementata |

## Regole comuni per operazioni reali

Una fonte ha un ID stabile e una revisione; la stessa fonte non deve produrre una seconda operazione quando si ripete un ciclo. Scrivi intenzione prima dell’effetto e ricevuta dopo. Se la chiamata cade dopo una possibile scrittura, riconcilia il risultato remoto prima del retry. Non dedurre “non eseguito” da un timeout.

La inbox del core deduplica gli eventi del suo formato sintetico, non tutte le operazioni esterne del planner. Non usarla come garanzia di exactly-once sulle API Google. Il generico live executor rimane disabilitato finché queste lacune non sono corrette e testate.

## Pipeline pulita: criteri di controllo

Ogni opportunità aperta ha titolo, owner, fase coerente, valore/valuta se noti, prossima azione e relativa scadenza se concordata. I campi ignoti restano dichiarati ignoti; lo schema attuale richiede un valore numerico, quindi non trasformare un valore sconosciuto in un preventivo confermato. Chiedi il valore o registra il candidato come attività in attesa.

Ogni task ha owner, stato e riferimenti coerenti. Le opportunità chiuse non ricevono follow-up commerciali indiscriminati. Il riepilogo distingue dati osservati, ipotesi, proposte e azioni realmente confermate.
