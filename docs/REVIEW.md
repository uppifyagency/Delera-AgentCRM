# Verifica della versione 0.2.0-preview

## Correzioni per la distribuzione

Rimossi identità, organizzazione, modello e runtime preimpostati del proprietario originale. Aggiunti profilo personale validato, ingresso comune Work/Cowork, demo separata, esportazione a lista consentita e registri dei connettori dichiaratamente riferiti dall’agente.

Il bootstrap ora registra i dodici workflow senza dichiararli in esecuzione. La presenza di variabili dell’app non viene usata come prova di accesso agli account. Lo stato distingue il core locale dai workflow esterni e non inventa uno scheduler.

Il planner valida gli eventi, usa corrispondenze email esatte e si ferma sui duplicati. Il generico live executor è bloccato prima di qualsiasi effetto: la versione di partenza poteva creare record duplicati, scegliere un account sintetico per azioni Google e lasciare applicazioni parziali del piano.

## Copertura dei test

Test locali per isolamento organizzazioni, referenze, versioni, approvazioni legate al contenuto, revoca, timeout/risposte incerte, inbox sintetica, recupero, backup e vault. I test Google usano provider fittizi. Nuovi controlli coprono profilo personale, mancata ereditarietà delle connessioni, scope Tasks selettivi, input del planner e blocco live.

`npm run verify` ripete la suite e verifica installazione da copia pulita in un percorso con spazi, primo avvio senza profilo, personalizzazione, demo ripetuta senza duplicati, separazione dati e riesportazione pulita da una cartella usata.

Vedi `VERIFICATION.md` per l’esito effettivamente rilevato nella preparazione. Questo documento non sostituisce una certificazione di sicurezza né un nuovo collaudo indipendente su altri account.

## Limiti ancora aperti

1. Nessun ponte completo e persistente tra strumenti dell’app e processo CRM. Nessuna esecuzione continua dei dodici workflow.
2. Sincronizzazione Google Tasks/Contacts non pronta per uso generalizzato: paginazione, etag, aggiornamenti parziali, mapping ID, conflitti e retry da completare. Wrapper non significa sync collaudata.
3. Il grant OAuth e il servizio read-only non sono già integrati in un servizio unificato con refresh, revoca e scope crescenti. Test callback/grant con mock, non consenso end-to-end negli host.
4. Lo schema opportunità non ha ancora legami diretti con persona/azienda; usare attività collegate e non inventare campi. Manca un valore esplicitamente “sconosciuto”.
5. Non c’è un motore forecast, un generatore commerciale Docs completo, un matcher email→opportunità robusto o un sistema di verbali attendibili senza note/trascrizioni.
6. Policy e registri dell’agente non forniscono locking distribuito o un gate di sicurezza per gli MCP esterni. Una cartella è destinata a un singolo agente scrivente.
7. Linux/Windows e Work/Cowork non certificati end-to-end; dipendenze native e accesso al filesystem devono essere collaudati nell’ambiente destinatario.

## Prossima evoluzione consigliata

Prima consolidare schema, ID evento e outbox transazionale; poi un dispatcher per-provider con approvazioni e ricevute verificabili; quindi Tasks/Contacts con conflitti e paginazione; infine ingressi Gmail/Calendar incrementali, report Docs/Sheets e scheduler con metriche. Per ogni workflow richiedere prova su campione autorizzato, riavvio, timeout, duplicato e revoca prima di abilitarne l’esecuzione automatica.
