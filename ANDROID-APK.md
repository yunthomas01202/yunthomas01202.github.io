# 안드로이드 APK

## 설치
`학습지원-v1.1.0.apk`를 폰으로 옮겨 열고 "출처를 알 수 없는 앱 설치"를 허용하면 설치돼요.
처음 화면에서 **로그인 없이 이 기기에서 시작**을 누르면 Firebase 설정 없이 바로 쓸 수 있어요(데이터는 폰에만 저장).

## 알람 (공부 도구 → 알람, 또는 설정 → 알람)
- 울리는 방식: 벨 / 진동 / 벨+진동
- 알람음: 시스템 벨소리 고르기 또는 내 음악 파일(mp3 등) 고르기, 음량, 점점 크게
- 진동 패턴(기본·심장박동·강하게), 다시 알림 간격, 요일 반복, 미리 듣기
- "기본 일정에 맞추기": 1교시·종례 같은 고정 일정 시작 N분 전으로 한 번에 맞춤
- 잠금 화면 위에 알람 화면이 떠요. 처음에 앱이 요청하는 "알람 및 리마인더", "알림", "전체 화면 알림" 권한을 허용하세요.
- 재부팅·시간대 변경 후에도 자동으로 다시 예약돼요.

## 기본 일정 (설정 → 기본 일정)
교시·조회·점심·종례·학원 같은 매주 고정 일정. "학교 시간표 만들기"로 한 번에 넣고, 휴일은 "전체 관리"에서 하루씩 뺄 수 있어요.

## 다시 빌드하기
```bash
npm ci
STUDY_ANDROID_BUILD=1 npx expo prebuild --platform android
# android/app/build.gradle 의 release 서명에 study-release.keystore 지정 (비밀번호 studypass, alias study)
cd android && ./gradlew assembleRelease
```
- 업데이트 APK를 기존 앱 위에 설치하려면 **같은 study-release.keystore로 서명**해야 해요. 잃어버리지 마세요.
- Google 로그인(클라우드 동기화)을 쓰려면 Firebase 콘솔에서 안드로이드 앱(패키지 `com.thiomasas.ultimatestudy`)을 등록하고,
  위 키의 SHA-1을 추가한 뒤 받은 `google-services.json`으로 교체하고 `app.json`의 `googleWebClientId`를 채워 다시 빌드하세요.
  지금 들어 있는 google-services.json은 빌드용 자리표시자예요.
- 아이콘 원본(SVG)은 `assets/icon-src/`에 있어요.
