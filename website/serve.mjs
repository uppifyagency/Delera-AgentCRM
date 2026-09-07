import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'dist');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.xml':'application/xml','.txt':'text/plain'};
const server=createServer((req,res)=>{try{const url=new URL(req.url,'http://127.0.0.1');const path=resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(!path.startsWith(root+'/')||!existsSync(path)||!statSync(path).isFile()){res.writeHead(404);res.end('Not found');return;}res.writeHead(200,{'Content-Type':types[extname(path)]??'application/octet-stream','X-Content-Type-Options':'nosniff'});res.end(readFileSync(path));}catch{res.writeHead(400);res.end('Bad request');}});
server.listen(0,'127.0.0.1',()=>console.log(`Local: http://127.0.0.1:${server.address().port}`));
