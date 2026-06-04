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

# Product Architecture Blueprint

## 제품 정체성

`nai-tag-builder`는 NovelAI 이미지 생성 페이지 위에 주입되는 모바일 북마크릿 오버레이다.
목표는 모바일 사용자가 긴 프롬프트와 복잡한 metadata를 직접 조작하지 않고도, 짧은 탭과 스와이프로 NovelAI 생성 흐름을 안전하게 지휘하는 것이다.

이 제품은 독립 실행형 생성 앱이 아니다.
초기 생성 책임은 NovelAI 웹 UI에 남기고, 본 도구는 prompt, params, metadata, queue, review 상태를 조립해 NovelAI import workflow에 위임한다.

## 제품 원칙

- 사용자는 작업자가 아니라 감독자다.
- 모바일 기본 흐름은 긴 입력보다 선택, 조합, 확인, 적용이어야 한다.
- 모든 외부 실행은 성공과 실패를 명시적으로 반환해야 한다.
- API key, NovelAI token, 유료 인증 정보는 북마크릿 런타임에서 직접 보관하지 않는다.
- 태그 카탈로그와 LLM 보조는 prompt authoring의 연료이지 제품의 중심이 아니다.
- metadata는 prompt, seed, source, settings를 포함할 수 있으므로 민감 정보로 다룬다.
- Runtime은 작고 빠르게, Offline은 크고 똑똑하게 설계한다.

## Runtime과 Offline 경계

Runtime은 사용자의 모바일 브라우저 안에서 실행되는 북마크릿 앱이다.
초기 렌더링, Compose, Tune, Queue, Apply, status feedback, handoff preview를 담당한다.
Runtime에는 승인된 Core Catalog와 최소 로직만 포함한다.

Offline은 개발 또는 빌드 단계에서 실행되는 도구다.
로컬 Danbooru 태그 스냅샷 파싱, Product Category 후보 생성, 향후 Danbooru API 검증, 향후 LLM 분류 보조, catalog 압축을 담당한다.
Offline 결과물만 Runtime에 들어간다.

## 작업면

Compose는 무엇을 그릴지 정한다.
카테고리 칩, 직접 입력, raw prompt, preset piece, alias canonicalization, linter를 담당한다.
초기 source of truth는 raw prompt string이다.

Tune은 어떤 조건으로 만들지 조정한다.
seed, size, steps, scale, sampler, character prompt, character coords 같은 핵심 파라미터를 담당한다.
Advanced flags는 기본 조작면에서 격리한다.

Queue는 짧은 반복 작업을 정한다.
preset 반복, seed rule, character preset 순환, 실패 시 중단을 담당한다.
초기 Queue는 복잡한 workflow builder가 아니라 모바일용 작업 지시서다.

Review는 결과를 판단하고 다음 작업으로 넘긴다.
보관, 폐기, 보류, PC 편집 후보, metadata manifest를 담당한다.
무거운 이미지 처리는 후순위이며, 초기에는 선택 이력과 handoff 구조가 중요하다.

## 도메인 모듈

Overlay Shell은 Header, Body, Footer를 제공한다.
Header는 제목, 현재 상태, 접기, 닫기를 담당한다.
Body는 현재 작업면 하나만 보여준다.
Footer는 Apply, Stop, metadata notice, status summary를 항상 접근 가능한 위치에 둔다.

Prompt 도메인은 prompt document, raw prompt, tag catalog, parser, linter, compiler, preset piece를 담당한다.
이 도메인은 NovelAI DOM이나 PNG encoding을 알면 안 된다.

Metadata 도메인은 `MetadataState`, seed planning, NovelAI Comment JSON, PNG metadata encoding을 담당한다.
이 도메인은 Product Category와 UI 칩 출처를 알면 안 된다.

Automation 도메인은 NovelAI paste target, Import Metadata, Generate readiness를 담당한다.
이 도메인은 외부 UI 변화에 가장 취약하므로 adapter 형태로 고립한다.

Queue 도메인은 작업 세션, tick plan, retry policy, stop policy를 담당한다.
이 도메인은 apply pipeline 결과를 관찰하되 DOM selector를 직접 다루지 않는다.

Asset 도메인은 generated asset record, triage status, variant group, handoff manifest를 담당한다.
이 도메인은 이미지 바이너리 처리보다 metadata 연결을 먼저 보장한다.

Feedback 도메인은 status banner, toast, footer summary, error details를 담당한다.
브라우저 `alert()`는 기본 피드백 경로로 사용하지 않는다.

## 데이터 흐름

Compose는 raw prompt와 선택된 catalog chip을 만든다.
Tune은 generation params와 advanced flags를 만든다.
Metadata는 Compose와 Tune의 결과를 `MetadataState`로 합치고 Comment JSON과 PNG payload를 만든다.
Automation은 payload를 NovelAI 웹 UI에 전달하고 결과를 반환한다.
Queue는 같은 apply pipeline을 여러 작업에 순서대로 적용한다.
Review는 생성 결과와 metadata 이력을 기록하고 handoff manifest로 묶는다.

## Source of Truth 전략

Phase 1과 Phase 2에서는 raw prompt string이 source of truth다.
칩과 자동완성은 raw prompt를 편하게 조작하는 도구다.
raw prompt를 직접 수정하면 칩 선택 상태는 parser 결과로 다시 계산한다.

구조화 태그 모델은 parser, linter, compiler가 안정된 뒤 도입한다.
그 전까지 `TagEntry[]`를 source of truth로 승격하지 않는다.
구조화 모델 도입 시 raw prompt는 compiler 결과 미리보기 또는 전문가 override 모드가 된다.

## 보안 경계

NovelAI 직접 API 호출은 초기 범위 밖이다.
북마크릿 런타임에서 API key나 인증 token을 저장하지 않는다.
PNG metadata, stealth payload, source hash, vault token은 모두 사용자에게 노출 가능성을 알려야 한다.
metadata 제거, vault hash 대체, full metadata export는 서로 다른 모드로 분리한다.

## 버전 방향

v0는 계약 고정과 Core Catalog bootstrap이다.
v1은 Compose와 Tune이 작동하는 모바일 prompt 조종 패널이다.
v2는 paste/import 적용 신뢰성을 사용자에게 명확히 보여주는 metadata 적용 도구다.
v3는 Queue와 preset 반복 생성이다.
v4는 Review, Triage, Handoff다.
v5는 Danbooru API, LLM 자연화, vision AI, vault 같은 provider 확장이다.
