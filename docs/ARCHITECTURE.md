---
language: korean
formatting:
  tables: minimum
  bold_emphasis: false
  blockquotes: false
  comments: false
writing:
  preamble: false
  filler: false
  closing_summary: false
---

# 현재 구조 (As-Is)

## 자동 생성 루프와 시드 규칙

App.tsx 내부의 executeLoop는 재귀 setTimeout 기반.
intervalRef/targetCountRef를 useRef로 읽어 루프 중 실시간 조절 가능.

시드 규칙 4가지:
- 일반 (none): Generate 버튼만 클릭. 메타데이터 미주입. 사용자가 NAI UI에서 직접 설정한 값 유지.
- 랜덤 (random): 매 루프마다 랜덤 시드를 메타데이터에 넣어 페이스트. 동일 프롬/설정에서 시드 중복 방지.
- 증가/감소 (increment/decrement): 시드를 ±1하여 메타데이터 페이스트. 순차 탐색용.

프리셋 큐 활성 시: 매 루프마다 다음 프리셋을 localStorage에서 로드 → 메타데이터 페이스트.

## 현재 구조의 문제점

App.tsx가 500줄 이상의 God Component:
- handleApply 안에 executeLoop가 중첩 정의 (100줄 이상의 비동기 함수)
- 자동 생성 상태(intervalSec, targetCount, seedRule 등)가 낱개 useState로 흩어져 있음
- UI 렌더링과 자동 생성 비즈니스 로직이 한 파일에 혼재

---

# 목표 구조 (To-Be) — 리팩토링 방향

단기적으로 진행해야 할 핵심 리팩토링 목표(기술 부채 해소)는 다음과 같습니다:

## 1. 전역 Theme 변수 → Context 훅 마이그레이션
현재 `theme.ts`에서 `export let theme` 형태로 전역 변수를 내보내어 10여 개의 컴포넌트가 직접 참조하고 있습니다. 
문제는 정적 스타일 객체(static constants)들이 사이드 이펙트로 한 번만 평가되고 런타임 테마 변경 시 업데이트되지 않는 버그가 발생할 수 있다는 점입니다.
모든 컴포넌트가 `<ThemeContext.Provider>` 하위에서 `useTheme()` 훅을 통해 테마 색상을 구독하도록 전면 수정해야 합니다.

## 2. App.tsx 이벤트 로직 분리 (Drag & Resize)
`startDrag`와 `startResize` 등 창 조절을 담당하는 마우스/터치 이벤트 핸들러가 `AppContent` 컴포넌트 안에 하드코딩되어 있습니다. 
비즈니스 로직과 UI 렌더링, 윈도우 인터랙션 로직이 혼재되어 있으니, 이를 `useWindowDrag()` 및 `useEdgeResize()` 형태의 외부 훅으로 분리해야 합니다.

## 3. MetadataState 계층 구조화 (Flat Structure 개선)
현재 `MetadataState`는 프롬프트(`basePrompt`, `characters`)와 생성 파라미터(`steps`, `scale`), 고급 설정(`smea`, `smeaDyn`) 등이 모두 평탄화(Flat)된 하나의 객체로 관리됩니다.
추후 추가할 핵심 기능인 프롬프트 컴파일러(태그 객체 배열 → NAI 텍스트 변환)가 프롬프트 데이터에만 집중할 수 있도록, `{ prompt: PromptState, params: GenerationParams, advanced: AdvancedFlags }` 형태의 계층적 구조로 재설계해야 합니다.

## 4. presetStorage 하위 호환성 (Migration Layer)
`presetStorage.ts`가 현재 `MetadataState` 배열 객체를 JSON으로 직렬화해 그대로 저장하고 있습니다. 
위의 계층 구조화 작업이 진행되면 기존 `localStorage`에 저장된 프리셋 데이터 형식이 깨지게 됩니다. 
이를 막기 위해 `version` 필드를 도입하고 스키마 이주(Migration) 레이어를 구축해야 합니다.

## 5. 밝기(Luminance) 기반 색상 판독
현재 `isVeryDark` 플래그는 몇 가지 하드코딩된 RGB 문자열과 직접 비교하여 다크 모드를 판별하고 있습니다.
화이트리스트에 없는 다크 테마가 추가될 경우 텍스트가 안 보이는 오류가 발생할 수 있으므로, RGB 값을 파싱하여 실제 밝기(Luminance) 수식을 적용하는 방식으로 수정해야 합니다.

---

# 할 일 목록

## 1순위 — 기초 토대
- [ ] DB 구조 설계 (`{ id, keyword, category, weight, isEnabled, isNegative }`)
- [ ] 디자인 시스템 구성
- [ ] NovelAI API 연동 테스트

## 2순위 — 핵심 파이프라인
- [ ] 자연어 → Danbooru 태그 변환 AI
- [ ] 태그 가중치 편집 UI (막대그래프 + 슬라이더)
- [ ] 프롬프트 컴파일러 (태그 객체 배열 → NovelAI 문법 문자열)
- [ ] 이미지 생성 호출 및 결과 출력

## 3순위 — 관리 기능
- [ ] 틴더식 스와이프 이미지 선별 UI
- [ ] 이미지 오류 탐지 (비전 AI 히트맵)
- [ ] 탭-투-마스크 인페인팅 보조
- [ ] 이미지 나란히 비교 UI
- [ ] 프롬프트 히스토리 보관함 (검색 · 재활용)

## 3순위 — 작성 편의 기능
- [ ] 태그 칩 드래그 앤 드롭 (순서 재배치)
- [ ] 부정 프롬프트 템플릿 토글
- [ ] 프롬프트 재조합 AI 추천
- [ ] 스마트 탭 자동 분류 ([인물], [배경], [구도] 등)
- [ ] 바텀 시트 가중치 조절 팝업
- [ ] 만화/스토리보드 생성 모드

## 3순위 — 자동화
- [ ] AI 사용 패턴 기반 프롬프트 추천 보고서
- [ ] DB Import/Export 지원
- [ ] 기기 간 동기화 (Firebase/Supabase + Google 로그인)

## 나중에
- [ ] AI 어시스턴트 성격·말투 설정
- [ ] 사용자 취향 통계 UI
- [ ] 온보딩 화면 구성
- [ ] 앱 이름 결정 (후보: PromptAIO, TagMaster AIO, OmniPrompt, DanbooruAIO, AIO Canvas)
- [ ] iOS/Android 제스처 충돌 검증 (3손가락 탭, 2손가락 더블 탭 등)
- [ ] API 키 클라이언트 보안 방안 확정