const path = require('node:path');
const fs = require('node:fs');

function normalizeBase(value) {
  const raw = String(value || '').trim();
  if (!raw || raw === '/') return '';
  if (!/^\/?[A-Za-z0-9._~%-]+(?:\/[A-Za-z0-9._~%-]+)*\/?$/.test(raw) || raw.split('/').some(x => x === '.' || x === '..')) {
    throw new Error('배포 경로는 /저장소이름 형식이어야 합니다. 전체 URL을 넣지 마세요.');
  }
  return '/' + raw.replace(/^\/+|\/+$/g, '');
}

function getBaseUrl() {
  if (process.env.EXPO_BASE_URL !== undefined) return normalizeBase(process.env.EXPO_BASE_URL);
  if (process.env.GITHUB_REPOSITORY) {
    const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
    return repo.toLowerCase() === `${owner}.github.io`.toLowerCase() ? '' : normalizeBase(repo);
  }
  return '';
}

function readWebConfig() {
  if (process.env.STUDY_WEB_SETTINGS) return JSON.parse(process.env.STUDY_WEB_SETTINGS);
  const filename = path.join(__dirname, '..', 'web-settings.json');
  return fs.existsSync(filename) ? JSON.parse(fs.readFileSync(filename, 'utf8')) : {};
}

module.exports = { normalizeBase, getBaseUrl, readWebConfig };
