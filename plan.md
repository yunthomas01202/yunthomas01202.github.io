# GitHub Pages 구조 변경

첨부 원본의 계획·학습·수행·공부 도구 화면과 React Native Web 구조를 유지한다. 기존 디자인과 상호작용을 그대로 사용하며 새 디자인이나 별도 호스팅 서비스로 바꾸지 않는다.

`app/`과 `src/`는 기존 화면과 로직을 담당하고 `.web.ts` 대체 모듈을 웹 번들에 사용한다. `public/web-config.js`에서 사용자 Firebase·Google 웹 클라이언트 공개 설정을 읽는다. 설정이 없으면 Firebase 초기화를 생략하고 안내를 표시한다. 원본 모바일 `app.json`은 보존하되 `app.config.js`에서 웹 빌드 시 네이티브 config plugin을 제외한다.

`script` 폴더 대신 `scripts/`를 사용하여 웹 빌드 명령·배포 경로 계산·GitHub Pages 404 복구·경로 테스트를 분리한다. `dist/`는 실행 가능한 정적 HTML·JavaScript·자산만 담는다. `.github/workflows/deploy-web.yml`은 Node 버전과 lockfile을 사용하여 검사 뒤 Pages에 자동 배포한다.

사용자에게는 루트 사이트에 바로 업로드할 정적 ZIP과 원하는 저장소 이름에 맞춰 자동 빌드할 소스 ZIP을 제공한다. 실제 GitHub 계정 업로드는 수행하지 않는다. Firebase·Google 실계정 설정이 없으므로 로그인·클라우드 파일 작업은 사용자가 설정한 뒤 사용한다.
