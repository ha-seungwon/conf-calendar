# 학회 캘린더

시스템·AI 학회의 **논문/초록 마감일**과 **개최 기간**을 웹에서 받아 캘린더로 보여 주고, **내 일정**도 함께 관리하는 Windows 데스크톱 앱 (Electron).

**다운로드: https://ha-seungwon.github.io/conf-calendar** (또는 [Releases](https://github.com/ha-seungwon/conf-calendar/releases/latest)에서 `ConfCalendar-Setup.exe`)

설치하면 바탕화면과 시작 메뉴에 "학회 캘린더" 바로가기가 생기고, 새 버전이 나오면 자동으로 업데이트됩니다.
처음 실행할 때 "Windows의 PC 보호" 창이 뜨면 "추가 정보 → 실행"을 누르세요 (코드 서명이 없어서 나오는 안내).

## 기능

- **월 보기 / 목록 보기**: 마감은 색 칩, 학회 기간은 여러 날에 걸친 줄무늬 막대로 표시. 날짜를 누르면 그날 일정 전체를 보여 줌
- **내 일정**: `+ 일정` 버튼, 빈 날짜 두 번 클릭, 또는 날짜 팝업의 "이 날 일정 추가"로 추가. 일정을 누르면 수정·삭제 (삭제는 되돌리기 가능). 시간 지정 / 하루 종일 / 여러 날, 색과 메모 지원
- **다가오는 마감 패널**: 가장 가까운 마감(또는 내 일정)까지 초 단위 카운트다운, D-day 색상(3일 이내 빨강, 14일 이내 주황)
- **필터**: 분야(AI / 아키텍처·분산 / 네트워크 / 시스템SW·PL / 보안·DB 등), 등급(CCF A·B·C, CORE A*·A), 일정 종류. MLSys·SoCC·HotOS는 기본 포함
- **검색**: 검색어를 넣으면 필터와 상관없이 전체 387개 학회와 내 일정에서 찾음
- **즐겨찾기 ★**: 즐겨찾기한 학회는 필터와 상관없이 항상 표시. 마감 3일 전에 Windows 알림
- **시간대 자동 변환**: AoE·UTC±n·PT 등 원래 시간대를 내 PC 시간(KST)으로 바꿔 표시. 원본 시각도 함께 표시
- **.ics 내보내기**: 지금 보이는 앞으로의 일정(내 일정 포함)을 .ics 파일로 저장 → 구글 캘린더 `설정 → 가져오기`, 아웃룩에서 열기
- **자동 업데이트**: 실행할 때와 6시간마다 GitHub Releases에서 새 버전을 확인해 받아 두고, 앱을 닫거나 "재시작해서 업데이트"를 누르면 설치
- **라이트/다크 테마**, **오프라인 동작** (마지막으로 받은 데이터 사용)

달 이동: 월 보기에서 마우스 휠 아래/위 (한 칸에 한 달)

단축키: `←` `→` 달 이동 · `T` 오늘 · `M` 월 보기 · `L` 목록 · `/` 검색 · `Esc` 닫기

내 일정, 즐겨찾기, 설정은 `%APPDATA%\학회 캘린더\` 에 저장돼서 업데이트해도 그대로 남습니다.

## 새 버전 배포하기 (개발자용)

```powershell
npm version patch    # 1.0.0 → 1.0.1 (기능 추가면 minor), 커밋과 태그가 함께 만들어짐
npm run release      # 설치 파일 빌드 → git push → GitHub Release 업로드
```

Release가 올라가면 이미 설치된 앱들이 다음 실행 때(켜 둔 상태면 6시간 안에) 알아서 새 버전을 받습니다.
필요한 것: [GitHub CLI](https://cli.github.com) 로그인(`gh auth login`), 커밋하지 않은 변경 없음, 실행 중인 앱 닫기.

## 개발

```powershell
npm install
npm start            # 소스에서 실행 (자동 업데이트는 꺼짐)
npm test             # 날짜·시간대 파서 테스트
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
test/              파서 테스트, 화면 점검용 자동 스크린샷 ($env:CONFCAL_SHOT="폴더"; npx electron .)
```

## 데이터 · 라이선스

학회 데이터: [ccfddl/ccf-deadlines](https://github.com/ccfddl/ccf-deadlines) (MIT, 커뮤니티 관리). 마감일은 바뀔 수 있으니 제출 전에는 학회 웹사이트에서 꼭 다시 확인하세요.
글꼴: Pretendard (SIL OFL 1.1, `renderer/fonts/PRETENDARD-LICENSE.txt`). 이 앱: MIT.
