# Tag Lab v18.5 파일 구조

`shell-v18.5-nightly.html`을 브라우저로 직접 열면 된다. 서버나 빌드 과정은 필요 없다. 배포하거나 옮길 때 아래 다섯 파일을 함께 유지한다.

- `shell-v18.5-nightly.html`: 화면 구조와 파일 로딩 순서.
- `shell-v18.5-nightly.css`: 화면 스타일. 이미지 상대 경로 기준을 유지하도록 HTML과 같은 위치에 둔다.
- `shell-v18.5-nightly.catalog.js`: 작가 통계·별칭·이미지 카탈로그. 앱에서 읽기 전용으로 사용한다.
- `shell-v18.5-nightly.png.js`: PNG 텍스트 청크와 stealth metadata 해독. `pngMetadata.parsePngTextChunks(buffer)`와 `pngMetadata.extractStealthPngMetadata(file)`만 공개한다.
- `shell-v18.5-nightly.js`: 상태 보존, 프롬프트, 토너먼트, 조율, 이미지 이력, 이벤트 연결과 초기화.

파일 직접 열기를 지원하기 위해 ES module import 대신 일반 script를 카탈로그 → PNG → 앱 순서로 로드한다. PNG 내부 보조 함수는 클로저 안에 격리한다. 앱 내부의 서로 연결된 UI 상태는 기존 실행 순서와 함께 유지한다. 따라서 이번 분리는 모든 기능을 독립 모듈로 전환한 것은 아니다.

카탈로그는 JSON 텍스트를 DOM에 넣고 다시 파싱하던 과정을 없애고 객체로 한 번 로드한다. 계산 알고리즘과 렌더링 흐름은 유지한다. 파일 분리 자체로 실행 속도가 빨라진다고 보장하지 않는다.

검증: `rtk node scripts/test/chunk-editor-v18.5-test.mjs`, `rtk node scripts/test/duel-layout-v18.5-test.mjs`. 브라우저에서는 HTML을 직접 열어 검색, 청크 편집, 비교, 이미지 가져오기를 확인한다.
