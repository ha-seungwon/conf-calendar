# 학회 캘린더

시스템·AI 학회의 **논문/초록 마감일**과 **개최 기간**을 웹에서 받아 캘린더로 보여 주고, **내 일정**도 함께 관리하는 Windows · Mac 데스크톱 앱 (Electron).

**다운로드: https://ha-seungwon.github.io/conf-calendar** (또는 [Releases](https://github.com/ha-seungwon/conf-calendar/releases/latest)에서 Windows `ConfCalendar-Setup.exe`, Mac `ConfCalendar-arm64.dmg`(Apple 칩) / `ConfCalendar-x64.dmg`(Intel))

설치하면 바탕화면과 시작 메뉴에 "학회 캘린더" 바로가기가 생기고, 새 버전이 나오면 자동으로 업데이트됩니다.
처음 실행할 때 "Windows의 PC 보호" 창이 뜨면 "추가 정보 → 실행"을 누르세요 (코드 서명이 없어서 나오는 안내).

**Mac**: .dmg를 열어 앱을 "응용 프로그램"으로 옮긴 뒤 실행 → 경고가 뜨면 "시스템 설정 → 개인정보 보호 및 보안 → 그래도 열기". 애플 개발자 서명이 없어서 Mac은 자동 설치가 안 되고, 새 버전이 나오면 앱에서 알려 주고 다운로드 페이지를 열어 줍니다.

## 기능

