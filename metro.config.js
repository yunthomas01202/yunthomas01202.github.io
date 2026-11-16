// 필기 엔진(assets/engine/*.html)을 앱 번들에 에셋으로 포함시키기 위한 설정
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('html');

module.exports = config;
