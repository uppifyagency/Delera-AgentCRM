import {OAuth2Client,CodeChallengeMethod,type Credentials} from 'google-auth-library';
import {createServer} from 'node:http';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {spawn} from 'node:child_process';
import {existsSync,readFileSync,lstatSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {z} from 'zod';
import {Vault} from './vault.js';
import {privateHome,readState} from './onboarding.js';
export const GOOGLE_SCOPES={
 identity:['openid','https://www.googleapis.com/auth/userinfo.email'],
 gmailRead:['https://www.googleapis.com/auth/gmail.readonly'],
 gmailWrite:['https://www.googleapis.com/auth/gmail.compose'],
 calendarRead:['https://www.googleapis.com/auth/calendar.readonly'],
 calendarWrite:['https://www.googleapis.com/auth/calendar.events'],
 driveMetadata:['https://www.googleapis.com/auth/drive.metadata.readonly'],
 driveRead:['https://www.googleapis.com/auth/drive.readonly'],
 driveWrite:['https://www.googleapis.com/auth/drive.file'],
 docsWrite:['https://www.googleapis.com/auth/documents'],
 sheetsWrite:['https://www.googleapis.com/auth/spreadsheets'],
 tasksRead:['https://www.googleapis.com/auth/tasks.readonly'],
 tasksWrite:['https://www.googleapis.com/auth/tasks'],
 contactsRead:['https://www.googleapis.com/auth/contacts.readonly'],
 contactsWrite:['https://www.googleapis.com/auth/contacts'],
} as const;
export const ALL_GOOGLE_CAPABILITIES=(Object.keys(GOOGLE_SCOPES) as (keyof typeof GOOGLE_SCOPES)[]).filter(capability=>capability!=='identity');
export const GOOGLE_CONNECTION_STEPS=['identity',...ALL_GOOGLE_CAPABILITIES] as const;
export type GoogleCapability=keyof typeof GOOGLE_SCOPES;
const GOOGLE_STEP_CAPABILITIES:Record<GoogleCapability,readonly string[]>= {
 identity:['identity'], gmailRead:['gmail.read'], gmailWrite:['gmail.write'], calendarRead:['calendar.read'], calendarWrite:['calendar.write'],
 driveMetadata:['drive.metadata.read'], driveRead:['drive.read'], driveWrite:['drive.write'], docsWrite:['docs.write'], sheetsWrite:['sheets.write'],
 tasksRead:['tasks.read'], tasksWrite:['tasks.write'], contactsRead:['contacts.read'], contactsWrite:['contacts.write'],
};
export function verifyCallback(requestUrl:string,expectedState:string){const url=new URL(requestUrl,'http://127.0.0.1');const state=url.searchParams.get('state')??'';if(url.pathname!=='/callback'||Buffer.byteLength(state)!==Buffer.byteLength(expectedState)||!timingSafeEqual(Buffer.from(state),Buffer.from(expectedState))||url.searchParams.has('error'))throw Error('invalid OAuth callback');const code=url.searchParams.get('code');if(!code||code.length>4096)throw Error('authorization code missing');return code;}
export type GoogleCredential={account:string;subject:string;scopes:string[];tokens:Credentials;verifiedAt:string};

export function readGoogleCredential(home:string):GoogleCredential|null {
 const path=join(home,'google-vault','credentials.enc');
 if(!existsSync(path))return null;
 return new Vault(join(home,'google-vault')).get<GoogleCredential>('credentials');
}

export function nextGoogleConnectionStep(home:string,connectedCapabilities:readonly string[]=[],requested:readonly GoogleCapability[]=GOOGLE_CONNECTION_STEPS){
 const credential=readGoogleCredential(home);
 const granted=new Set(credential?.scopes??[]);
 const connected=new Set(connectedCapabilities);
 for(const step of requested){
  const required=GOOGLE_SCOPES[step];
  const stepCapabilities=GOOGLE_STEP_CAPABILITIES[step];
  const alreadyConnected=stepCapabilities.length>0&&stepCapabilities.every(capability=>connected.has(capability));
  if(!alreadyConnected&&required.some(scope=>!granted.has(scope))){
   return {
    step,
    requiredScopes:required,
    capabilities:[...new Set<GoogleCapability>(['identity',step,...GOOGLE_CONNECTION_STEPS.filter(previous=>GOOGLE_SCOPES[previous].every(scope=>granted.has(scope)))])],
    completed:requested.filter(previous=>{
     const capabilities=GOOGLE_STEP_CAPABILITIES[previous];
     return (capabilities.length>0&&capabilities.every(capability=>connected.has(capability)))||GOOGLE_SCOPES[previous].every(scope=>granted.has(scope));
    }),
   };
  }
 }
 return null;
}
export interface GrantProvider {
 exchange(code:string,verifier:string):Promise<Credentials>;
 identity(idToken:string,audience:string):Promise<{email?:string;email_verified?:boolean;sub:string}|undefined>;
 scopes(accessToken:string):Promise<string[]>;
}
export async function finishGoogleGrant(provider:GrantProvider,request:{code:string;verifier:string;audience:string;expectedAccount:string;scopes:string[]},active:()=>boolean,persist:(c:GoogleCredential)=>void):Promise<GoogleCredential>{
 const guard=()=>{if(!active())throw Error('OAuth authorization expired');};guard();
 const tokens=await provider.exchange(request.code,request.verifier);guard();
 if(!tokens.id_token||!tokens.access_token||!tokens.refresh_token)throw Error('required OAuth credentials missing');
 const identity=await provider.identity(tokens.id_token,request.audience);guard();
 if(!identity?.email_verified||identity.email?.toLowerCase()!==request.expectedAccount.toLowerCase())throw Error('account mismatch');
 const scopes=await provider.scopes(tokens.access_token);guard();
 if(request.scopes.some(s=>!scopes.includes(s)))throw Error('required scope missing');
 const credential:GoogleCredential={account:identity.email,subject:identity.sub,scopes,tokens,verifiedAt:new Date().toISOString()};
 guard();persist(credential);return credential;
}
export async function authorizeGoogle(home:string,expectedAccount:string,capabilities:(keyof typeof GOOGLE_SCOPES)[]=['identity']){
 const clientPath=join(home,'google-client.json');const stat=lstatSync(clientPath);if(stat.isSymbolicLink()||(stat.mode&0o077)!==0)throw Error('OAuth client file must be private');
 const config=z.object({installed:z.object({client_id:z.string().min(1),client_secret:z.string().optional()})}).parse(JSON.parse(readFileSync(clientPath,'utf8'))).installed;
 const state=randomBytes(32).toString('hex'),vault=new Vault(join(home,'google-vault'));
 const scopes=[...new Set([...GOOGLE_SCOPES.identity,...capabilities.flatMap(c=>GOOGLE_SCOPES[c])])];
 const server=createServer();await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 const address=server.address();if(!address||typeof address==='string')throw Error('callback unavailable');
 const client=new OAuth2Client({clientId:config.client_id,clientSecret:config.client_secret,redirectUri:`http://127.0.0.1:${address.port}/callback`});
 const codes=await client.generateCodeVerifierAsync();
 try{return await new Promise<GoogleCredential>((resolve,reject)=>{
 let used=false,terminal=false;const deadline=Date.now()+10*60*1000;const timeout=setTimeout(()=>{terminal=true;reject(Error('OAuth authorization expired'));},10*60*1000);
 server.on('request',async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('Content-Security-Policy',"default-src 'none'");
 let code:string;try{if(req.method!=='GET'||used)throw Error('callback already used');code=verifyCallback(req.url??'',state);}catch{res.writeHead(400);res.end('Richiesta non valida.');return;}
 used=true;
 try{
 const credential=await finishGoogleGrant({
 exchange:async(code,verifier)=>(await client.getToken({code,codeVerifier:verifier})).tokens,
 identity:async(idToken,audience)=>(await client.verifyIdToken({idToken,audience})).getPayload(),
 scopes:async(token)=>(await client.getTokenInfo(token)).scopes,
 },{code,verifier:codes.codeVerifier,audience:config.client_id,expectedAccount,scopes},()=>!terminal&&Date.now()<deadline,credential=>{
 const previous=vault.get<GoogleCredential>('credentials');if(previous)vault.put('credentials-before-auth',previous);
 vault.put('credentials',credential);
 });terminal=true;res.end('Account verificato. Puoi tornare al tuo AgentCRM.');clearTimeout(timeout);resolve(credential);
 }catch{res.writeHead(400);res.end('Autorizzazione non completata: account, scope o provider da verificare.');clearTimeout(timeout);reject(Error('Google authorization failed; no credentials displayed'));}
 });
 const url=client.generateAuthUrl({access_type:'offline',include_granted_scopes:true,scope:scopes,prompt:'consent',state,code_challenge:codes.codeChallenge,code_challenge_method:CodeChallengeMethod.S256});
 const browser=spawn(process.platform==='darwin'?'open':'xdg-open',[url],{stdio:'ignore'});browser.once('error',()=>{terminal=true;clearTimeout(timeout);reject(Error('open the system browser on the same device using the local onboarding flow'));});
 });}finally{server.closeAllConnections();server.close();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const home=privateHome(),state=readState(home);const email=z.string().email().parse(state.answers.googleAccount);
 authorizeGoogle(home,email,['identity']).then(()=>console.log('Google identity verified; CRM import remains disabled.')).catch(()=>{console.error('Google setup requires a private desktop client file and successful official authorization.');process.exitCode=1;});
}
