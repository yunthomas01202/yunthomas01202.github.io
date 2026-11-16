# GitHub Pages 업로드 안내

## 어떤 압축파일을 사용할까요?

**`ultimate-study-static-root.zip`**은 이미 빌드된 HTML·JavaScript·자산입니다. Node.js 설치 없이 바로 올리려면 이 파일을 사용하세요. 주소는 **`https://내아이디.github.io/`**를 기준으로 만들었으므로 저장소 이름을 반드시 **`내아이디.github.io`**로 만듭니다. 일반 이름의 저장소(`/study/` 등)에 이 루트용 파일을 그대로 올리면 경로가 맞지 않습니다.

**`ultimate-study-github-pages-source.zip`**은 수정 가능한 원본 코드와 자동 배포 설정입니다. 저장소 이름을 `study`, `ultimate-study` 등 자유롭게 정하려면 이 파일을 사용하세요. GitHub Actions가 저장소 주소에 맞춰 빌드하고 배포합니다. 소스에 모바일용 파일이 남아 있어도 웹 빌드에서는 네이티브 플러그인을 제외합니다.

## 방법 1 — 빌드된 파일을 바로 업로드

1. GitHub에서 이름이 **`내아이디.github.io`**인 Public 저장소를 만듭니다. 이미 다른 사이트가 있는 저장소라면 덮어쓰지 말고 방법 2로 새 저장소를 만드세요.
2. `ultimate-study-static-root.zip`을 풉니다. 안의 **`web-config.js`**를 메모장이나 코드 편집기로 열고 Firebase 설정과 Google 웹 클라이언트 ID를 입력합니다. 값 입력 방법은 아래를 참고하세요.
3. 압축을 푼 **내용 전체**를 저장소 루트에 업로드합니다. `index.html`, `404.html`, `web-config.js`, `_expo/`, `assets/`, `.nojekyll`을 모두 포함하세요. 압축파일 자체를 올리거나 전체를 하위 폴더에 넣으면 안 됩니다.
4. 저장소 **Settings → Pages → Source → Deploy from a branch**를 선택하고 **main → /(root)**로 저장합니다.
5. GitHub 배포가 끝나면 `https://내아이디.github.io/`에 접속합니다. 설정 안내가 보이면 파일 업로드는 성공했지만 Firebase 값이 아직 비어 있는 상태입니다.

`.nojekyll`은 이름이 점으로 시작하는 빈 파일입니다. 숨김 파일이라 업로드에서 누락되었다면 GitHub **Add file → Create new file**에서 이름을 `.nojekyll`로 만들고 커밋하세요. `_expo` 폴더와 자산이 누락되면 화면이 열리지 않습니다.

## 방법 2 — 소스를 올려 자동 배포

1. `ultimate-study-github-pages-source.zip`을 풀고 `ultimate-study-github-pages` 폴더 안으로 들어갑니다.
2. **`public/web-config.js`**에 아래 설정을 입력합니다.
3. GitHub Public 저장소를 만들고, 폴더 **안의 내용**을 루트에 올립니다. `package.json`과 `.github/workflows/deploy-web.yml`이 저장소 루트 기준 위치에 있어야 합니다.
4. **Settings → Pages → Source → GitHub Actions**를 선택합니다.
5. **Actions → 웹 배포 (GitHub Pages)**에서 실행 결과를 확인합니다. 설정 전에 실행되어 실패했다면 **Run workflow**로 다시 실행하세요. 이후 `main`에 코드를 올릴 때마다 자동으로 배포됩니다.

저장소가 `study`라면 주소는 `https://내아이디.github.io/study/`입니다. `.github` 숨김 폴더도 반드시 올려야 합니다. 업로드 방식에서 숨김 파일이 빠지면 GitHub Desktop을 사용하거나 GitHub에서 해당 경로의 파일을 직접 생성하세요.

두 방법을 혼용하지 마세요. 빌드된 파일 방식은 **Deploy from a branch**, 소스 방식은 **GitHub Actions**를 사용합니다.

## Firebase·Google Drive에 입력할 값

원본 압축파일에는 실제 Firebase/Google 설정이 아닌 예시 값만 들어 있었습니다. 따라서 사이트를 올리는 것만으로 Google 로그인과 데이터 저장까지 바로 활성화되지는 않습니다. 이 버전도 원본처럼 Google 로그인 후 사용하는 구조이며 게스트/로컬 전용 모드를 추가하지 않았습니다.

