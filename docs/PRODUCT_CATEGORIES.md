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

# Product Categories

## 목적

Product Category는 Danbooru 공식 category가 아니다.
모바일 Compose 화면에서 사용자가 빠르게 태그를 고르기 위해 만든 제품용 UX 분류다.

Danbooru category는 원천 데이터의 분류 힌트로만 사용한다.
Product Category는 앱의 칩 그룹, 검색 필터, 프리셋 조각, 향후 추천 UI의 기준이다.

## 설계 원칙

- 카테고리는 사용자의 작업 언어로 이름 붙인다.
- 한 카테고리에 너무 많은 칩을 기본 노출하지 않는다.
- 기본 노출 칩은 자주 쓰고 의미가 즉시 이해되는 태그만 포함한다.
- 애매한 태그는 Core Catalog가 아니라 Lite Search나 Raw Prompt로 보낸다.
- adult, artist, copyright, character 고유명사는 초기 Core Catalog 기본 노출에서 제외한다.
- 프롬프트에 실제로 들어가는 값은 canonical English tag다.
- `korean_name`, `description`, `keyword`는 UI 검색과 검수 보조 정보이며 prompt output이 아니다.

## 초기 Product Category

### headcount

이미지에 등장하는 사람 수, 성별 조합, 단독 초점을 다룬다.
예시는 `1girl`, `2girls`, `1boy`, `2boys`, `solo`, `solo focus`, `multiple girls`다.

### background

장소, 실내외, 배경 복잡도, 배경 물체를 다룬다.
예시는 `simple background`, `white background`, `indoors`, `outdoors`, `classroom`, `bedroom`, `sky`다.

### framing

카메라 거리, 몸이 보이는 범위, 시선 방향, 기본 구도를 다룬다.
예시는 `looking at viewer`, `upper body`, `full body`, `cowboy shot`, `close-up`, `from side`다.

### pose

캐릭터의 자세와 몸 동작을 다룬다.
예시는 `standing`, `sitting`, `lying`, `kneeling`, `arms up`, `hand on hip`다.

### expression

표정과 감정 표현을 다룬다.
예시는 `smile`, `open mouth`, `blush`, `serious`, `crying`, `angry`다.

### appearance

머리, 눈, 체형, 기본 외형을 다룬다.
예시는 `long hair`, `short hair`, `blue eyes`, `brown hair`, `twintails`다.

### outfit

의상과 착용물을 다룬다.
예시는 `school uniform`, `dress`, `shirt`, `skirt`, `jacket`, `hat`다.

### style_quality

품질, 해상도, 렌더링 스타일, 이미지 완성도 관련 태그를 다룬다.
예시는 `best quality`, `highres`, `detailed`, `beautiful`, `masterpiece`다.

### negative_safety

기본 네거티브 프롬프트에 자주 쓰는 품질 방어 태그를 다룬다.
예시는 `lowres`, `bad anatomy`, `bad hands`, `text`, `watermark`, `blurry`다.

### character_scope

NovelAI v4 character caption에 넣을 가능성이 높은 캐릭터별 외형, 의상, 소품을 다룬다.
초기에는 별도 기본 노출을 최소화하고, character prompt UI가 생길 때 확장한다.

### utility

분류가 애매하지만 모바일 조작에서 자주 쓰는 태그를 임시로 둔다.
이 카테고리는 장기 보관소가 아니라 재분류 대기소다.

## Core Catalog Entry 계약

Core Catalog 항목은 최소한 다음 의미를 가져야 한다.

- `id`: 안정적인 내부 식별자
- `tag`: prompt에 들어갈 canonical English tag
- `label`: UI에 보여줄 기본 label
- `koreanLabel`: 한국어 보조 label
- `productCategory`: Product Category 값
- `sourceMajorCategory`: 원천 데이터의 major category
- `sourceMinorCategory`: 원천 데이터의 minor category
- `count`: 원천 데이터의 사용량
- `aliases`: canonical tag로 치환할 별칭 목록
- `priority`: 같은 카테고리 안의 노출 우선순위
- `defaultVisible`: Compose 기본 칩으로 노출할지 여부
- `target`: `prompt`, `negative`, `character`, `any` 중 하나
- `reviewStatus`: `accepted`, `candidate`, `rejected`, `needs_review` 중 하나

## 분류 판단 규칙

`major_categories`와 `minor_categories`는 1차 힌트다.
예를 들어 `Headcount & Relationship`은 headcount 후보이고, `Backgrounds`는 background 후보이며, `Pose`는 pose 후보다.
하지만 최종 판단은 Product Category override가 우선한다.

태그 이름 패턴은 2차 힌트다.
숫자와 `girl`, `boy` 조합은 headcount 후보로 본다.
`background`, `indoors`, `outdoors`, 장소명은 background 후보로 본다.
`looking`, `view`, `shot`, `body`, `from` 계열은 framing 후보로 본다.
`hair`, `eyes`, `twintails` 계열은 appearance 후보로 본다.
`uniform`, `dress`, `shirt`, `skirt` 계열은 outfit 후보로 본다.

사용량은 노출 우선순위 힌트다.
사용량이 높아도 모바일 첫 화면에서 의미가 불명확하거나 너무 특수하면 기본 노출하지 않는다.

사용자가 자주 직접 입력한 태그는 별도 user catalog 후보가 될 수 있다.
user catalog는 Core Catalog와 분리하고, 향후 export/import 대상이 된다.

## 초기 제한

Core Catalog는 초기 150개 안팎으로 제한한다.
카테고리별 기본 노출은 8개에서 20개 사이를 목표로 한다.
Lite Autocomplete Index는 별도 파일로 지연 로드한다.
전체 원천 태그 JSON은 Runtime bundle에 포함하지 않는다.
