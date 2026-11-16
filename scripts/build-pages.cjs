const { spawnSync } = require('node:child_process');
const { getBaseUrl, normalizeBase } = require('./pages-config.cjs');
const args = process.argv.slice(2);
let base = getBaseUrl();
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--base' && args[i + 1] !== undefined) base = normalizeBase(args[++i]);
  else if (args[i] === '--root') base = '';
  else throw new Error(`알 수 없는 옵션: ${args[i]} (사용: --base /study 또는 --root)`);
}
process.env.EXPO_BASE_URL = base;
process.env.STUDY_WEB_BUILD = '1';
console.log(`[Pages] 배포 경로: ${base || '/ (루트)'}`);
const expo = require.resolve('expo/bin/cli');
const result = spawnSync(process.execPath, [expo, 'export', '--platform', 'web', '--output-dir', 'dist'], {
  stdio: 'inherit', env: process.env,
});
if (result.status !== 0) process.exit(result.status || 1);
require('./prepare-pages.cjs').preparePages(base);
