# 원페이저
세션 버그 로그 및 작업 노트. 단계 전환 시 초기화; 에버그린 노트 유지.

---

## 에버그린 노트

### NovelAI 메타데이터 읽기 경로 (붙여넣기)
- 웹 프론트엔드는 붙여넣기 시 tEXt 청크를 읽음. `1883-***.js` 콘솔 출력을 가로채어 확인됨.
- 임포트 모달 트리거는 `Title`, `Description`, `Software`, `Source`, `Generation time`, `Comment`의 6개 tEXt 청크 모두를 필요로 함.
  - 하위 집합(예: Title + Software만 있고 Comment 없음) → 임포트가 아닌 일반 이미지 모달(Image2Image / Vibe Transfer).
- `Comment` 키는 JSON 페이로드를 보유함. 최소 필드: `prompt`, `steps`, `scale`, `width`, `height`, `v4_prompt`.
- DataTransfer는 PNG 바이트를 정확히 보존함 — 브라우저 재인코딩 없음. 바이트 단위 비교로 확인됨 (diagnose-paste.js).

### NovelAI 메타데이터 읽기 경로 (파일 업로드)
- 파일 업로드 역시 tEXt 청크를 읽음. 동일한 `Comment` JSON 형식.
- 파이썬 라이브러리(nai_meta.py)는 알파 LSB(stealth_pngcomp)를 사용하지만, 웹 프론트엔드는 tEXt를 사용함.

### stealth_pngcomp LSB 형식
- 서명: 알파 LSB의 "stealth_pngcomp" (15 UTF-8 바이트 = 120 비트).
- 레이아웃: [서명 120 비트] [길이 32 비트 빅 엔디안] [gzip 페이로드].
- 픽셀 순서: 열 우선 (x 외부, y 내부). 픽셀당 하나의 비트 알파 LSB.
- 웹 프론트엔드는 임포트 감지에 이를 사용하지 않음. 심층 방어 차원에서 현재 빌드에 유지됨.

### NovelAI V4 메타데이터 구조
- 실제 JSON 샘플 캡처됨 (⏳History.md 489-557행 참조).
- 핵심 구조: `v4_prompt.caption.base_caption` + `char_captions[]` + `v4_negative_prompt`.
- 래퍼 필드(`Software`, `Source`, `Description`, `Generation time`)는 tEXt 전용이며 Comment JSON에 없음.

### NovelAI 페이지 환경
- CSP 헤더 없음 — 외부 스크립트 주입이 차단되지 않음.
- body는 3개의 붙여넣기 리스너를 갖고, `div.ProseMirror`는 1개의 붙여넣기 리스너를 가짐.
- 리스너들은 모바일 UA 환경에서도 동일하게 등록됨.
- 이미지 페이지 JS 청크: `1883-e81a1cb415362c52.js` (226, 1행)가 붙여넣기 시 파싱된 tEXt 메타데이터를 로깅함.

### NovelAI 페이지의 React 렌더링
- NovelAI는 자체 React 19 인스턴스를 가진 Next.js 앱임.
- 번들된 React의 비동기 스케줄러(MessageChannel 기반)는 이 페이지에서 실행되지 않음. `createRoot().render()`는 컨테이너를 생성하지만 콘텐츠를 전혀 플러시(flush)하지 않음.
- 수정: 동기 렌더링을 강제하기 위해 `react-dom`의 `flushSync()`로 `root.render()`를 감쌈. 작동 확인됨.

### 전달 경로
- 모바일 OS 클립보드는 이미지 붙여넣기를 위한 표준 UX가 없음 — 실행 불가능함.
- 로더로서의 북마클릿: NovelAI 페이지에 외부 JS를 주입함.
- 크롬 모바일은 유저스크립트/확장 프로그램을 실행할 수 없음 — 북마클릿이 유일한 주입 방법임.
- HTTPS 페이지에서의 localhost 스크립트 주입은 크롬 사설 네트워크 접근(Private Network Access) 정책에 의해 차단됨. 공개 HTTPS(GitHub Pages)에서 제공해야 함.
- GitHub Pages URL: `https://jn01020304.github.io/nai-tag-builder/nai-tag-builder.js`
- 크롬 개발자 도구 스니펫(Snippets)은 대용량(210KB 이상) JS를 붙여넣고 실행할 수 있음; 콘솔은 불가능함 (잘림 → SyntaxError).

---

## 버그 조사

### 향후 테스트
- 차단을 피하기 위해 자동 생성 모드를 확인함.

