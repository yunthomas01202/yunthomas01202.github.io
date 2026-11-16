# 학습지원 — GitHub Pages 배포용

첨부 원본의 화면과 기능을 유지한 Expo SDK 54 / React Native Web 프로젝트입니다. 웹을 정적 HTML·JavaScript·자산으로 빌드하여 GitHub Pages에 올립니다. GitHub Pages에서 Node 서버를 돌릴 필요는 없습니다. 로그인·데이터 저장은 원본과 같이 Firebase, PDF·HTML 파일 저장은 Google Drive를 사용하므로 본인 계정의 설정이 필요합니다. 설정 없이 게스트로 사용하는 기능은 추가하지 않았습니다.

## 가장 쉬운 방법: 자동 배포

1. GitHub에서 Public 저장소를 만듭니다. 이름은 `study`, `ultimate-study`, 또는 `아이디.github.io`로 정할 수 있습니다.
2. 이 폴더 **안의 내용**을 저장소 루트에 올립니다. `package.json`, `app.json`, `app.config.js`, `.github`가 저장소 맨 위에 있어야 합니다. `node_modules`, `dist`, 압축파일 자체는 올리지 않습니다.
3. 아래 Firebase 설정을 `public/web-config.js`에 입력합니다.
4. 저장소 **Settings → Pages → Build and deployment → Source → GitHub Actions**를 선택합니다.
5. `main`에 커밋하면 `.github/workflows/deploy-web.yml`이 설치·검사·빌드·배포합니다. Pages 설정 전에 첫 실행이 실패했다면 **Actions → 웹 배포 → Run workflow**로 다시 실행합니다.

일반 저장소는 `https://아이디.github.io/저장소이름/`, `아이디.github.io` 저장소는 `https://아이디.github.io/` 주소가 됩니다. 워크플로는 GitHub Pages의 `base_path`를 사용하여 경로를 자동으로 맞춥니다. 별도 커스텀 도메인을 사용하는 경우에도 Pages에서 도메인을 설정한 뒤 다시 빌드하세요.

숨김 폴더 `.github`를 빠뜨리면 자동 배포가 실행되지 않습니다. GitHub 웹 업로드에서 숨김 파일이 누락된다면 GitHub Desktop/명령행으로 폴더 전체를 업로드하거나, `.github/workflows/deploy-web.yml` 파일을 GitHub에서 직접 생성하세요.

## Firebase와 Google Drive 설정

`public/web-config.js`의 `firebaseWeb` 안에 Firebase 콘솔 → 프로젝트 설정 → 일반 → 웹 앱 등록에서 받은 `firebaseConfig` 값을 입력합니다. `googleWebClientId`에는 같은 Google Cloud 프로젝트의 **OAuth 2.0 웹 클라이언트 ID**를 입력합니다. 이 값은 브라우저에서 사용하는 공개 설정입니다. 서비스 계정 JSON, OAuth 클라이언트 비밀키, 관리자 SDK 키, 개인 토큰은 넣지 마세요.

```javascript
window.STUDY_WEB_CONFIG = {
  firebaseWeb: {
    apiKey: "Firebase 웹 API 키",
    authDomain: "내프로젝트.firebaseapp.com",
    projectId: "내프로젝트",
    storageBucket: "콘솔에서 복사한 버킷 값",
    messagingSenderId: "콘솔에서 복사한 값",
    appId: "콘솔에서 복사한 앱 ID"
  },
  googleWebClientId: "웹 클라이언트 ID.apps.googleusercontent.com"
};
```

Firebase 콘솔 **Authentication → 로그인 방법 → Google**을 활성화하고, **Authentication → 설정 → 승인된 도메인**에 `아이디.github.io`를 추가합니다. 도메인에는 `https://`와 `/study` 같은 경로를 넣지 않습니다. 커스텀 도메인을 사용하면 그 도메인도 추가합니다.

Firestore Database를 생성하고 **규칙**에 `firebase/firestore.rules` 내용을 적용하세요. 각 사용자는 `users/자기uid/…` 아래의 자기 데이터만 읽고 쓸 수 있도록 구성되어 있습니다. 편의를 위해 전체 공개 규칙으로 변경하지 마세요.

Google Cloud 콘솔에서는 같은 프로젝트의 **Google Drive API**를 활성화합니다. **API 및 서비스 → 사용자 인증 정보 → OAuth 2.0 웹 클라이언트**의 승인된 JavaScript 원본에 `https://아이디.github.io`를 추가합니다. 로컬 개발에 로그인하려면 `http://localhost:8081`도 추가하고 Firebase 승인된 도메인에 `localhost`를 추가하세요. Google 인증 플랫폼의 대상/테스트 사용자 설정에 따라 본인 계정을 테스트 사용자로 등록해야 할 수도 있습니다. 조직 정책이나 권한 심사 요구가 나오면 해당 콘솔 안내를 따르세요.

처음 로그인할 때 Drive 권한을 함께 요청합니다. Drive 토큰이 만료되면 앱의 **구글 드라이브 연결** 버튼으로 다시 연결합니다. 웹 설정이 비어 있으면 흰 화면 대신 설정 안내가 표시됩니다.

## 로컬 개발·직접 빌드

Node.js **22.23.4**로 설치와 빌드를 검증한 구성을 사용합니다. Firebase JS SDK는 `11.10.0`으로 고정했고 `package-lock.json`을 포함했습니다. 가능하면 `.nvmrc` 버전을 사용하세요.

