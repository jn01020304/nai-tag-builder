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

# Offline Catalog Pipeline

## 목적

오프라인 카탈로그 파이프라인은 Runtime을 가볍게 유지하면서 모바일 Compose 화면에 필요한 Core Catalog를 공급한다.
이 파이프라인은 Danbooru 태그 전체 검색 앱을 만드는 것이 아니라, 검수된 Product Category 칩 데이터를 만드는 도구다.

## 1차 원천

현재 1차 원천은 로컬 파일 `D:\Downloads\danbooru_tag_dataset_20250703\tags.json`다.
확인된 스키마는 `english_name`, `korean_name`, `description`, `keyword`, `major_categories`, `minor_categories`, `count`다.
확인된 규모는 약 18.3MB, 37,175개 태그다.

이 파일은 repository에 직접 커밋하지 않는다.
빌더는 입력 경로를 설정값이나 환경 변수로 받는다.
경로가 없으면 친절한 오류를 출력하고 종료한다.

## 산출물

검수 전 후보는 `resource/catalog/generated/core-catalog-candidates.json`에 둔다.
사람이 관리하는 override는 `resource/catalog/overrides/core-catalog-overrides.json`에 둔다.
앱에 번들링하는 최종 산출물은 `src/prompt/catalog/coreCatalog.generated.ts` 또는 `src/prompt/catalog/coreCatalog.generated.json`에 둔다.
검색창용 지연 로드 데이터는 추후 `public/catalog/liteAutocompleteIndex.json`로 분리한다.

초기에는 Core Catalog만 만든다.
Lite Autocomplete Index는 Compose MVP가 동작한 뒤 만든다.

## 파이프라인 단계

### ingest

원천 JSON을 읽고 필수 필드를 검증한다.
`english_name`이 없거나 `count`가 숫자가 아닌 항목은 제외한다.
중복 `english_name`은 count가 큰 항목을 우선한다.

### normalize

`english_name`을 prompt canonical 후보로 정규화한다.
앞뒤 공백, 연속 공백, 대소문자, 빈 문자열을 정리한다.
prompt output은 `english_name` 기반으로 유지한다.
`korean_name`, `description`, `keyword`는 검색과 검수 보조 메타데이터로 보관한다.

### classify

`major_categories`, `minor_categories`, `english_name`, `korean_name`, `keyword`를 이용해 Product Category 후보를 만든다.
규칙 기반 분류는 확정이 아니라 후보 생성이다.
여러 카테고리에 걸치는 태그는 `needs_review` 상태로 둔다.

### rank

같은 Product Category 안에서 count, 명확성, 모바일 유용성을 기준으로 priority를 계산한다.
처음에는 count 기반 정렬에 수동 boost와 suppress override를 더한다.
기본 노출 수는 카테고리별 8개에서 20개 사이로 제한한다.

### review

자동 생성 결과는 바로 Runtime에 들어가지 않는다.
사람이 승인한 항목만 `accepted`가 된다.
자동 분류가 애매하거나 product category 철학과 맞지 않는 항목은 `needs_review` 또는 `rejected`로 둔다.

### emit

`accepted` 항목만 Runtime Core Catalog로 내보낸다.
Runtime 산출물에는 description 같은 긴 검수 보조 텍스트를 포함하지 않는다.
긴 텍스트는 review artifact에만 남긴다.

### verify

Core Catalog가 너무 커지지 않았는지 확인한다.
중복 tag, 빈 category, 잘못된 target, defaultVisible 과다, rejected 항목 포함 여부를 검사한다.
번들에 포함될 산출물은 gzip 크기 예산을 확인한다.

## LLM 사용 위치

LLM은 MVP 필수 요소가 아니다.
초기 파이프라인은 로컬 JSON과 규칙 기반 분류만으로 동작해야 한다.

LLM은 추후 `needs_review` 후보를 줄이는 보조 provider로만 추가한다.
LLM 출력은 `accepted`가 아니라 `candidate` 또는 `needs_review`로 저장한다.
LLM은 canonical tag를 새로 창작하면 안 되고, 제공된 태그의 Product Category 분류만 제안해야 한다.

## Danbooru API 사용 위치

Danbooru API는 Runtime 기능이 아니라 Offline 검증 도구로 둔다.
초기 MVP에서는 호출하지 않는다.
추후 canonical 검증, deprecated 여부, alias 보강, 최신 count 확인이 필요할 때 후보 태그에 대해서만 호출한다.

## Bootstrapping 전략

현재 로컬 스냅샷으로 Core Catalog를 만든다.
나중에 독자 수집기나 최신 Danbooru API 검증기가 안정화되면 원천 adapter만 교체한다.
Product Category override와 사람이 승인한 판단은 유지한다.

즉 원천 데이터는 교체 가능하지만, 제품 카테고리 계약과 승인된 catalog 판단은 제품 자산으로 보존한다.

## 초기 구현 범위

첫 구현은 Node 기반 CLI 스크립트 하나로 충분하다.
입력은 로컬 `tags.json` 경로다.
출력은 후보 JSON과 작은 generated catalog다.
리뷰 UI는 아직 만들지 않는다.
초기 리뷰는 JSON override 파일 편집으로 처리한다.

빌더가 성공하면 카테고리별 후보 수, accepted 수, rejected 수, defaultVisible 수를 출력한다.
오류는 원천 경로 문제, JSON parse 문제, 스키마 문제, 산출물 쓰기 문제로 구분한다.