---

## 세션 로그

### v2.1 모바일 검증 및 UX

#### 모바일 크롬 북마클릿 실행
- 북마클릿은 모바일에서 드래그할 수 없음. 필수: 임의의 페이지 북마크 → 북마크 URL을 `javascript:void(...)`로 편집.
- 실행하려면: 주소 표시줄에 북마크 이름 입력 → 드롭다운에서 ★ 아이콘 항목을 탭함. Enter를 누르면 대신 구글 검색이 트리거됨.
- "test"와 같은 일반적인 이름은 검색 제안에 묻힘. "nai-tag"와 같은 고유한 이름을 사용.
- 대안: 크롬 메뉴(⋮) → 북마크 → 북마클릿을 직접 탭함.

#### NovelAI DOM 선택자
- Styled-components 클래스 이름(`sc-2f2fb315-0` 등)은 빌드마다 해시됨 — 절대 선택자로 사용하지 말 것.
- `textContent` 일치를 사용: `b.textContent?.trim() === 'Import Metadata'`, `b.textContent?.includes('Generate')`.
- 페이지에 45개 이상의 버튼이 있음. ▼ 패널 축소 토글은 `<button>`이 아님 — div 또는 SVG일 수 있음.

#### 모바일에서의 오버레이 위치 지정
- `position: fixed; bottom: 20px`는 NovelAI의 Generate 버튼을 덮음 (마찬가지로 화면 하단에 있음).
- 수정: `top: 20px`. 상단에 오버레이, 하단에 Generate 버튼 — 충돌 없음.

#### Vite 기본값에서 발생하는 전역 CSS 누출
- 기본 `index.css`에는 전역 규칙이 있음: `body { display: flex; min-height: 100vh }`, `button { border-radius: 8px; background-color: #1a1a1a }`.
- 이들은 NovelAI 자체 스타일을 덮어씀 — 버튼을 숨기거나 레이아웃을 깨뜨릴 수 있음.
- 수정: main.tsx에서 `import './index.css'`를 제거. 모든 오버레이 스타일은 theme.ts를 통해 인라인 React 스타일을 사용함.

#### 닫은 후 북마클릿 재진입
- `setIsVisible(false)` → React는 null을 반환하지만 컨테이너 div는 DOM에 남음.
- 다음 북마클릿 호출: `document.getElementById(CONTAINER_ID)`가 빈 div를 찾음 → 생성을 건너뜀 → 아무 일도 일어나지 않음.
- 수정: 닫을 때 `document.getElementById(CONTAINER_ID)?.remove()`. 전체 DOM을 제거하면 북마클릿이 처음부터 다시 생성할 수 있음.

#### 모바일 터치 드래그
- 크롬에서 React를 통한 `onTouchStart`는 기본적으로 passive(수동적)임 — 브라우저가 스크롤을 위한 제스처로 간주함.
- 드래그 핸들에 CSS `touchAction: 'none'`이 필요함. 브라우저에 해당 요소의 어떤 터치 제스처도 처리하지 말라고 지시함.
- 또한 `document`에 `{ passive: false }`로 `touchmove` 리스너를 추가하고 `e.preventDefault()`를 호출해야 함.
- 헤더 버튼을 탭할 때 드래그를 건너뛰려면 `(e.target as Element).closest('button')` 확인을 사용함.

#### 붙여넣기 부작용: 이미지 패널에 빈 PNG 발생
- PNG와 함께 붙여넣기 이벤트를 발생(dispatching)시키면 NovelAI가 기록/표시 패널에 해당 이미지를 추가함.
- 모바일에서는 이미지 패널이 확장됨 → Generate 버튼을 화면(폴드) 아래로 밀어냄.
- 우리 코드의 버그가 아님 — 붙여넣기 기반 주입 방식의 부작용임.
- Import Metadata 자동 클릭 + 임포트 후 Generate 버튼으로 스크롤하여 완화됨.

#### 모바일의 브라우저 캐시
- GitHub Pages는 기본 캐시 헤더로 스크립트를 제공함.
- 새 빌드를 푸시한 후, 사용자는 변경 사항을 보려면 모바일 크롬 캐시를 지워야 함.
- 경로: 설정 → 개인 정보 보호 → 인터넷 사용 기록 삭제 → 캐시된 이미지 및 파일.
- 향후 개선 사항: 북마클릿 URL에 캐시 무효화(cache-busting) 쿼리 매개변수 추가.