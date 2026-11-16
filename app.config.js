// 웹 실행/빌드는 네이티브 전용 플러그인을 읽지 않습니다.
// 모바일 명령에는 원본 app.json 플러그인이 그대로 적용됩니다.
const { getBaseUrl, readWebConfig } = require('./scripts/pages-config.cjs');
const nativeOnly = new Set([
  '@react-native-firebase/app', '@react-native-firebase/auth',
  '@react-native-google-signin/google-signin', 'expo-build-properties',
  'expo-notifications', 'react-native-device-activity',
]);

module.exports = ({ config }) => {
  const isWeb = process.env.STUDY_WEB_BUILD === '1';
  const webSettings = readWebConfig();
  return {
    ...config,
    plugins: isWeb ? (config.plugins || []).filter(plugin => !nativeOnly.has(Array.isArray(plugin) ? plugin[0] : plugin)) : config.plugins,
    experiments: { ...(config.experiments || {}), baseUrl: getBaseUrl() },
    extra: { ...(config.extra || {}), ...webSettings, githubPagesBase: getBaseUrl() },
    web: { ...config.web, bundler: 'metro', output: 'single' },
  };
};
