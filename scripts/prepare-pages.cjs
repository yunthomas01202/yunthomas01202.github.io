const fs = require('node:fs');
const path = require('node:path');
const { getBaseUrl, normalizeBase } = require('./pages-config.cjs');

function preparePages(inputBase = getBaseUrl()) {
  const base = normalizeBase(inputBase);
  const dist = path.join(__dirname, '..', 'dist');
  const entry = path.join(dist, 'index.html');
  let html = fs.readFileSync(entry, 'utf8');
  // 404.html에서 전달받은 상세 화면 경로를 React가 시작되기 전에 복구합니다.
  // URL을 통째로 encodeURIComponent하므로 한글·쿼리의 &·#를 보존합니다.
  const restore = `<script id="pages-route-restore">(function(){var q=new URLSearchParams(location.search);var p=q.get('__pages_path');var base=${JSON.stringify(base)};if(p&&p.charAt(0)==='/'&&p.slice(0,2)!=='//'&&(base===''||p===base||p.indexOf(base+'/')===0)){history.replaceState(null,'',p);}})();</script>`;
  const config = `<script src="${base}/web-config.js"></script>`;
  html = html.replace(/<head[^>]*>/i, match => match + restore + config);
  fs.writeFileSync(entry, html);
  fs.writeFileSync(path.join(dist, '.nojekyll'), '');
  // GitHub Pages는 SPA rewrite를 지원하지 않아 404 문서에서 정상 루트로 이동합니다.
  const notFound = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="robots" content="noindex"><meta name="viewport" content="width=device-width,initial-scale=1"><title>학습지원 — 페이지 열기</title></head>
<body><p>학습지원 페이지를 여는 중입니다.</p><script>
(function(){
  var base=${JSON.stringify(base)};
  var home=base+'/';
  var p=location.pathname+location.search+location.hash;
  if(location.pathname===home||location.pathname===base){document.body.textContent='index.html이 배포되지 않았습니다. 업로드한 파일 위치를 확인하세요.';return;}
  if(base&&location.pathname.indexOf(base+'/')!==0){document.body.textContent='이 사이트의 경로가 아닙니다.';return;}
  location.replace(home+'?__pages_path='+encodeURIComponent(p));
})();
</script><noscript>JavaScript를 켜고 홈페이지로 이동하세요.</noscript></body></html>
`;
  fs.writeFileSync(path.join(dist, '404.html'), notFound);
  fs.writeFileSync(path.join(dist, 'deployment-info.json'), JSON.stringify({ baseUrl: base, output: 'single', configFile: 'web-config.js' }, null, 2) + '\n');
  console.log(`[Pages] index.html, 404.html, .nojekyll 준비 완료 (${base || '/'})`);
}
module.exports = { preparePages };
if (require.main === module) preparePages();
