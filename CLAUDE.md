# Delera-AgentCRM per Claude Cowork

Leggi integralmente `START_HERE.md` e `docs/AGENT_PLAYBOOK.md` e segui lo stesso contratto operativo di qualsiasi altro agente.

Se Cowork non carica automaticamente questo file, l’utente può chiederti esplicitamente di leggerlo o indicarlo nelle istruzioni della cartella. Non assumere che un file pensato per altri prodotti sia automaticamente una configurazione di Cowork.

Verifica accesso persistente alla cartella, runtime, rete e connettori nella sessione attuale. Un ambiente di esecuzione remoto non può completare automaticamente il callback OAuth locale sul computer dell’utente: preferisci i connettori ospiti, se presenti, o segnala questo limite. Non aprire un consenso sul server sbagliato e non trasferire token tra applicazioni.
