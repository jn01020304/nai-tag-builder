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

# Master Blueprint

이 문서는 `nai-tag-builder`의 최상위 제품 및 아키텍처 계약이다.
새 기능, 리팩토링, UI 변경, 데이터 파이프라인 변경은 이 문서를 먼저 통과해야 한다.

`nai-tag-builder`는 Danbooru 태그 분류기가 아니다.
NovelAI 웹페이지 위에 주입되는 저마찰 모바일 조종 패널이다.
초기 핵심 가치는 모바일에서 prompt, params, metadata, queue를 빠르게 구성하고 NovelAI 웹 UI에 안전하게 위임하는 것이다.

## 제품 정체성

이 제품은 독립 실행형 생성 앱이 아니다.
생성 책임은 NovelAI 웹 UI에 남긴다.
북마크릿은 prompt와 metadata 상태를 조립하고, NovelAI import workflow에 적용을 위임한다.

이 제품은 전체 Danbooru 사전 브라우저가 아니다.
Danbooru 태그와 Product Category는 Compose UX를 위한 입력 재료다.
카탈로그는 사용자의 조작 비용을 줄이기 위한 압축된 조종면이어야 한다.

이 제품은 AI 자동 생성 대행자가 아니다.
LLM 추천, vision AI 검수, metadata vault, API 직접 호출은 핵심 조종 패널이 안정된 뒤 provider로 붙인다.

## Mobile Overlay Cockpit 계약

모바일 오버레이는 Header, Body, Footer로 분리된 조종석이어야 한다.
긴 기능 목록을 한 스크롤에 이어 붙이는 패널이 되면 안 된다.

Header는 현재 상태, 작업 모드, collapse, close를 담당한다.
Header는 외부 NovelAI 페이지 위에서도 시각적으로 먹히지 않아야 한다.

Body는 현재 선택된 작업면 하나만 보여준다.
Compose, Tune, Queue, Review는 같은 Body에 동시에 펼쳐지지 않는다.
작업면 전환은 사용자의 현재 목적을 바꾸는 명시적 액션이다.

Footer는 Apply, Stop, status summary, metadata notice를 담당한다.
Apply와 Stop은 본문 스크롤 맨 아래에 묻히면 안 된다.
Automation이 진행 중이면 Footer는 실행 버튼보다 진행 상태와 중지 권한을 우선한다.

Overlay Shell은 기능 추가보다 먼저 안정되어야 한다.
새로운 패널, 설정, 편의 기능은 Header, Body, Footer 계약을 깨지 않는 방식으로만 들어올 수 있다.

## 작업면 계약

Compose는 무엇을 그릴지 정한다.
Product Category 칩, Raw Prompt, active prompt target, prompt linter, prompt parser, preset piece를 담당한다.
초기 source of truth는 raw prompt string이다.
칩은 raw prompt를 조작하는 도구이며, 구조화 태그 모델의 원본이 아니다.

Tune은 어떤 조건으로 만들지 정한다.
size, steps, scale, sampler, seed rule, character coords 같은 핵심 파라미터만 기본 노출한다.
Advanced flags는 기본 조작면에서 격리한다.

Queue는 짧은 반복 작업을 정한다.
초기 Queue는 preset N장, seed 증가 또는 랜덤, character preset 순환, 실패 시 중단만 담당한다.
복잡한 workflow builder는 초기 범위가 아니다.

Review는 결과를 판단하고 PC 후속 작업으로 넘긴다.
초기 Review는 보관, 폐기, 보류, PC 편집 후보, handoff manifest를 담당한다.
무거운 이미지 처리보다 metadata와 선택 이력 연결을 먼저 보장한다.

## 도메인 경계

Prompt 도메인은 prompt 입력, tag catalog, parser, linter, compiler, prompt target, prompt selection을 담당한다.
Prompt 도메인은 NovelAI DOM selector, PNG chunk, Import Metadata 버튼을 알면 안 된다.

Metadata 도메인은 `MetadataState`, seed planning, NovelAI Comment JSON, PNG metadata encoding을 담당한다.
Metadata 도메인은 Product Category, 칩 색상, 화면 mode를 알면 안 된다.

Automation 도메인은 NovelAI paste target, Import Metadata, Generate readiness, external UI failure를 담당한다.
Automation 도메인은 prompt 편집 UX나 catalog 생성 규칙을 알면 안 된다.

Queue 도메인은 작업 세션, tick plan, stop policy, retry policy를 담당한다.
Queue 도메인은 Automation selector를 직접 다루지 않고 apply pipeline 결과만 관찰한다.

