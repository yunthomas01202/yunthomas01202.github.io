const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const { getBaseUrl, normalizeBase } = require('./pages-config.cjs');

function withEnv(values, run) {
  const saved = {};
  for (const key of Object.keys(values)) {
    saved[key] = process.env[key];
    if (values[key] === undefined) delete process.env[key];
    else process.env[key] = values[key];
  }
  try { return run(); } finally {
    for (const key of Object.keys(values)) {
      if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key];
    }
  }
}
function generate(base) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'study-pages-'));
  fs.mkdirSync(path.join(dir, 'scripts'));
  fs.mkdirSync(path.join(dir, 'dist'));
  for (const name of ['pages-config.cjs', 'prepare-pages.cjs']) fs.copyFileSync(path.join(__dirname, name), path.join(dir, 'scripts', name));
  fs.writeFileSync(path.join(dir, 'dist/index.html'), '<!doctype html><html><head></head><body><script src="bundle.js"></script></body></html>');
  const result = spawnSync(process.execPath, [path.join(dir, 'scripts/prepare-pages.cjs')], { env: { ...process.env, EXPO_BASE_URL: base }, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return { dir, html: fs.readFileSync(path.join(dir, 'dist/index.html'), 'utf8'), notFound: fs.readFileSync(path.join(dir, 'dist/404.html'), 'utf8') };
}

test('루트·저장소 경로 정규화', () => {
  assert.equal(normalizeBase('/'), '');
  assert.equal(normalizeBase('study/'), '/study');
  assert.equal(normalizeBase('/study'), '/study');
  assert.throws(() => normalizeBase('https://example.com/study'));
  assert.throws(() => normalizeBase('/../study'));
  assert.throws(() => normalizeBase('/study?x=1'));
});
test('GitHub 저장소명에서 기본 경로 계산', () => {
  withEnv({ EXPO_BASE_URL: undefined, GITHUB_REPOSITORY: 'alice/study' }, () => assert.equal(getBaseUrl(), '/study'));
  withEnv({ EXPO_BASE_URL: undefined, GITHUB_REPOSITORY: 'alice/alice.github.io' }, () => assert.equal(getBaseUrl(), ''));
  withEnv({ EXPO_BASE_URL: '', GITHUB_REPOSITORY: 'alice/study' }, () => assert.equal(getBaseUrl(), ''));
});
for (const base of ['', '/study', '/other-repo']) {
  test(`정적 준비·404 복구: ${base || '루트'}`, () => {
    const out = generate(base);
    try {
      assert.ok(fs.existsSync(path.join(out.dir, 'dist/.nojekyll')));
      assert.ok(out.html.indexOf(`src="${base}/web-config.js"`) < out.html.indexOf('src="bundle.js"'));
      const route = `${base}/study/file/한글-id?x=a%26b&y=1#page-2`;
      let redirected;
      const redirectScript = out.notFound.match(/<script>([\s\S]*?)<\/script>/)[1];
      const uri = new URL('https://alice.github.io' + route);
      vm.runInNewContext(redirectScript, {
        location: { pathname: uri.pathname, search: uri.search, hash: uri.hash, replace: value => { redirected = value; } }, document: { body: {} }, encodeURIComponent,
      });
      assert.equal(redirected, `${base}/?__pages_path=${encodeURIComponent(uri.pathname + uri.search + uri.hash)}`);
      let restored;
      const restoreScript = out.html.match(/<script id="pages-route-restore">([\s\S]*?)<\/script>/)[1];
      vm.runInNewContext(restoreScript, {
        URLSearchParams, location: { search: redirected.slice(redirected.indexOf('?')) }, history: { replaceState: (_state, _title, value) => { restored = value; } },
      });
      assert.equal(restored, uri.pathname + uri.search + uri.hash);
      restored = undefined;
      vm.runInNewContext(restoreScript, {
        URLSearchParams, location: { search: '?__pages_path=' + encodeURIComponent('//evil.example/') }, history: { replaceState: (_state, _title, value) => { restored = value; } },
      });
      assert.equal(restored, undefined);
    } finally { fs.rmSync(out.dir, { recursive: true, force: true }); }
  });
}
