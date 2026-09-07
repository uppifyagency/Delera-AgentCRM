import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync, renameSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const here=dirname(fileURLToPath(import.meta.url)), root=resolve(here,'..'), out=join(here,'dist');
const config=JSON.parse(readFileSync(join(here,'site.config.json'),'utf8'));
const origin=new URL(config.siteUrl).origin;
if(!origin.startsWith('https://'))throw Error('Production origin must use HTTPS');
const data={ '@context':'https://schema.org', '@graph':[
  {'@type':'WebSite','@id':`${origin}/#website`,name:'Delera-AgentCRM',url:`${origin}/`,description:'A portable, local-first AI CRM starter for agent-assisted work.',inLanguage:'en'},
  {'@type':'SoftwareSourceCode','@id':`${origin}/#source`,name:'Delera-AgentCRM',url:`${origin}/`,codeRepository:config.repository,programmingLanguage:'TypeScript',runtimePlatform:'Node.js 22.23+ (22.x)',version:config.version,description:'Local CRM core, pipeline audits, dry-run planning and twelve documented CRM procedures. Preview; no always-on executor bundled.',author:{'@type':'Organization',name:'uppifyagency',url:'https://github.com/uppifyagency'}}
]};
const html=readFileSync(join(here,'index.html'),'utf8').replaceAll('{{SITE_URL}}',origin).replaceAll('{{REPO}}',config.repository).replace('{{STRUCTURED_DATA}}',JSON.stringify(data).replaceAll('<','\\u003c'));
if(/\{\{[^}]+\}\}/.test(html))throw Error('Unresolved template variable');
// This directory contains public landing assets only, never the CRM runtime.
mkdirSync(out,{recursive:true});
writeFileSync(join(out,'index.html'),html);
for(const name of ['styles.css','app.js'])cpSync(join(here,name),join(out,name));
mkdirSync(join(out,'assets'),{recursive:true});
for(const name of ['logo.svg','architecture.svg','hero.svg'])cpSync(join(root,'assets',name),join(out,'assets',name));
writeFileSync(join(out,'robots.txt'),`User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`);
writeFileSync(join(out,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${origin}/</loc></url></urlset>\n`);
console.log(`Built Delera-AgentCRM landing: ${out}`);
