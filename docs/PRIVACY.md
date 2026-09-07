# Dati privati, backup e condivisione

## Separazione dei dati

La cartella pulita contiene esclusivamente sorgenti, test fittizi, manuali ed esempi. Al primo uso viene creata `.agentcrm` con profilo, database, sessione locale, policy e registri. La demo usa `.agentcrm-demo`.

Non condividere una cartella già utilizzata come se fosse un template. Non sincronizzarla in una cartella pubblica o condivisa indiscriminatamente. I test generano credenziali fittizie; non sono accessi funzionanti.

Le connessioni gestite dall’app rimangono nell’app. Il bundle non cerca, legge, esporta o importa i suoi token. Un percorso OAuth diretto, se scelto, salva il client personale e il vault soltanto nel runtime privato.

## Protezioni e limiti

- Directory runtime private `0700`, file privati `0600` su sistemi con permessi POSIX; rifiuto dei symlink lungo il percorso. Nessuna garanzia Windows/ACL senza verifica dedicata.
- Il database locale **non è cifrato**; contiene i dati CRM in chiaro protetti dai permessi del filesystem. Usare protezione del dispositivo/disco e controllo degli accessi adeguati.
- Il vault cifra le credenziali, ma la chiave master locale è nello stesso runtime. Chi possiede l’intera cartella privata può recuperare i segreti; la cifratura non sostituisce la sicurezza del dispositivo.
- I backup del database sono cifrati AES-GCM. La chiave `backup.key` è separata dal file di backup ma resta nel runtime: conservarne una copia protetta separata. Il backup DB non è una copia completa di profilo, policy, documenti o credenziali Google.
- Il restore crea un DB separato in quarantena, senza riattivare effetti o sessioni. Non attivarlo copiandolo sopra il DB corrente; effettuare una revisione/migrazione esplicita.
- Il controllo degli MCP dell’app segue i permessi e la policy dell’app e dell’utente. La CLI non può impedirne gli usi esterni né garantire che un altro agente segua il playbook.

## Condivisione pulita

La scelta più semplice è inviare lo ZIP originale non personalizzato. Per redistribuire modifiche al template, esegui l’esportazione in una destinazione nuova con `scripts/package.mjs`.

L’esportatore usa una lista consentita e non copia `.agentcrm`, `.agentcrm-demo`, `node_modules`, `dist`, database, chiavi o backup. Rifiuta symlink e alcuni pattern di credenziali. È una protezione aggiuntiva, **non un sistema completo di rilevazione dati personali**: se hai scritto nomi reali o dati di clienti nei manuali, nei test o nei sorgenti, devi rimuoverli prima di condividere.

Revisiona i file esportati e i checksum, poi comprimi soltanto l’esportazione pulita. Non inserire nel pacchetto il DB del proprietario originario, i suoi documenti, le sue bozze email o gli ID delle sue automazioni.
