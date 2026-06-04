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

# Mobile Overlay Contract

## 목적

모바일 오버레이는 `nai-tag-builder`의 제품 표면이다.
좁은 NovelAI 화면 위에서도 사용자가 프롬프트 구성, 핵심 파라미터 조정, 적용, 반복 생성, 결과 선별을 빠르게 수행하게 해야 한다.

오버레이는 기능 목록을 세로로 펼치는 패널이 아니다.
현재 작업 하나를 보여주는 조종석이다.

## Shell 구조

Overlay Shell은 Header, Body, Footer로 물리적으로 분리한다.

Header는 앱 이름, 현재 상태, mode 전환, collapse, close를 담당한다.
Header는 sticky 영역으로 유지한다.

Body는 현재 선택된 작업면만 보여준다.
작업면은 Compose, Tune, Queue, Review 순서로 확장한다.
긴 설정 목록이 한 스크롤에 모두 이어지면 안 된다.

Footer는 Apply, Stop, status summary, metadata notice를 담당한다.
Footer는 sticky 영역으로 유지한다.
Apply 버튼은 본문 맨 아래에 묻히면 안 된다.

## 작업 모드

Compose는 프롬프트 작성 모드다.
카테고리 칩, 직접 입력, 선택된 태그, Raw Prompt를 다룬다.
긴 textarea는 기본 조작면이 아니라 Raw Prompt 또는 Advanced Edit로 연다.

Tune은 생성 조건 조정 모드다.
seed, size, steps, scale, sampler, character coords 같은 핵심 파라미터만 기본 노출한다.
Advanced flags는 접힌 전문가 영역으로 둔다.

Queue는 반복 생성 지시 모드다.
preset N장 생성, seed rule, character preset 순환, 실패 시 중단 같은 짧은 작업만 다룬다.
초기에는 복잡한 조건 분기 UI를 만들지 않는다.

Review는 결과 확인과 이관 모드다.
보관, 폐기, 보류, PC 편집 후보, handoff manifest를 다룬다.
초기에는 이미지 처리보다 선택 상태와 metadata 연결을 우선한다.

## Compose UX 계약

기본 조작은 타이핑보다 탭이어야 한다.
Product Category 칩은 모바일 첫 화면에서 빠르게 누를 수 있어야 한다.
검색과 직접 입력은 항상 가능해야 한다.
Raw Prompt는 기존 프롬프트 붙여넣기와 정밀 수정용 escape hatch다.

초기 source of truth는 raw prompt string이다.
칩 선택은 raw prompt에 canonical tag를 추가하는 액션이다.
raw prompt가 바뀌면 parser가 선택 상태를 다시 계산한다.

## Tune UX 계약

숫자 입력은 UI draft와 domain state를 분리한다.
빈 문자열, 입력 중인 임시 값, 잘못된 값은 Apply 직전 검증을 통과해야 한다.

seed 0은 NovelAI에서 literal fixed seed다.
random seed 요청은 seed rule로 표현하고, 실제 applied seed는 사용자에게 보여준다.

Advanced 영역은 기본값 유지가 안전하다는 전제를 갖는다.
변경된 항목 수와 reset affordance를 제공한다.

## Queue UX 계약

Queue는 사용자가 자투리 시간에 시작하고 멈출 수 있어야 한다.
현재 진행 상황, 다음 작업, 실패 원인을 Footer 또는 상태 영역에서 바로 보여준다.

중지 버튼은 생성 중 항상 접근 가능해야 한다.
중지 후 예약된 timeout이나 다음 tick이 살아남으면 안 된다.

## Feedback 계약

브라우저 `alert()`는 기본 피드백 경로로 사용하지 않는다.
성공, 대기, 실패, 취소는 Status Banner와 Footer summary로 표시한다.

외부 자동화 실패는 사용자용 메시지와 개발자용 원인을 분리한다.
prompt 원문, 로컬 경로, token, 민감 metadata는 로그에 그대로 남기지 않는다.

## 레이아웃 기준

기본 최소 폭은 320px를 기준으로 한다.
360px, 375px, 390px, 412px, 430px 모바일 viewport에서 주요 조작이 가로 overflow를 만들면 안 된다.

터치 대상은 손가락으로 누를 수 있는 크기를 유지한다.
버튼 텍스트가 좁은 폭에서 잘리면 icon, 짧은 label, tooltip, bottom sheet로 재설계한다.

텍스트는 부모 밖으로 밀려나면 안 된다.
긴 prompt, 긴 preset 이름, 긴 tag label은 줄바꿈 또는 생략 규칙을 가져야 한다.

카드는 반복 항목, 모달, 실제 framed tool에만 쓴다.
페이지 section이나 mode surface를 카드 안에 카드처럼 중첩하지 않는다.

## Playwright 검수 기준

모바일 layout regression은 Playwright로 반복 검증한다.
우선 viewport는 360x640, 375x667, 390x844, 412x915, 430x932를 사용한다.
테스트는 `isMobile`과 `hasTouch`를 켠다.

검수 항목은 overlay가 viewport 밖으로 벗어나지 않는지, Header와 Footer가 sticky로 유지되는지, Apply와 Stop이 항상 접근 가능한지, Body가 독립 스크롤을 갖는지, 가로 overflow가 없는지, modal과 bottom sheet가 화면을 가리지 않는지다.

NovelAI 실제 페이지 검증 전에는 mock fixture를 둔다.
fixture는 ProseMirror paste target, Import Metadata button, Generate button만 흉내 내도 충분하다.
실제 NovelAI 수동 테스트는 마지막 smoke test로 둔다.

## 초기 구현 순서

먼저 Shell을 Header, Body, Footer로 분리한다.
그다음 Compose mode를 Product Category 칩과 raw prompt 동기화로 만든다.
그다음 Tune mode를 핵심 파라미터 중심으로 줄인다.
그다음 Apply 상태를 Footer와 Status Banner에 연결한다.
그다음 Queue와 Review를 붙인다.

이 순서가 중요한 이유는 모바일 조작면이 먼저 안정되어야 도메인 기능이 늘어나도 화면이 무너지지 않기 때문이다.
