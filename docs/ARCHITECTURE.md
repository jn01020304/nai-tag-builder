---
language: korean
formatting:
  tables: false
  bold_emphasis: false
  blockquotes: false
  comments: false
writing:
  preamble: false
  filler: false
  closing_summary: false
---

# Architecture Index

`nai-tag-builder`는 Danbooru 태그 분류기가 아니라 NovelAI 웹페이지 위에서 동작하는 모바일 북마크릿 조종 패널이다.
모든 기능 추가와 리팩토링은 이 제품 정체성을 기준으로 판단한다.

## 기준 문서

- `docs/PRODUCT_ARCHITECTURE_BLUEPRINT.md`: 제품 전체 구조, 도메인 경계, 단계별 버전 방향
- `docs/MOBILE_OVERLAY_CONTRACT.md`: 모바일 오버레이 셸, 작업 모드, 화면 밀도, Playwright 검수 기준
- `docs/PRODUCT_CATEGORIES.md`: 커스텀 Product Category와 Core Catalog 데이터 계약
- `docs/OFFLINE_CATALOG_PIPELINE.md`: 로컬 Danbooru 태그 스냅샷 기반 오프라인 카탈로그 생성 흐름
- `docs/DELEGATED_AUTOMATION_GUIDE.md`: NovelAI paste/import 위임 자동화, 실패 처리, 적용 파이프라인 기준
- `docs/idea-note-original.md`: 자유 아이디어 주차장. 구현 기준 문서가 아니다.

## 현재 제품 기준선

현재 제품은 React, TypeScript, Vite 기반 단일 IIFE 북마크릿 오버레이다.
NovelAI 직접 API 호출이 아니라 PNG metadata와 paste/import workflow를 통해 NovelAI 웹 UI에 상태 적용을 위임한다.

핵심 상태는 nested `MetadataState`다.
`MetadataState`는 prompt, params, advanced, useCoords, useOrder, source를 포함하며, NovelAI Comment JSON 생성의 내부 계약이다.
기존 IndexedDB 프리셋은 로드 시 `normalizeMetadataState()`를 거쳐 정규화한다.

적용 흐름은 `src/automation/applyPipeline.ts`를 기준으로 계획, 인코딩, 외부 실행을 분리한다.
단일 Apply와 자동 생성 루프는 같은 `runApplyPipeline()` 경로를 사용한다.
`dispatchPasteEvent()`는 paste target, import, generate 자동화 결과를 명시적으로 반환해야 한다.

## 상위 모듈 경계

Offline Catalog 계층은 런타임 번들 밖에서 실행된다.
로컬 태그 스냅샷, 향후 Danbooru API 검증, 향후 LLM 분류 보조는 이 계층에만 속한다.
런타임 앱은 승인된 작은 Core Catalog와 필요 시 지연 로드되는 Lite Index만 소비한다.

Prompt 계층은 Compose 화면, raw prompt, parser, linter, compiler, preset piece, tag catalog provider를 담당한다.
Prompt 계층은 NovelAI DOM selector, PNG chunk, Import Metadata 버튼을 알면 안 된다.

Metadata 계층은 `MetadataState`, seed planning, Comment JSON, PNG metadata encoding을 담당한다.
Metadata 계층은 태그가 어떤 Product Category에서 왔는지에 의존하지 않는다.

Automation 계층은 NovelAI 웹 UI에 대한 paste/import/generate 위임만 담당한다.
Automation 계층은 prompt 편집 UX나 catalog 생성 규칙을 알면 안 된다.

Queue 계층은 짧은 모바일 작업 지시서를 담당한다.
초기 범위는 preset 반복, seed 규칙, character preset 순환, 실패 시 중단이다.
복잡한 조건 분기나 직접 API 생성은 초기 범위가 아니다.

Asset 계층은 결과 이미지 후보, 선택 상태, metadata 보존, PC handoff manifest를 담당한다.
초기 목표는 무거운 이미지 처리보다 선별 이력과 메타데이터 패키징이다.

## 의존성 방향

UI는 도메인 서비스를 호출할 수 있지만, 도메인 서비스는 UI 컴포넌트를 import하면 안 된다.
Prompt는 Metadata로 값을 넘길 수 있지만, Metadata는 Prompt UI나 Product Category를 알면 안 된다.
Metadata는 Automation에 전달할 payload를 만들 수 있지만, Automation selector가 Metadata 안으로 들어오면 안 된다.
Offline 도구는 Runtime 데이터를 생성할 수 있지만, Runtime 코드가 Offline 도구를 import하면 안 된다.

