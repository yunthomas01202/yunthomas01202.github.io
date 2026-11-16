const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
// Metro 개발 HTML에는 정적 빌드의 후처리가 적용되지 않습니다.
// 개발 실행은 같은 공개 설정 파일을 읽어 Expo extra에 전달합니다.
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/web-config.js'), 'utf8'), context, { timeout: 1000 });
const result = spawnSync(process.execPath, [require.resolve('expo/bin/cli'), 'start', '--web', ...process.argv.slice(2)], {
  stdio: 'inherit', env: {
    ...process.env, STUDY_WEB_BUILD: '1', EXPO_BASE_URL: '',
    STUDY_WEB_SETTINGS: JSON.stringify(context.window.STUDY_WEB_CONFIG || {}),
  },
});
process.exit(result.status || 0);
