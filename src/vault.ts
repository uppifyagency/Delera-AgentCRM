import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {existsSync,lstatSync,readFileSync,writeFileSync,readdirSync,renameSync} from 'node:fs';
import {join} from 'node:path';
import {privateHome} from './onboarding.js';
export class Vault {
 private key:Buffer;private home:string;
 constructor(home:string){
 this.home=privateHome(home);const path=join(home,'master.key');
 if(!existsSync(path)){
 if(readdirSync(home).length)throw Error('vault key missing; recovery required');
 writeFileSync(path,randomBytes(32),{mode:0o600,flag:'wx'});
 }
 this.check(path);this.key=readFileSync(path);if(this.key.length!==32)throw Error('invalid vault key');
 }
 private check(path:string){const s=lstatSync(path);if(!s.isFile()||s.isSymbolicLink()||(s.mode&0o077)!==0)throw Error('unsafe vault file');}
 private path(name:string){if(!/^[a-z][a-z0-9-]{0,60}$/.test(name))throw Error('invalid vault entry');return join(this.home,name+'.enc');}
 put(name:string,value:unknown){const path=this.path(name),nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',this.key,nonce);cipher.setAAD(Buffer.from(name));const json=JSON.stringify(value);if(Buffer.byteLength(json,'utf8')>1048576)throw Error('vault entry too large');const bytes=Buffer.concat([nonce,Buffer.alloc(16),cipher.update(json),cipher.final()]);cipher.getAuthTag().copy(bytes,12);const temp=path+'.'+randomBytes(8).toString('hex')+'.next';writeFileSync(temp,bytes,{mode:0o600,flag:'wx'});renameSync(temp,path);}
 get<T>(name:string):T|null {const path=this.path(name);if(!existsSync(path))return null;this.check(path);const data=readFileSync(path);if(data.length<28||data.length>1048604)throw Error('invalid vault entry');const decipher=createDecipheriv('aes-256-gcm',this.key,data.subarray(0,12));decipher.setAAD(Buffer.from(name));decipher.setAuthTag(data.subarray(12,28));return JSON.parse(Buffer.concat([decipher.update(data.subarray(28)),decipher.final()]).toString('utf8')) as T;}
}
