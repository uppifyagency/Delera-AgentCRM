# Esito della preparazione

Data: 7 settembre 2026. Ambiente verificato: macOS, Node.js 22.23.0, npm 10.9.8.

| Controllo | Esito |
| --- | --- |
| Compilazione TypeScript | Superata |
| Suite locale | 36 test superati, 0 falliti |
| Installazione da esportazione pulita | Superata, dipendenze installate da lockfile |
| Primo avvio in percorso con spazi | Superato; richiede un profilo personale e non eredita account |
| Profilo nuovo e riavvio | Superati; sostituzione silenziosa del proprietario rifiutata |
| Demo ripetuta | 8 record con gli stessi ID in entrambi i passaggi; zero duplicati |
| Separazione demo/personale | Superata: il runtime personale rimane vuoto fino a creazione esplicita |
| Vault nel runtime portabile | Scrittura/lettura cifrata fittizia superata |
| Riesportazione da cartella personalizzata | Esclude runtime, demo, database, dipendenze e build; 65 file distribuibili controllati dopo l’aggiunta della presentazione pubblica |
| Landing pubblica | Build statico, metadati, dati strutturati, link interni e confine dei file pubblicati verificati |
| Ricerca di identità e percorsi del creatore | Nessuna corrispondenza nei sorgenti, test e manuali distribuibili |
| Audit dipendenze di produzione | 0 vulnerabilità note riportate da npm audit al momento del controllo |
| Operazioni sugli account esterni durante la preparazione | 0 |

Le dipendenze emettono avvisi di deprecazione per componenti transitivi; l’audit senza segnalazioni non è una certificazione di sicurezza. Nessun test ha inviato email, creato contatti Google, modificato calendari o autorizzato nuovi account.

La prova locale non dimostra compatibilità end-to-end con un nuovo utente Work/Cowork, né il funzionamento reale dei dodici workflow Google. Questi controlli restano parte dell’onboarding del destinatario, come indicato in `COMPATIBILITY.md` e `WORKFLOWS.md`.
