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
Tag Dictionary용 카테고리 chunk는 `resource/catalog/generated/tag-dictionary`에서 먼저 검증하고, 런타임 lazy load가 붙는 시점에 `public/catalog/tag-dictionary`로 내보낸다.

초기에는 Core Catalog만 만든다.
Lite Autocomplete Index는 Compose MVP가 동작한 뒤 만든다.

## Tag Dictionary Chunk 전략

Tag Dictionary는 Core Catalog와 목적이 다르다.
Core Catalog는 검수된 작은 칩 목록이고, Tag Dictionary chunk는 원천 데이터의 설명성과 검색성을 최대한 보존하는 카테고리별 사전이다.

`minor_categories`는 최종 산출물 필드가 아니다.
빌드 타임에 너무 큰 `major_categories`를 쪼개기 위한 힌트로만 사용한다.

현재 분할 규칙은 다음과 같다.

- `Source and Artist` + `Character` → `Character Names`
- `Source and Artist` + `Artist` → `Artist`
- `Source and Artist` + `Series` → `Series`
- `Source and Artist` + `Other` → `Series`
- `Clothing and Accessories` → `minor_categories`별 chunk
- `Objects` → `minor_categories`별 chunk
- `Character` → `minor_categories`별 chunk
- `Image Composition` → `minor_categories`별 chunk
- `Adult Content` → `minor_categories`별 chunk
- 나머지는 기존 `major_categories` 이름을 유지한다.

따라서 Tag Dictionary는 단순한 1단계 카테고리 목록이 아니라 상위 그룹과 하위 chunk를 가진다.
상위 그룹은 기존 major를 기본으로 하되, `Source and Artist`는 `Names and Sources` 자동완성 그룹으로 바꾼다.
`Character Names`, `Artist`, `Series`는 선택형 칩 목록이 아니라 자동완성형 대형 사전이다.
`Objects`는 유지한다.

각 chunk의 태그 항목은 `english_name`, `korean_name`, `description`, `keyword`, `count`를 유지한다.
`major_categories`와 `minor_categories`는 파일명, manifest, 빌드 규칙으로 표현되므로 항목마다 반복 저장하지 않는다.
모바일 런타임은 앱 시작 시 `manifest.json`만 읽고, 사용자가 카테고리를 열 때 해당 chunk만 지연 로드한다.
`Adult Content` 하위 chunk는 `sensitive-select` 모드로 표시한다.

Compose 기본 선택형 UI는 `headcount`, `background`, `framing`, `pose`, `expression`, `appearance`, `outfit` 같은 작업 중심 그룹을 유지한다.
`outfit`은 `Clothing and Accessories`의 하위 chunk를 이용해 상의, 하의, 속옷/양말, 모자/헤드기어, 신발, 액세서리 같은 소분류 선택으로 확장한다.
Danbooru에 없는 사용자의 직접 관리 프롬프트 조각은 `커스텀 메인`과 `커스텀 네거`로 분리한다.
`커스텀 메인`은 Main Prompt에 넣을 사용자 정의 태그 묶음이고, `커스텀 네거`는 Negative Prompt에 넣을 사용자 정의 태그 묶음이다.
이 둘은 Tag Dictionary 원천 chunk와 별도 데이터로 관리한다.

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
