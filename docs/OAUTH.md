# Collegamento progressivo degli account

## Prima scelta: collegamenti già presenti nell’app

L’agente scopre gli strumenti, controlla identità/accesso con una lettura minima e usa le connessioni già funzionanti. Il bundle non copia token da ChatGPT a Claude né dalle impostazioni di un altro utente. Se un account è collegato ma l’operazione richiesta non è esposta, il workflow è parziale, non “connesso completamente”.

Per ogni collegamento mancante: spiega che cosa sblocca → apri la procedura ufficiale supportata dall’app → attendi login/consenso dell’utente → verifica account e operazione → passa al prossimo servizio. Nessuna password, codice MFA o token in chat.

## Google Tasks e Contacts senza plugin dedicato

La disponibilità dei plugin dipende dall’app e dall’account e va verificata sul momento. Se Tasks manca, il CRM continua con i task locali, marcando la sincronizzazione esterna come non disponibile. Non serve sostituire Google Tasks con un altro prodotto senza decisione dell’utente.

Il codice contiene un percorso **OAuth desktop opzionale** con PKCE, state, verifica dell’email e vault cifrato. Non è un plugin universale né un servizio OAuth già registrato. Richiede un client Google Desktop personale, API abilitate, configurazione del consenso e eventuali approvazioni amministrative. L’agente guida la configurazione; la cartella da sola non può concedere queste autorizzazioni.

Configurazione per l’operatore:

1. L’ambiente che esegue il processo deve poter aprire il browser dell’utente e ricevere il callback su `127.0.0.1`. Il codice gestisce `open` su macOS e `xdg-open` su Linux desktop. In un ambiente cloud o isolato, incluso quando Cowork esegue codice da remoto, non assumere che il callback sia raggiungibile. In quel caso usare i connettori dell’app o fermare solo questo collegamento. Il percorso diretto Windows non è implementato.
2. Dopo aver verificato la documentazione ufficiale Google aggiornata, l’utente crea un client OAuth di tipo Desktop e le API necessarie. Salva il JSON ufficiale come `.agentcrm/google-client.json`, con permessi privati `0600`; non inserirlo nella conversazione né nello ZIP distribuibile.
3. Imposta il profilo con l’email Google esatta. Esegui `connection-plan` con **sole** capacità mancanti, per esempio `{"requested":["tasksRead","tasksWrite"]}`. Se Contacts è già utilizzabile nell’app, non includerlo in questa richiesta.
4. Con autorizzazione dell’utente, esegui `connect-google` con lo stesso JSON. Ogni esecuzione effettua **un solo consenso**; attende e termina con il prossimo passo. L’agente verifica il passo concluso e ripete finché tutti quelli richiesti sono completati. Non avviare più processi OAuth contemporanei.
5. L’esito “scopes salvati” non dimostra il funzionamento dell’API. Completa una prova minima in lettura per account/risorsa; una scrittura richiede il consenso appropriato. Un grant non abilita automaticamente i dodici workflow.

Le capability accettate sono `identity`, `gmailRead`, `gmailWrite`, `calendarRead`, `calendarWrite`, `driveMetadata`, `driveRead`, `driveWrite`, `docsWrite`, `sheetsWrite`, `tasksRead`, `tasksWrite`, `contactsRead`, `contactsWrite`. Il codice aggiunge identità e gli scope già posseduti al passo corrente, senza chiedere i servizi precedenti nella lista se non richiesti.

Il flusso diretto e i wrappers sono componenti per l’integrazione: il bundle non include un ponte live completo tra grant, adattatori e workflow. Per utilizzarli in produzione vanno completati refresh con client configurato, gestione revoca, paginazione, etag, mapping ID e test reali autorizzati. I test distribuiti verificano callback/grant con provider fittizi, non un consenso reale su Work o Cowork.
