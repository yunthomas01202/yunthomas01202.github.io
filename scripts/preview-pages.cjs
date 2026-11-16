// 개발용 정적 미리보기. 배포 서버가 아니며 GitHub에는 실행할 필요가 없습니다.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(process.argv[2] || 'dist');
const port = Number(process.env.PORT || 8080);
const info = JSON.parse(fs.readFileSync(path.join(root, 'deployment-info.json'), 'utf8'));
const base = info.baseUrl;
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8', '.ttf': 'font/ttf', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
http.createServer((req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const pathname = decodeURIComponent(url.pathname);
    if (base && pathname === base) { res.writeHead(301, { Location: base + '/' + url.search }); res.end(); return; }
    let file;
    if (!base || pathname.startsWith(base + '/')) {
      const relative = pathname.slice(base.length).replace(/^\/+/, '') || 'index.html';
      const candidate = path.resolve(root, relative);
      if (candidate.startsWith(root + path.sep) && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) file = candidate;
    }
    if (!file) { res.statusCode = 404; file = path.join(root, '404.html'); }
    res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    fs.createReadStream(file).pipe(res);
  } catch { res.writeHead(400); res.end('Bad request'); }
}).listen(port, '0.0.0.0', () => console.log(`Pages preview: http://localhost:${port}${base}/`));