- **월 보기 / 목록 보기**: 마감은 색 칩, 학회 기간은 여러 날에 걸친 줄무늬 막대로 표시. 날짜를 누르면 그날 일정 전체를 보여 줌
- **내 일정**: `+ 일정` 버튼, 빈 날짜 두 번 클릭, 또는 날짜 팝업의 "이 날 일정 추가"로 추가. 일정을 누르면 수정·삭제 (삭제는 되돌리기 가능). 시간 지정 / 하루 종일 / 여러 날, 색과 메모 지원
- **다가오는 마감 패널**: 가장 가까운 마감(또는 내 일정)까지 초 단위 카운트다운, D-day 색상(3일 이내 빨강, 14일 이내 주황)
- **분야**: AI(머신러닝·컴퓨터 비전·자연어처리·로보틱스·AI 일반), 시스템(OS·분산·클라우드·스토리지 / 아키텍처·하드웨어·임베디드 / 병렬·HPC·성능 / 네트워크·모바일 / SW공학·PL), 기타(보안·DB·HCI 등)
- **등급 기준 선택**: BK21(인정 IF 4~1점) · 정보과학회 2024(최우수·우수) · CCF(A·B·C) · CORE(A*·A·B·C) 중 하나를 고르면 그 기준의 세부 등급으로 필터하고 배지도 그 기준으로 표시. 상세 화면에는 모든 기준이 함께 나옴. 기본은 정보과학회 최우수. MLSys·SoCC·HotOS는 기본 포함
- **컨퍼런스 / 저널형 표시**: 논문이 저널에 실리는 학회(VLDB→PVLDB, PLDI·POPL·OOPSLA·ICFP→PACMPL, SIGMOD→PACMMOD, CoNEXT→PACMNET 등)는 "저널형"으로 표시
- **검색**: 검색어를 넣으면 필터와 상관없이 전체 387개 학회와 내 일정에서 찾음
- **즐겨찾기 ★**: 즐겨찾기한 학회는 필터와 상관없이 항상 표시
- **마감 알림**: 즐겨찾기 학회 마감 7일·3일·1일·3시간 전, 내 일정은 30분 전(하루 종일은 아침 9시). 창을 닫아도 트레이(Mac은 메뉴 막대)에서 계속 실행되고, "컴퓨터 켤 때 자동 실행"도 고를 수 있음 (사이드바 "알림 · 백그라운드")
- **제출 계획**: 학회 상세에서 "제출 계획 만들기" → 마감에서 거꾸로 주제 확정(D-60)·초안(D-30)·내부 리뷰(D-14)·최종 점검(D-3) 일정과 마감 시각을 내 일정으로 만들어 줌. 날짜·이름 수정 가능, 지난 날짜는 건너뜀, 구글 캘린더 연동 중이면 구글에도 올라감
- **시간대 자동 변환**: AoE·UTC±n·PT 등 원래 시간대를 내 PC 시간(KST)으로 바꿔 표시. 원본 시각도 함께 표시
- **.ics 내보내기**: 지금 보이는 앞으로의 일정(내 일정 포함)을 .ics 파일로 저장 → 구글 캘린더 `설정 → 가져오기`, 아웃룩에서 열기
- **구글 캘린더 양방향 연동**: 사이드바 "구글 캘린더 → 연동 설정하기"에서 한 번 설정하면, 구글 기본 캘린더의 일정(과거 90일~앞으로 400일)이 앱에 들어오고, 앱에서 추가·수정·삭제한 내 일정은 구글에도 반영됨. 5분마다·창으로 돌아올 때·저장할 때 자동 동기화. 학회 마감은 올리지 않음 (필요하면 .ics 내보내기)
- **피드백**: 왼쪽 아래 "피드백 보내기" → GitHub 양식으로 남기고, [피드백 게시판](https://github.com/ha-seungwon/conf-calendar/issues?q=label%3Afeedback)에서 모두 볼 수 있음
- **자동 업데이트**: 왼쪽 아래 "업데이트 확인" 버튼, 그리고 실행할 때와 6시간마다 GitHub Releases에서 새 버전을 확인해 받아 두고, 앱을 닫거나 "재시작해서 업데이트"를 누르면 설치
- **라이트/다크 테마**, **오프라인 동작** (마지막으로 받은 데이터 사용)

달 이동: 월 보기에서 마우스 휠 아래/위 (한 칸에 한 달)

단축키: `←` `→` 달 이동 · `T` 오늘 · `M` 월 보기 · `L` 목록 · `/` 검색 · `Esc` 닫기

내 일정, 즐겨찾기, 설정은 `%APPDATA%\학회 캘린더\` (Mac: `~/Library/Application Support/ConfCalendar/`)에 저장돼서 업데이트해도 그대로 남습니다. **내 일정과 구글 로그인 정보·계정 이메일은 OS 암호화(Windows DPAPI / Mac 키체인)로 저장**돼서 이 PC의 이 사용자 계정에서만 열립니다.

## 새 버전 배포하기 (개발자용)

```powershell
npm version patch    # 1.0.0 → 1.0.1 (기능 추가면 minor), 커밋과 태그가 함께 만들어짐
npm run release      # 설치 파일 빌드 → git push → GitHub Release 업로드
```

Release는 먼저 초안으로 올라가고, GitHub Actions(`.github/workflows/mac.yml`)가 맥 서버에서 .dmg를 만들어 붙인 뒤 공개합니다(약 3분, 명령이 끝날 때까지 기다림). 그래서 다운로드 링크가 파일 없는 버전을 가리키는 순간이 없어요. 공개되면 이미 설치된 앱들이 다음 실행 때(켜 둔 상태면 6시간 안에) 알아서 새 버전을 받습니다.
필요한 것: [GitHub CLI](https://cli.github.com) 로그인(`gh auth login`), 커밋하지 않은 변경 없음, 실행 중인 앱 닫기.

## 개발

```powershell
npm install
npm start            # 소스에서 실행 (자동 업데이트는 꺼짐)
npm test             # 날짜·시간대 파서 + 구글 동기화 테스트
npm run pack         # 설치 파일만 빌드 (release\ConfCalendar-Setup.exe)
```

```
main.js            Electron 메인: 창, 데이터 다운로드·캐시, 내 일정 저장, 자동 업데이트
preload.js         렌더러에 노출하는 최소 API
src/data.js        YAML → 앱 데이터 변환 (날짜 범위·시간대 파싱)
renderer/          화면 (index.html, style.css, app.js, fonts/)
data/              내장 데이터 스냅샷
build/             앱 아이콘
docs/              다운로드 페이지 (GitHub Pages)
scripts/           아이콘 생성, 배포 스크립트
src/gsync.js       구글 캘린더 로그인·동기화 로직
src/mine-store.js  내 일정 저장 + 구글 연동 (메인 프로세스)
test/              파서·동기화 테스트, 화면 점검용 자동 스크린샷 ($env:CONFCAL_SHOT="폴더"; npx electron .)
```

## 데이터 · 라이선스

학회 데이터: [ccfddl/ccf-deadlines](https://github.com/ccfddl/ccf-deadlines) (MIT, 커뮤니티 관리).
등급: `data/grades.json` — 4단계 BK21 Computer Science 분야 우수 국제학술대회 목록의 인정 IF, 한국정보과학회 2024 우수학술대회 등급([비교표](https://gist.github.com/Pusnow/6eb933355b5cb8d31ef1abcb3c3e1206) 기준, BK 점수는 BK21 목록 PDF와 대조). 마감일은 바뀔 수 있으니 제출 전에는 학회 웹사이트에서 꼭 다시 확인하세요.
글꼴: Pretendard (SIL OFL 1.1, `renderer/fonts/PRETENDARD-LICENSE.txt`). 이 앱: MIT.

## 보안

- **앱**: 화면 코드는 격리·샌드박스로 실행되고 외부 스크립트·네트워크 접근이 막혀 있음. 배포판은 개발자 도구가 꺼져 있고, Electron fuses로 실행 파일을 Node로 쓰거나 디버거를 붙이거나 앱 파일(asar)을 바꿔치기하는 것을 막음. 앱 내부 요청(IPC)은 앱 화면에서 온 것만 처리하고, 권한은 알림만 허용
- **개인 정보**: 내 일정·구글 로그인 정보·계정 이메일은 OS 암호화(Windows DPAPI / Mac 키체인)로 저장. 서버가 없어서 다른 사람에게 전송되지 않음
- **배포**: main 브랜치·릴리스 태그는 강제 푸시·삭제·변경 금지(Rulesets), Actions 기본 권한은 읽기 전용, 외부 기여자 PR 워크플로는 승인 필요, 비밀 정보 스캔·푸시 차단 켜짐, 워크플로 액션은 커밋 SHA로 고정. 업데이트 파일은 SHA-512로 검증
- **남은 과제**: 코드 서명 인증서 없음(Windows SmartScreen·Mac Gatekeeper 경고). 저장소 관리자 계정은 반드시 2단계 인증 사용