Review and Asset 도메인은 asset record, triage state, variant group, handoff manifest를 담당한다.
이미지 바이너리 처리와 metadata privacy 검증은 별도 하위 provider로 둔다.

Feedback 도메인은 status banner, footer summary, toast, error detail을 담당한다.
브라우저 `alert()`는 기본 피드백 경로로 사용하지 않는다.

Theme and Overlay 도메인은 오버레이의 시각 안정성과 터치 표면을 담당한다.
외부 NovelAI CSS에 의존해 텍스트 대비가 무너지면 안 된다.

## 의존성 방향

UI 컴포넌트는 도메인 hook과 service를 호출할 수 있다.
도메인 service는 UI 컴포넌트를 import하면 안 된다.

Prompt는 Metadata에 전달할 문자열과 구조를 만들 수 있다.
Metadata는 Prompt UI나 Product Category를 알면 안 된다.

Metadata는 Automation에 전달할 payload를 만들 수 있다.
Automation selector와 DOM 대기 규칙은 Metadata 안으로 들어오면 안 된다.

Queue는 Apply pipeline을 사용할 수 있다.
Apply pipeline이 Queue 정책을 알면 안 된다.

Offline 도구는 Runtime 데이터 파일을 생성할 수 있다.
Runtime 앱은 Offline script를 import하면 안 된다.

## Runtime and Offline 경계

Runtime은 모바일 브라우저에서 실행되는 단일 북마크릿 번들이다.
Runtime은 빠르게 로드되어야 하며 승인된 Core Catalog만 포함한다.
전체 Danbooru DB, LLM client, 대형 index, 무거운 이미지 분석기는 Runtime 초기 번들에 들어오면 안 된다.

Offline은 개발 또는 빌드 단계에서 실행되는 도구다.
로컬 Danbooru 태그 스냅샷 파싱, Product Category 후보 생성, 사람이 승인한 Core Catalog 생성, 향후 Danbooru API 검증, 향후 LLM 분류 보조는 Offline 책임이다.

Runtime으로 들어오는 catalog 데이터는 이미 검수된 산출물이어야 한다.
Runtime은 태그 분류 판단을 새로 수행하지 않는다.

## 상태 계약

`MetadataState`는 NovelAI 적용을 위한 내부 도메인 상태다.
prompt, params, advanced, useCoords, useOrder, source를 포함한다.
import, preset, queue, apply는 모두 이 상태를 명시적으로 통과해야 한다.

Prompt source of truth는 v1까지 raw prompt string이다.
칩 active 상태, assignment badge, linter 결과는 raw prompt에서 계산되는 파생 상태다.

선택하지 않은 import field는 유지되어야 한다.
빈 문자열, 빈 배열, 0, false는 명시적 값으로 취급되어야 한다.
이 계약을 위해 `MetadataPatch`와 `mergeMetadataPatch()`가 필요하다.

seed 0은 NovelAI에서 literal seed다.
random seed 요청은 별도 seed rule로 표현하고, 실제 applied seed는 사용자에게 보여줘야 한다.

## Automation 계약

paste event dispatch는 성공을 의미하지 않는다.
paste target 발견, paste event dispatch, Import Metadata 버튼 발견, Import 클릭, Import 완료, Generate 가능 상태는 서로 다른 단계다.

Automation은 단계별 성공과 실패를 명시적으로 반환해야 한다.
묵음 실패는 제품 결함으로 취급한다.

Apply 후 Queue나 Generate loop는 import 성공이 확인되기 전까지 시작하면 안 된다.
Stop은 예약된 timeout과 다음 tick을 모두 취소해야 한다.

외부 NovelAI UI selector 변경은 Automation adapter 안에서만 다룬다.
UI mode, Prompt, Metadata 도메인으로 selector가 새어 나오면 안 된다.

## Metadata Privacy 계약

PNG metadata에는 prompt, negative prompt, seed, source, generation settings가 포함될 수 있다.
이 정보는 민감 정보로 취급한다.

metadata 포함 적용, metadata 포함 다운로드, metadata 제거 다운로드, vault hash 대체는 서로 다른 모드다.
사용자에게 metadata 노출 가능성을 사전에 알려야 한다.

metadata 제거와 복원 토큰 은닉은 같은 기능처럼 표현하면 안 된다.
투명성을 해치는 기능은 기본값이 될 수 없다.

## UI 복잡도 예산

