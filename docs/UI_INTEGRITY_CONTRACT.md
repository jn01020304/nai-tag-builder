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
  asides: false
---

# UI Integrity Contract

이 문서는 `nai-tag-builder`의 UI/UX 무결성을 보호하기 위한 구현 계약이다.
새 기능은 이 계약을 깨지 않는 범위에서만 화면에 들어올 수 있다.

## 보호 대상

Overlay Shell의 Header, Body, Footer 구조는 Shell 계층이 소유한다.
기능 컴포넌트는 overlay width, max height, root z-index, fixed position, body scroll 정책을 직접 바꾸지 않는다.

`HighlightedTextarea`는 보호 컴포넌트다.
backdrop highlight layer와 transparent textarea layer의 겹침 구조, scroll sync, font metric 동기화는 기능 추가 중 변경하지 않는다.

Footer의 Apply, Stop, status summary는 항상 접근 가능해야 한다.
새 기능은 Body 스크롤 아래에 핵심 실행 버튼을 묻지 않는다.

## Primitive 우선 원칙

새 버튼, 입력, select, panel, chip, status pill은 `src/ui/primitives`의 primitive를 우선 사용한다.
feature 컴포넌트는 가능한 한 `button`, `input`, `select`, `label`의 시각 스타일을 직접 정의하지 않는다.

feature 컴포넌트는 색상 의미를 직접 고르지 않는다.
raw hex 색상과 `rgba()` 값은 token, palette, primitive 파일 안에서만 허용한다.

feature 컴포넌트는 `src/styles/theme.ts`를 직접 import하지 않는다.
테마와 공통 스타일은 `useTheme()` 또는 `useThemeStyles()`를 통해서만 받는다.

## CSS 격리 원칙

전역 CSS selector는 금지한다.
`body`, `button`, `input`, `textarea`, `*` 같은 selector를 runtime UI 스타일로 사용하지 않는다.

북마클릿 root 바깥의 NovelAI DOM을 스타일링하지 않는다.
NovelAI DOM은 읽을 수는 있지만, 디자인 적용 대상은 아니다.

## 작업면 원칙

새 기능은 Compose, Tune, Queue, Review 중 어느 작업면에 속하는지 먼저 정해야 한다.
작업면이 불명확한 기능은 구현하지 않는다.

Body에 기능 section을 계속 세로로 추가하지 않는다.
작업면 전환 구조가 필요한 기능은 mode registry 도입 후 붙인다.

## 검증 기준

UI 리팩토링은 시각적 변화가 거의 없어야 성공이다.
디자인 변경이 목적이 아니라면 build, lint, compose smoke, bookmarklet injection smoke를 통과해야 한다.

모바일 레이아웃 검증은 최소한 overlay overflow, Header/Footer 접근성, Body 독립 스크롤, Prompt highlight 보존을 확인해야 한다.