```bash
npm ci
npm run web
npm run typecheck
npm run test:pages
```

수동 배포용 정적 파일은 다음 중 주소에 맞는 명령으로 만듭니다. Windows에서도 같은 명령을 사용합니다.

```bash
# https://아이디.github.io/ 또는 커스텀 도메인의 루트
npm run build:pages -- --root

# https://아이디.github.io/study/
npm run build:pages -- --base /study
```

완성된 `dist` **안의 파일과 폴더**를 업로드하세요. `dist` 폴더 자체가 홈페이지 루트 아래에 들어가면 안 됩니다. 직접 정적 파일만 배포하는 저장소는 **Pages → Source → Deploy from a branch → main → /(root)**를 사용합니다. 소스 자동 배포 방식과 혼용하지 마세요.

`dist/web-config.js`는 빌드 뒤에 수정해도 적용됩니다. 다만 다음 빌드에서는 `public/web-config.js`가 다시 복사되므로 원본도 함께 수정해 두세요. `.nojekyll`은 `_expo` 같은 폴더가 정상 제공되도록 필요한 파일입니다.

## 구조

```text
.github/workflows/deploy-web.yml  GitHub Actions 자동 배포
app/                             기존 화면·동적 ID 라우트
src/                             기존 UI·학습/계획/수행 로직
src/lib/*.web.ts                  브라우저 Firebase·Drive·파일 캐시
src/lib/webConfig.ts              공개 웹 설정 읽기·누락 검사
src/components/WebFrame.web.tsx   브라우저 iframe 기반 필기/HTML 앱
assets/engine/study-engine.html   PDF·필기·복습 엔진
public/web-config.js              사용자가 입력할 웹 설정
scripts/                         경로 계산·빌드·404 준비·테스트
firebase/firestore.rules          사용자별 데이터 접근 규칙
app.json                         원본 앱 설정 (모바일 설정 보존)
app.config.js                    웹에서는 네이티브 플러그인 제외
package-lock.json                재현 가능한 의존성 버전
.nvmrc                           Node 버전
README-mobile-original.md        원본 모바일 안내 (참고용)
dist/                            빌드 결과 (생성됨, 소스 ZIP에는 없음)
```

웹 실행은 반드시 `npm run web`, 웹 배포는 `npm run build:pages` 또는 `npm run build:web`를 사용하세요. 직접 `npx expo export`만 실행하면 웹 빌드용 환경 변수와 Pages 후처리가 생략됩니다.

## 변경 사항

웹 내보내기를 막던 네이티브 앱 잠금 플러그인은 웹 실행/빌드에서 제외했습니다. 원본 모바일 설정과 코드는 남겨 두었지만 모바일 앱 빌드를 검증한 것은 아닙니다. 원본 UI는 유지했으며 별도 새 디자인으로 교체하지 않았습니다.

배포 경로를 루트·저장소·커스텀 도메인에 맞게 계산하고 `404.html`에서 동적 상세 경로를 정상 루트로 보내 원래 URL을 복원합니다. `404.html`이 처음 요청될 때 GitHub Pages 특성상 HTTP 404가 한 번 발생하지만, 브라우저는 정상 홈페이지로 이동한 뒤 상세 화면을 엽니다. 정적 파일 누락은 여전히 수정해야 하며 404 복구가 파일 누락을 해결하지는 않습니다.

Firebase는 지연 초기화하고 설정 누락을 안내합니다. 웹 설정을 별도 파일로 분리했으므로 정적 파일 배포에서 설정 변경만 하려면 Expo를 다시 빌드할 필요가 없습니다. 필기 엔진과 파일 fetch 오류를 감지하고, IndexedDB 파일 저장은 트랜잭션 완료까지 기다립니다. 파일 ID 변경 시 필기 엔진을 재초기화하고 로그아웃 때 Drive 폴더 캐시를 비웁니다.

## 웹에서의 제한

브라우저는 다른 앱을 잠글 수 없습니다. 네이티브 알림·백그라운드 실행은 모바일 앱과 같지 않으며, 탭이 닫힌 동안의 무음 타이머 알림을 보장하지 않습니다. PWA·서비스 워커는 새로 추가하지 않았으므로 처음부터 완전 오프라인으로 실행하는 버전은 아닙니다.

PDF.js는 원본처럼 CDN에서 불러옵니다. 인터넷 차단·CDN 장애가 있으면 PDF 처리가 제한될 수 있습니다. 가져오는 HTML 학습 앱은 JavaScript·CSS·이미지가 내장된 독립형 HTML을 기준으로 합니다. 여러 파일로 구성된 사이트 폴더를 올리는 기능은 없습니다. 게시 링크형 학습 앱은 새 탭으로 엽니다.

Firebase·Drive 설정과 계정이 제공되지 않았으므로 실제 Google 로그인·클라우드 동기화·사용자 PDF 저장까지 확인한 것은 아닙니다. GitHub 계정에 실제 업로드/배포한 것도 아니며, 완성된 소스와 정적 파일을 제공합니다.

## 공식 배포 문서

- [Expo 웹 배포와 baseUrl](https://docs.expo.dev/guides/publishing-websites/)
- [GitHub Pages 사용자 정의 워크플로](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
