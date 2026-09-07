# Mappa dei connettori: lettura, scrittura e disponibilità

Questa tabella descrive **le operazioni da cercare e verificare nell’app ospite**, non una lista di permessi già concessi. Tutti i collegamenti del destinatario iniziano nello stato “da verificare”. Il catalogo `src/connectors.ts` è descrittivo: non espone né implementa da solo queste operazioni.

| Servizio | Lettura utile al CRM | Scrittura da verificare separatamente | Copertura del pacchetto |
| --- | --- | --- | --- |
| Gmail | Identità, query delimitate, thread/messaggi, allegati necessari, bozze | Creazione/modifica bozza; invio; etichette/archiviazione solo se realmente esposte | Adattatore di lettura con mock e planner email. Nessun invio o sincronizzazione automatica cablati |
| Google Calendar | Calendari autorizzati, eventi, partecipanti, tempi e disponibilità | Creazione/modifica eventi, inviti/risposte, cancellazione | Adattatore di lettura e planner meeting. Scritture tramite agente/strumenti ospiti, non esecutore locale |
| Google Drive | Ricerca file/cartelle, metadati, contenuto/export se permesso | Creazione/upload/copia/spostamento; condivisione solo approvata | Adattatore per ricerca metadati. Non equivale a lettura di tutti i documenti o gestione dei permessi |
| Google Docs | Documento, struttura e fonti/template autorizzati | Creazione/modifica proposte, note e tabelle; commenti se esposti | Procedure e piani preliminari; nessun generatore Docs end-to-end locale |
| Google Sheets | Range precisi, righe, formule, metadati | Scrittura range, report/forecast, formule e grafici se supportati | Procedura di reporting; nessun export/sync automatico locale |
| Google Slides | Slide, note, template e miniature quando accessibili | Creazione/modifica presentazioni | Opzionale; catalogo, nessuna integrazione locale dedicata |
| Google Tasks | Liste, task, stato, note, scadenze, pagine successive | Crea/aggiorna/completa/riapri; cancellazioni da approvare | Wrappers API con test mock. Mancano sincronizzazione bidirezionale, conflitti e cablaggio al runner |
| Google Contacts / People | Contatti, email, telefoni e organizzazioni; gruppi se disponibili | Crea/aggiorna; fusioni e modifiche di gruppi da verificare e approvare | Wrappers API e rilevazione candidati duplicati. Fusioni automatiche non pronte; preservare etag e campi non CRM |
| Slack | Workspace/canali consentiti, messaggi/thread pertinenti | Bozze o messaggi, risposte, reazioni se disponibili | Opzionale, solo tramite strumenti ospiti. Nessun bot Slack nel bundle |
| Documents | Documenti locali, testo/struttura e rendering | DOCX, redline/commenti e render se l’app lo supporta | Capacità dell’app, non incluse come runtime documentale nel progetto |
| PDF | Testo, pagine, moduli e tabelle secondo strumenti presenti | Creazione/compilazione/render | Opzionale, delegato all’app e ai suoi strumenti |
| Spreadsheets | File XLSX/CSV/TSV, formule e grafici | Crea/modifica/ricalcola file | Opzionale, distinto dalla connessione Google Sheets |
| Presentations | PPTX, note e layout | Crea/modifica/renderizza deck | Opzionale, distinto dalla connessione Google Slides |
| Sites | Progetti e risorse del servizio se presente | Creazione, pubblicazione e permessi | Opzionale; non richiesto per il CRM. Nessun sito pubblico o hosting viene creato dal bundle |

## Come verificare un connettore

1. Scopri gli strumenti effettivi e leggi il loro contratto, senza presumere che una voce di catalogo sia chiamabile.
2. Esegui una lettura minima; verifica account e risorsa scelti dall’utente. I servizi Google possono essere connessi ad account diversi.
3. Classifica una scrittura come **esposta** finché non è provata. Con consenso specifico, crea un artefatto privato e riconoscibile `[TEST AgentCRM]`, registra l’ID e rileggilo. Non inviare email né invitare persone solo per verificare un permesso. Non cancellare artefatti di prova senza autorizzazione.
4. Registra data, sessione, nomi degli strumenti e ID/riferimento dell’esito con `connector-report`. La CLI non verifica direttamente gli MCP dell’app; il registro conserva l’evidenza riferita dall’agente. Rifai la lettura di controllo a ogni nuova sessione.

Documents/PDF/Spreadsheets/Presentations sono strumenti di lavoro su file, non credenziali universali per gli account Google. Drive può dare accesso a Docs, Sheets o Slides solo nelle operazioni e nei file davvero esposti dal relativo connettore.

## Limiti degli scope nel codice

- `drive.metadata.readonly` riguarda metadati, non contenuto; `drive.file` riguarda i file consentiti all’app e non conferisce accesso generale a tutti i file.
- `gmail.compose` è la richiesta del percorso diretto per bozze e invio; non abilita etichette/archiviazione della casella. Il fatto che uno scope consenta l’invio non autorizza l’agente a inviare.
- Lettura e scrittura Tasks/Contacts sono richieste distinte. Uno scope salvato non dimostra che l’API sia abilitata, che la credenziale sia ancora valida o che il workflow sia implementato.
- L’adattatore `GoogleReadService` accetta soltanto il suo insieme stretto di scope in sola lettura: il grant incrementale combinato non è già collegato a quel servizio. Non passargli alla cieca un token esteso.

Queste sono descrizioni del codice distribuito. Prima di usare API dirette, l’agente deve consultare la documentazione ufficiale aggiornata del servizio e verificare lo scope minimo per l’operazione scelta.
