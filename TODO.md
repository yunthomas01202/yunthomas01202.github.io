# GitHub Pages 변환 작업

- [x] 기존 화면과 웹 전용 대체 모듈을 유지하여 정적 웹 내보내기 구조를 정리한다.
- [x] 루트 사이트와 저장소 하위 경로를 계산하고 동적 상세 주소 새로고침·직접 접근을 복구한다. 경로/404 테스트 5개 통과.
- [x] 웹에서는 네이티브 앱 잠금 등 모바일 전용 config plugin을 불러오지 않는다. 누락된 Babel 프리셋을 포함한다.
- [x] Firebase 공개 웹 설정을 web-config.js로 분리하고 미설정 상태에는 명확한 안내를 표시한다. 브라우저 표시 확인.
- [x] 한국어 Pages 업로드 안내, GitHub Actions, 고정 Node 버전 및 package-lock.json을 포함한다.
- [x] 실제 웹 빌드를 루트와 /study 경로로 완료하고 HTML·JavaScript·필기 엔진 자산이 존재하는지 확인한다.
- [x] 바로 업로드할 루트 정적 파일과 수정·자동 배포용 소스를 각각 ZIP으로 전달한다.

Firebase·Google Drive 실계정 설정과 실제 GitHub 업로드는 이번 파일 변환 결과에 포함되지 않는다.
