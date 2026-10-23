const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../dist');
const port = Number(process.env.PORT || 3000);
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png'};
const server = http.createServer((req,res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { res.writeHead(400); return res.end('Bad request'); }
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + path.sep)) {res.writeHead(403); return res.end('Forbidden');}
  if (!['GET','HEAD'].includes(req.method)) {res.writeHead(405); return res.end();}
  fs.readFile(file,(err,data) => {
    if(err) {res.writeHead(404); return res.end('Not found');}
    res.writeHead(200,{'Content-Type':types[path.extname(file)] || 'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    res.end(req.method === 'HEAD' ? undefined : data);
  });
});
server.on('error',err=>{console.error(err.code === 'EADDRINUSE' ? 'Port '+port+' is busy. Stop your earlier Latch server with Control+C, or run: PORT='+(port+1)+' npm start' : err.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log('Latch is running at http://localhost:'+port+'\nKeep this Terminal open. Press Control+C to stop.'));