[Firebase 콘솔](https://console.firebase.google.com/)에서 본인 프로젝트를 만들거나 기존 프로젝트를 선택하고, **프로젝트 설정 → 일반 → 웹 앱**을 등록합니다. 표시된 `firebaseConfig` 값을 `web-config.js`의 `firebaseWeb`에 옮깁니다.

```javascript
window.STUDY_WEB_CONFIG = {
  firebaseWeb: {
    apiKey: "여기에 Firebase 웹 API 키",
    authDomain: "내프로젝트.firebaseapp.com",
    projectId: "내프로젝트",
    storageBucket: "콘솔에서 받은 값",
    messagingSenderId: "콘솔에서 받은 값",
    appId: "콘솔에서 받은 값"
  },
  googleWebClientId: "웹 클라이언트 ID.apps.googleusercontent.com"
};
```

Firebase **Authentication → 로그인 방법 → Google**을 활성화합니다. **Authentication → 설정 → 승인된 도메인**에는 `내아이디.github.io`를 추가합니다. `https://`나 저장소 경로는 넣지 않습니다.

Firestore Database를 생성하고 규칙을 적용하세요. 정적 ZIP의 `firebase/firestore.rules` 또는 소스 ZIP의 같은 파일 내용을 **Firestore → 규칙**에 붙여넣고 게시합니다. 각 사용자 본인만 데이터를 읽고 쓸 수 있도록 작성된 규칙입니다. 전체 공개 규칙으로 변경하지 마세요.

[Google Cloud 콘솔](https://console.cloud.google.com/)에서 Firebase와 같은 프로젝트의 **Google Drive API**를 사용 설정합니다. **API 및 서비스 → 사용자 인증 정보**의 OAuth 2.0 **웹 클라이언트 ID**를 `googleWebClientId`에 입력하고, 그 클라이언트의 승인된 JavaScript 원본에 `https://내아이디.github.io`를 추가합니다. `/study` 같은 경로는 원본 주소에 넣지 않습니다. OAuth 동의 화면이 테스트 상태라면 본인 계정을 테스트 사용자로 추가하세요. 조직/검증 정책은 해당 콘솔 안내를 따릅니다.

이 설정 파일은 웹에 공개됩니다. **서비스 계정 JSON, 클라이언트 비밀키, 관리자 키, 개인 토큰을 절대 넣지 마세요.** 브라우저용 Firebase 설정을 사용하고 데이터 접근은 Firestore 규칙으로 보호합니다.

## 수정 후 다시 직접 빌드하려면

소스 폴더에서 Node.js 22.23.4를 사용하여 아래 명령을 실행합니다.

```bash
npm ci
npm run typecheck
npm run test:pages

# 내아이디.github.io 루트 사이트
npm run build:pages -- --root

# 일반 저장소 study
npm run build:pages -- --base /study
```

결과 `dist` 안의 내용을 사용하면 됩니다. 코드 수정 없이 설정만 바꾸는 경우 정적 배포의 `web-config.js`만 수정할 수 있습니다. 자동 배포에서는 `public/web-config.js`를 수정하고 커밋하세요.

## 알아둘 제한

GitHub Pages는 정적 웹 호스팅입니다. 로그인·클라우드 저장은 본인 Firebase/Drive를 사용하며, 다른 휴대폰 앱을 잠그는 기능은 브라우저에서 사용할 수 없습니다. 탭 종료 후 알림·백그라운드 타이머도 네이티브 앱과 같지 않습니다. 완전 오프라인용 서비스 워커는 새로 추가하지 않았습니다.

상세 화면에서 새로고침하거나 주소를 직접 열 때는 `404.html`을 거쳐 정상 홈페이지로 이동하고 원래 화면 주소를 복원합니다. 처음 상세 URL 요청은 GitHub Pages에서 HTTP 404로 응답할 수 있지만 브라우저 표시를 복구하는 방식입니다.

PDF.js는 외부 CDN에서 불러옵니다. HTML 학습 앱 가져오기는 JS·CSS·이미지가 내장된 독립형 HTML 기준이며 여러 파일로 구성된 사이트 폴더 업로드는 지원하지 않습니다. 게시 링크형 학습 앱은 새 탭으로 엽니다.

Firebase·Google 계정이 제공되지 않아 실제 로그인과 사용자 클라우드 파일 작업은 검증 대상에서 제외했습니다. 실제 GitHub 계정에 업로드한 상태가 아니라, 업로드할 수 있는 완성 파일을 전달한 것입니다.

## 참고 문서

- [Expo 웹 배포](https://docs.expo.dev/guides/publishing-websites/)
- [GitHub Pages 자동 배포 워크플로](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
