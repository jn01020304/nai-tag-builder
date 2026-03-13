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

## 메타데이터 파이프라인

MetadataState는 nested 구조 — `{ prompt: PromptState, params: ParamsState, advanced: AdvancedFlags, useCoords, useOrder, source? }`.
NAI Comment JSON 44필드 전부 커버: 37필드는 MetadataState에서, 3필드(stream, signed_hash, extra_passthrough_testing)는 buildCommentJson에서 하드코딩.

라운드트립 경로: PNG tEXt → pngParser → metadataTranslator → MetadataState → buildCommentJson → pngEncoder → paste.
roundtrip-test.cjs로 검증 — 0 DIFF (signed_hash 제외).

## 프리셋 저장소

IndexedDB (Dexie) 기반. presetStorage.ts에서 로드 시 `normalizeMetadataState()`로 정규화.
flat(D2 이전) → nested 마이그레이션 자동 처리. DB 버전 범프 없이 로드 타임 정규화.

## 자동 생성 루프와 시드 규칙

`useAutoGenerator` 훅(src/hooks/useAutoGenerator.ts)이 자동 생성 로직을 캡슐화.
내부의 `executeLoop`는 재귀 setTimeout 기반.
intervalRef/targetCountRef를 useRef로 읽어 루프 중 실시간 조절 가능.

시드 규칙 4가지:
- 일반 (none): Generate 버튼만 클릭. 메타데이터 미주입. 사용자가 NAI UI에서 직접 설정한 값 유지.
- 랜덤 (random): 매 루프마다 랜덤 시드를 메타데이터에 넣어 페이스트. 동일 프롬/설정에서 시드 중복 방지.
- 증가/감소 (increment/decrement): 시드를 ±1하여 메타데이터 페이스트. 순차 탐색용.

프리셋 큐 활성 시: 매 루프마다 다음 프리셋을 IndexedDB에서 로드 → 메타데이터 페이스트.

## UI 구조

App.tsx ~350줄. 리사이즈는 `useEdgeResize(320)` 훅으로 분리.
테마: 전역 mutable `theme` 변수 + Context cascade. 정적 상수 3개는 함수 내부로 이동 완료.
밝기 판정: BT.601 휘도 수식 `(0.299*R + 0.587*G + 0.114*B) / 255 < 0.5`.

## 남은 기술 부채

- 9개 컴포넌트의 전역 `theme` import → `useTheme()` 훅 전환. 동작에 문제는 없으나 React 안티패턴.
- UI state 7개(isApplying, isCollapsed, overlayWidth, queue, queueMode, pendingImport, isDragOver)가 AppContent에 집중.

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