모바일 기본 조작은 탭, 짧은 스와이프, 짧은 확인이어야 한다.
긴 textarea와 복잡한 체크박스 묶음은 기본 화면이 아니라 고급 편집면 또는 접힌 영역으로 둔다.

새 UI가 들어오려면 어느 작업면에 속하는지 먼저 정해야 한다.
작업면이 불명확한 기능은 구현하지 않는다.

새 설정이 들어오려면 기본값, 변경 요약, reset 방법, 모바일 터치 표면을 함께 정의해야 한다.
설정 메뉴를 기능 주차장으로 쓰면 안 된다.

Product Category 칩은 Core Catalog의 조종면이다.
전체 태그 백과사전으로 확장하면 안 된다.

## Verification 계약

기능 완료는 build 통과가 아니라 실제 상호작용 검증 통과다.
Compose 변경은 Playwright에서 입력, 커서, 연속 삽입, 토큰 경계 보정, active badge, 모바일 layout을 검증해야 한다.

Automation 변경은 mock NovelAI fixture와 실제 NovelAI 수동 smoke test를 모두 통과해야 한다.

Overlay 변경은 모바일 viewport에서 가로 overflow, 텍스트 겹침, Header/Footer 접근성, 터치 대상 크기를 확인해야 한다.

배포 변경은 GitHub Pages 원격 JS에 최신 문자열 또는 probe가 반영되었는지 확인해야 한다.

## Vertical Slice Roadmap

v0는 계약 고정과 Core Catalog bootstrap이다.
제품 정체성, 도메인 경계, 모바일 Shell 계약, Runtime/Offline 경계, catalog builder, Playwright smoke test를 고정한다.
이 단계의 산출물은 문서 계약, Core Catalog 생성 도구, 기본 E2E 검증이다.

v1은 Compose and Tune MVP다.
Compose는 Product Category 칩, active prompt target, global assignment badge, raw prompt 직접 편집, token boundary safe insert를 제공한다.
Tune은 size, steps, scale, sampler, seed rule, character coords만 기본 노출한다.
이 단계의 목표는 모바일에서 프롬프트와 핵심 파라미터를 빠르게 구성하는 것이다.

v2는 Automation reliability다.
paste/import/generate 위임을 단계별 Result로 만들고, 성공 전 자동 루프 진입을 금지한다.
Status Banner와 Footer summary가 모든 실패를 표시해야 한다.
이 단계의 목표는 NovelAI 적용 신뢰성이다.

v3은 Queue다.
preset 반복, seed rule, target count, interval, character preset 순환을 짧은 작업 지시서로 만든다.
Queue는 apply pipeline의 성공과 실패를 관찰하고 실패 시 중단한다.
이 단계의 목표는 모바일 자투리 시간의 반자동 생성이다.

v4는 Review and Handoff다.
생성 결과를 보관, 폐기, 보류, PC 편집 후보로 분류하고 handoff manifest로 묶는다.
Triage와 in-place toggle은 이미지 처리보다 선택 이력과 metadata 연결을 먼저 구현한다.
이 단계의 목표는 모바일 결과물을 PC 작업으로 이어주는 것이다.

v5는 Provider expansion이다.
Danbooru API 검증, LLM 자연어 보정, vision AI 검수, metadata vault, cross-device sync를 provider로 붙인다.
Runtime 보안 경계와 번들 크기 예산을 침범하면 이 단계로 들어올 수 없다.

## Phase Gate

각 phase는 이전 phase의 계약을 깨지 않아야 한다.
새 기능은 자신이 속한 작업면, 소유 도메인, source of truth, 실패 상태, 모바일 검증 방법을 먼저 선언해야 한다.

이 네 가지 질문에 답하지 못하는 기능은 구현하지 않는다.
어느 작업면에 속하는가.
어느 도메인이 소유하는가.
어떤 상태를 원본으로 삼는가.
어떻게 실패를 사용자에게 보여주는가.

## 현재 우선순위

현재 프로젝트는 v1 Compose의 핵심 입력 안정성을 확보하는 중이다.
이미 Core Catalog, 카테고리 칩, active prompt target, global assignment badge, 커서 복원, token boundary safe insert가 들어갔다.

다음 우선순위는 Tune 기본면 정리와 Overlay Shell 분리다.
그 다음 v2 Automation reliability로 넘어간다.

배지 일괄 해제, 사용자 색상 설정, 고급 catalog personalization은 v1 핵심 계약을 깨지 않는 작은 편의 기능으로 보관한다.
하지만 지금 우선순위는 아니다.
