# Compatibilità e aspettative

## ChatGPT Work

Usa una sessione con accesso alla cartella e strumenti di esecuzione. Per i file sul computer la documentazione indica il lavoro locale; Work desktop può usare file, applicazioni e browser quando gli strumenti sono disponibili. Il pacchetto richiede anche runtime Node compatibile e persistenza dei dati. Questi prerequisiti vanno provati nella sessione, non dedotti dall’abbonamento. [Guida ufficiale ChatGPT Work](https://learn.chatgpt.com/docs/get-started-with-work)

## Claude Cowork

Concedi l’accesso alla cartella e chiedi esplicitamente di leggere `START_HERE.md`. Cowork documenta istruzioni specifiche per cartelle selezionate da desktop. L’esecuzione del codice può essere isolata/remota: questo richiede una verifica particolare per file persistenti, moduli nativi e callback OAuth locale. `CLAUDE.md` qui è un punto di ingresso testuale, non la promessa che ogni versione di Cowork lo carichi automaticamente. [Guida ufficiale Claude Cowork](https://support.claude.com/en/articles/13345190-get-started-with-claude-cowork)

## Requisiti indipendenti dall’app

| Elemento | Requisito / esito |
| --- | --- |
| Runtime | Node.js 22.23+ della serie 22, npm; verificato sul runtime della macchina di preparazione |
| Dipendenze | Installazione da lockfile; rete necessaria al primo avvio; `better-sqlite3` è nativo e può richiedere tool di compilazione se non esiste un binario compatibile |
| File | Lettura/scrittura persistente della cartella; symlink e permessi runtime non privati vengono rifiutati |
| Sistema operativo | Core collaudato su macOS; Linux desktop plausibile ma non testato qui; Windows non certificato per permessi/vault e callback OAuth |
| Connettori | Forniti dall’app ospite oppure integrazione diretta aggiuntiva; mai inclusi nel pacchetto |
| Modello | Quello scelto dall’utente nel prodotto ospite; nessuna chiave LLM richiesta dal core |
| Automazioni | Solo se configurate e verificate nello scheduler ospite con accesso ai dati; nessun demone incluso |
| Collaborazione | Un proprietario e un agente scrivente per cartella; non è un CRM multiutente server |

Le istruzioni sono progettate per essere portabili. Non è stato eseguito un test end-to-end separato in ChatGPT Work o Claude Cowork con account nuovo. La verifica pubblicata riguarda il bundle locale e i suoi test. Un ambiente che può solo leggere allegati può consultare il manuale, ma non ospitare automaticamente questo database.

Riferimenti consultati il 7 settembre 2026; disponibilità degli strumenti, nomi dei controlli e policy aziendali possono cambiare. L’agente deve leggere le istruzioni e verificare l’ambiente corrente.
