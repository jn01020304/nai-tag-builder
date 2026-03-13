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

`useAutoGenerator` 훅(src/hooks/useAutoGenerator.ts)이 자동 생성 로직을 캡슐화.
내부의 `executeLoop`는 재귀 setTimeout 기반 (52줄).
intervalRef/targetCountRef를 useRef로 읽어 루프 중 실시간 조절 가능.

시드 규칙 4가지:
- 일반 (none): Generate 버튼만 클릭. 메타데이터 미주입. 사용자가 NAI UI에서 직접 설정한 값 유지.
- 랜덤 (random): 매 루프마다 랜덤 시드를 메타데이터에 넣어 페이스트. 동일 프롬/설정에서 시드 중복 방지.
- 증가/감소 (increment/decrement): 시드를 ±1하여 메타데이터 페이스트. 순차 탐색용.

프리셋 큐 활성 시: 매 루프마다 다음 프리셋을 localStorage에서 로드 → 메타데이터 페이스트.

## 현재 구조의 문제점

App.tsx 372줄. 자동 생성 로직은 useAutoGenerator로 분리 완료. 남은 문제:
- `startResize`가 AppContent 내부에 정의 (overlayWidth state 클로저 접근). `startDrag`는 이미 모듈 레벨 함수로 분리됨.
- UI state 7개(isApplying, isCollapsed, overlayWidth, queue, queueMode, pendingImport, isDragOver)가 AppContent에 집중.

## 메타데이터 라운드트립 데이터 유실

MetadataState는 26필드(prompt 4, params 8, advanced 11, v4 2, meta 1).
NAI Comment JSON은 44필드이므로 14개 미매핑:
- 생성에 영향: `deliberate_euler_ancestral_bug`, `explike_fine_detail`, `minimize_sigma_inf`, `dynamic_thresholding_percentile` (0.999), `dynamic_thresholding_mimic_scale` (10)
- 현재 null: `director_reference_*` (4개), `lora_*` (2개)
- 프로토콜: `stream`, `signed_hash`, `extra_passthrough_testing`

추가로 `metadataTranslator`가 `v4_prompt.use_coords`/`use_order`를 파싱하지 않아 DEFAULT_STATE 값으로 덮어씀.

---

# 목표 구조 (To-Be) — 리팩토링 방향

## 1. 전역 Theme 변수 → Context 훅 마이그레이션
`theme.ts`에서 `export let theme` 형태로 전역 변수를 내보내어 10개 컴포넌트가 직접 참조.
모듈 레벨 정적 상수 중 theme을 참조하는 3개(`AutoGeneratePanel:miniBtn`, `AutoGeneratePanel:smallNumInput`, `AdvancedParams:checkboxRowStyle`)는 모듈 로드 시점에 평가되어 런타임 테마 변경 시 갱신 안 됨.
모든 컴포넌트가 `useTheme()` 훅을 통해 테마를 구독하도록 전면 수정 필요.

## 2. App.tsx 이벤트 로직 분리 (Resize)
`startResize`가 AppContent 내부에 overlayWidth state 클로저로 정의되어 있음.
`useEdgeResize()` 훅으로 분리 필요. `startDrag`는 이미 모듈 레벨 함수로 분리 완료.

## 3. MetadataState 스키마 확장 + 구조 분리
현재 26필드가 flat 구조. NAI Comment JSON 44필드 중 14개가 미매핑.
누락 필드를 먼저 MetadataState에 추가한 후, `{ prompt: PromptState, params: GenerationParams, advanced: AdvancedFlags }` 형태의 계층적 구조로 재설계.
프롬프트 컴파일러가 프롬프트 데이터에만 집중할 수 있도록 분리.

## 4. presetStorage 하위 호환성 (Migration Layer)
`presetStorage.ts`가 MetadataState를 JSON으로 직렬화해 저장.
스키마 확장/구조 분리 시 기존 localStorage 프리셋이 깨짐.
`version` 필드 도입 + 스키마 마이그레이션 레이어 필요.

## 5. 밝기(Luminance) 기반 색상 판독
`isVeryDark`가 5개 하드코딩 RGB 문자열과 직접 비교.
화이트리스트에 없는 다크 테마에서 라이트 모드로 잘못 표시.
RGB 파싱 + 휘도 수식 `(0.299*R + 0.587*G + 0.114*B) / 255 < 0.5` 적용 필요.

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
