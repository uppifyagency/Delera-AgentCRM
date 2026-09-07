import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
export function privateHome(requested=process.env.DELERA_AGENTCRM_HOME ?? resolve(import.meta.dirname,'../../.agentcrm')) {
  if(!isAbsolute(requested))throw Error('runtime path must be absolute');
  const target=resolve(requested),repo=resolve(import.meta.dirname,'../..');
  for(let p=target;;p=dirname(p)) {if(existsSync(p)&&lstatSync(p).isSymbolicLink())throw Error('runtime symlink forbidden');if(dirname(p)===p)break;}
  const inside=relative(repo,target);
  const outside=inside==='..'||inside.startsWith(`..${sep}`)||isAbsolute(inside);
  if(target===repo||(!outside&&!['.agentcrm','.agentcrm-demo'].includes(inside.split(sep)[0])))throw Error('runtime inside bundle must be .agentcrm or .agentcrm-demo');
  mkdirSync(target,{recursive:true,mode:0o700});
  if((lstatSync(target).mode&0o077)!==0)throw Error('runtime directory permissions must be 0700');
  return realpathSync(target);
}
const stateSchema=z.object({schemaVersion:z.literal(1),answers:z.record(z.string(),z.unknown()),pending:z.array(z.string()),activationAuthorized:z.boolean(),reminders:z.object({count:z.number().int().nonnegative(),lastSentAt:z.string().nullable(),maxCount:z.literal(3),minimumHours:z.literal(72)})}).passthrough();
export type OnboardingState=z.infer<typeof stateSchema>;
export function readState(home:string):OnboardingState {
  const p=join(home,'onboarding.json');const stat=lstatSync(p);
  if(stat.isSymbolicLink()||(stat.mode&0o077)!==0)throw Error('private state permissions must be 0600');
  return stateSchema.parse(JSON.parse(readFileSync(p,'utf8')));
}
export function writeState(home:string,state:OnboardingState) {
  stateSchema.parse(state);const tmp=join(home,'onboarding.json.next');
  writeFileSync(tmp,JSON.stringify(state,null,2)+'\n',{mode:0o600,flag:'wx'});renameSync(tmp,join(home,'onboarding.json'));
}
const requests:Record<string,{why:string;unlocks:string;how:string;verification:string}>={
 'codex-workspace-permission':{why:'L’agente deve poter leggere e modificare questa cartella e il suo runtime privato.',unlocks:'Gestione del CRM dalla chat dell’app ospite.',how:'Concedere solo l’accesso alla cartella quando richiesto; nessuna credenziale in chat.',verification:'Preflight completato e stato privato protetto ed escluso dall’esportazione.'},
 'google-oauth-client':{why:'Il percorso diretto opzionale necessita di un client OAuth personale quando i connettori ospiti non bastano.',unlocks:'Autorizzazione progressiva delle sole capacità richieste.',how:'Seguire docs/OAUTH.md su un ambiente desktop compatibile.',verification:'Account, scope e prova minima da verificare prima di dichiarare la connessione utilizzabile.'},
 'data-policy':{why:'Finalità, retention e destinazioni richiedono una decisione organizzativa.',unlocks:'Attivazione dei dati reali.',how:'Esaminare la proposta di policy prima dell’attivazione.',verification:'Versione approvata e enforcement verificato.'},
 'backup-destination':{why:'Occorre una copia separata e recuperabile.',unlocks:'Recupero operativo.',how:'Indicare una destinazione già disponibile e la gestione delle chiavi.',verification:'Backup AES-GCM e restore controllato con effetti esterni disabilitati.'},
 'remote-control-permission':{why:'L’accesso ad applicazioni e file richiede strumenti supportati e relativi permessi nell’app ospite.',unlocks:'Esecuzione assistita nella sessione dell’utente.',how:'Verificare strumenti disponibili e concedere solo accessi pertinenti al CRM.',verification:'Lettura minima completata sulle risorse autorizzate.'}
};
export function nextRequirement(state:OnboardingState){const id=state.pending[0];return id?{id,...requests[id]}:null;}
export function reminderDue(state:OnboardingState,now=Date.now()) {
  const requests=state.requests as Record<string,{lastRequestedAt?:string}>|undefined;
  const dates=[state.reminders.lastSentAt,typeof state.lastRequestAt==='string'?state.lastRequestAt:null,...state.pending.map(id=>requests?.[id]?.lastRequestedAt)].filter((d):d is string=>typeof d==='string').map(Date.parse);
  if(dates.some(d=>!Number.isFinite(d)))return false;
  const last=dates.length?Math.max(...dates):null;
  return state.pending.length>0&&state.reminders.count<3&&(last===null||now-last>=72*3600000);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{const state=readState(privateHome());console.log(JSON.stringify({activationAuthorized:state.activationAuthorized,next:nextRequirement(state)},null,2));}
  catch{console.error('Stato onboarding mancante, non valido o non protetto. Non è stato ricreato.');process.exitCode=1;}
}
