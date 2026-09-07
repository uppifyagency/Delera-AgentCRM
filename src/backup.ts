import Database from 'better-sqlite3';
import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {readFileSync,writeFileSync,unlinkSync,mkdtempSync,rmSync,statSync,linkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const header=Buffer.from('DCRM-BACKUP-1\n');
const maxSize=128*1024*1024;
export async function encryptedBackup(databasePath:string,destination:string,key:Buffer) {
 if(key.length!==32)throw Error('AES-256 key required');
 const temp=mkdtempSync(join(tmpdir(),'delera-crm-backup-'));const db=new Database(databasePath,{readonly:true,fileMustExist:true});
 try{
 const snapshot=join(temp,'snapshot.db');await db.backup(snapshot);
 if(statSync(snapshot).size>maxSize)throw Error('snapshot exceeds current backup limit');
 const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,nonce);cipher.setAAD(header);
 const ciphertext=Buffer.concat([cipher.update(readFileSync(snapshot)),cipher.final()]);
 writeFileSync(destination,Buffer.concat([header,nonce,cipher.getAuthTag(),ciphertext]),{mode:0o600,flag:'wx'});
 }finally{db.close();rmSync(temp,{recursive:true,force:true});}
}
export function restoreEncryptedBackup(source:string,destination:string,key:Buffer) {
 if(key.length!==32||statSync(source).size>maxSize+100)throw Error('invalid backup input');
 const data=readFileSync(source);if(!data.subarray(0,header.length).equals(header))throw Error('invalid backup header');
 const pos=header.length,decipher=createDecipheriv('aes-256-gcm',key,data.subarray(pos,pos+12));decipher.setAAD(header);decipher.setAuthTag(data.subarray(pos+12,pos+28));
 const plain=Buffer.concat([decipher.update(data.subarray(pos+28)),decipher.final()]);
 const temp=destination+'.restoring';writeFileSync(temp,plain,{mode:0o600,flag:'wx'});
 try{
 const db=new Database(temp);try{
 if(db.pragma('integrity_check',{simple:true})!=='ok')throw Error('invalid snapshot');
 db.exec("CREATE TABLE IF NOT EXISTS controls(key TEXT PRIMARY KEY,value TEXT NOT NULL); INSERT INTO controls VALUES ('effects_enabled','false') ON CONFLICT(key) DO UPDATE SET value='false'; UPDATE actions SET state='unknown' WHERE state='dispatching'; DELETE FROM sessions;");
 db.pragma('wal_checkpoint(TRUNCATE)');
 }finally{db.close();}
 // Exclusive creation avoids overwriting a live database; restored effects remain disabled.
 linkSync(temp,destination);
 }finally{unlinkSync(temp);}
}