## 현재 기술 부채

`App.tsx`는 여전히 overlay 조립, apply 상태, import modal, queue, feedback을 많이 알고 있다.
다음 UI 리팩토링에서는 Overlay Shell, mode tabs, sticky footer, apply controller, import patch 병합을 분리해야 한다.

`useAutoGenerator.ts`는 적용 파이프라인을 공유하지만 아직 세션 FSM은 아니다.
중지, 실패, 대기, 완료 상태를 명시적인 전이 모델로 고정해야 한다.

`ImportModal`은 `Partial<MetadataState>` 기반 patch를 사용한다.
선택하지 않은 nested 필드가 덮어써지지 않도록 `MetadataPatch`와 `mergeMetadataPatch()` 계약이 필요하다.

applied seed는 코드 레벨에서 추적되지만 아직 사용자 UI에 충분히 노출되지 않는다.
seed 0은 NovelAI에서 literal fixed seed이므로, random seed 요청은 별도 seed rule에서만 발생해야 한다.

전역 mutable theme import는 동작하지만 장기적으로 `useTheme()` 기반으로 정리해야 한다.

## 실행 로드맵

### Phase 0: 계약 고정

- 제품 청사진, 모바일 오버레이 계약, Product Category 계약, Offline Catalog Pipeline을 문서로 고정한다.
- 기존 `docs/DELEGATED_AUTOMATION_GUIDE.md`를 자동화 기준선으로 유지한다.
- 직접 NovelAI API 호출, LLM 런타임 추천, 전체 Danbooru DB 번들링은 초기 범위 밖으로 둔다.

### Phase 1: Core Catalog Bootstrap

- `D:\Downloads\danbooru_tag_dataset_20250703\tags.json`를 1차 로컬 스냅샷으로 사용한다.
- 오프라인 빌더가 후보 catalog를 생성하고, 사람이 승인한 항목만 runtime Core Catalog로 승격한다.
- 첫 Core Catalog는 모바일 Compose 칩용 150개 안팎으로 제한한다.

### Phase 2: Compose MVP

- Product Category 칩을 탭하면 raw prompt 문자열에 canonical 태그가 추가된다.
- raw prompt에서 태그를 제거하면 칩 선택 상태도 해제된다.
- 직접 입력, alias canonicalization, 최소 prompt linter를 붙인다.
- source of truth는 raw prompt string으로 유지한다.

### Phase 3: Tune and Apply Reliability

- Tune 화면에는 seed, size, steps, scale, sampler, character coords 같은 핵심 파라미터만 노출한다.
- Advanced flags는 접힌 전문가 영역으로 격리한다.
- Apply 전 `MetadataState` 검증과 applied seed 표시를 추가한다.
- paste/import 실패가 상태 배너와 footer 상태에 명시적으로 반영된다.

### Phase 4: Queue

- 짧은 작업 큐를 도입한다.
- 초기 큐는 preset N장 생성, seed 증가/감소/랜덤, character preset 순환, 실패 시 중단을 지원한다.
- Queue는 Automation selector를 직접 알지 않고 apply pipeline 결과만 관찰한다.

### Phase 5: Review and Handoff

- 생성 결과 후보를 보관, 폐기, 보류, PC 편집 후보로 분류한다.
- 이미지와 함께 prompt, seed, params, source hash, 선택 이력을 handoff manifest로 묶는다.
- Triage와 in-place toggle은 이미지 처리 기능이 아니라 선택과 검증 UX로 먼저 구현한다.

### Phase 6: Provider Expansion

- Danbooru API 검증, LLM 기반 자연스러운 구문 보정, 고급 자동완성, vision AI 검수, metadata vault를 provider로 추가한다.
- 이 단계에서도 런타임 모바일 오버레이의 초기 로드 비용과 API key 보안 경계를 침범하면 안 된다.

## 금지할 방향

- `App.tsx`에 새 실행 로직을 계속 추가하는 것
- Runtime에 전체 Danbooru DB나 LLM 의존성을 직접 넣는 것
- 북마크릿 환경에서 API key나 인증 토큰을 직접 저장하는 것
- paste/import 실패를 성공처럼 처리하는 것
- Product Category를 Danbooru 공식 category와 혼동하는 것
- Compose 칩을 전체 태그 백과사전처럼 비대화하는 것
