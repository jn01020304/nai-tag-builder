`nai-tag-builder`는 Danbooru 태그 분류기가 아니라 NovelAI 웹페이지 런타임 환경에 주입되어 구동되는 모바일 우선 북마클릿 오버레이(mobile-first bookmarklet overlay)다. 모든 아키텍처 결정과 리팩토링은 이 제품 정체성과 모바일 visual viewport 제약을 기준으로 판단한다.

## 기준 문서

- `docs/MASTER_BLUEPRINT.md`: 최상위 제품 정체성, Mobile Overlay Cockpit 계약, 도메인 경계, Runtime/Offline 경계, Vertical Slice Roadmap
- `docs/PRODUCT_ARCHITECTURE_BLUEPRINT.md`: 제품 전체 구조, 도메인 경계, 단계별 버전 방향의 보조 설명
- `docs/MOBILE_OVERLAY_CONTRACT.md`: 모바일 오버레이 셸, 작업 모드, 화면 밀도, Playwright 검수 기준
- `docs/PRODUCT_CATEGORIES.md`: 커스텀 Product Category와 Core Catalog 데이터 계약
- `docs/OFFLINE_CATALOG_PIPELINE.md`: 로컬 Danbooru 태그 스냅샷 기반 오프라인 카탈로그 생성 흐름
- `docs/DELEGATED_AUTOMATION_GUIDE.md`: NovelAI paste/import 위임 자동화, 실패 처리, 적용 파이프라인 기준
- `docs/V3_QUEUE_ARCHITECTURE.md`: 반복 생성 Queue 세션, tick 계획, stop policy, failure policy, 모바일 Queue 작업면 계약
- `docs/idea-note-original.md`: 자유 아이디어 주차장 (구현 기준 문서 아님)

## 런타임 아키텍처 및 파이프라인

현재 애플리케이션은 React, TypeScript, Vite 기반의 단일 IIFE 북마클릿 번들로 제공되며, `flushSync`를 통해 NovelAI 페이지의 `#nai-tag-builder-root`에 동기적으로 마운트된다. 핵심 상태는 `MetadataState`로 관리되며, 직접적인 DOM 변형이나 API 호출을 지양하고 아래의 견고한 파이프라인을 통해 NovelAI와 상호작용한다.

### Apply Pipeline (적용 경로)
NovelAI의 입력 필드는 React-controlled input이므로, 값 주입을 강제하는 직접적인 트릭은 React의 상태 조정(reconciliation) 로직에 의해 덮어씌워질 위험이 있다. 이를 방지하기 위해 앱은 `MetadataState`를 `buildCommentJson()`을 거쳐 JSON payload로 변환하고, 이를 가상의 PNG 메타데이터 형태로 패키징하여 DataTransfer 객체를 통해 paste 이벤트를 dispatch한다. 이처럼 metadata import pipeline을 우회 경로로 통과시키는 것이 유일하게 신뢰할 수 있는 적용 경로다.

### Import Pipeline (가져오기 경로)
`Load Image` 파이프라인은 단일 이미지 파싱 및 다중 파일의 batch parse를 모두 지원한다. 표준 PNG 텍스트 청크(`tEXt`, `iTXt`, `zTXt`) 파싱은 물론, 손실 변환으로 EXIF 메타데이터가 유실된 WebP 등의 이미지에서도 메타데이터를 복원할 수 있다. 브라우저의 `createImageBitmap`과 canvas를 활용하여 픽셀 데이터를 디코딩하고, 픽셀의 alpha 채널 LSB에 숨겨진 `stealth_pngcomp` 메타데이터를 column-major 순서로 추출한 뒤 `pako.inflateRaw` (실패 시 `ungzip` fallback)로 압축 해제한다. 다중 이미지 로드 시에는 conservative merge를 적용하여 최초의 유효한 스칼라 설정값을 보존하고, 캐릭터 프롬프트는 충돌 없이 병합한다.

### Theme Sync (테마 동기화)
NovelAI는 CSS 변수를 사용하지 않고 Styled Components 기반의 해시 클래스를 사용하므로, 앱은 `themeProbe`를 활용해 호스트 DOM(페이지, 패널, 입력 필드, Generate 버튼 등)의 computed style을 표본 채취(sample)하여 동기화한다. 배경 대비가 충분한 가독성 있는 글자색을 계산하며, 버튼이나 태그의 흰색 글자가 오버레이의 일반 텍스트 색상을 오염시키는 현상(interactive color pollution)을 방어적으로 필터링한다. MutationObserver를 통해 `document.head`의 style 태그 교체와 body subtree 변화를 감지하여 테마 변경에 실시간으로 대응한다.

## Overlay Shell 계약

오버레이 셸은 모바일 환경의 제한된 작업면에서 생존해야 하는 핵심 런타임 레이아웃이며, 다음 동작 계약을 엄격히 준수한다:

- 상호 배타적인 작업면 (Mutually Exclusive Task Surfaces): 오버레이 셸은 Header, Body, Footer로 역할을 엄격히 분리한다. 특히 Body 영역은 시각적 무결성을 지키기 위해 여러 패널을 한 스크롤에 동시에 펼쳐두지 않고, `Compose`, `Tune`, `Queue`, `Review` 중 단 하나의 작업면(Task Surface)만 상호 배타적으로 렌더링해야 한다.
- Compact UI: 중복되는 field subtitles나 'Insert target' 텍스트를 배제한다. `PromptPairTabs`를 활용해 모바일용 Main / Negative 탭 자체가 편집 대상 지정과 색상 식별을 동시에 담당한다.
- Gestures & Controls: 좌, 우, 상, 하 4면과 4모서리를 통한 크기 조절(four-edge resize)을 지원한다. 모바일에서의 두 손가락 드래그(two-finger drag) 제스처는 4모서리의 리사이즈 핸들 이벤트를 침범하지 않도록 예외 처리되어야 한다.
- Collapse & State Preservation: 오버레이를 접을 때 공간 절약을 위해 56px의 원형 런처(circular collapsed launcher)로 전환된다. 모드 전환이나 접힘 상태에서도 렌더링 비용과 UI 상태 보존을 최적화하기 위해 필요한 경우 DOM unmount 대신 `display: none`을 전략적으로 활용한다.
- Viewport Guard: 주소창, 가상 키보드(OSK), 기기 회전 등으로 layout viewport와 visual viewport가 달라지는 상황을 감지하여, 오버레이가 항상 visual viewport의 8px 패딩 안쪽에 위치하도록 자동 clamp한다.

## 상위 모듈 경계 및 의존성 원칙

- Prompt 계층: Compose 화면 및 태그 입력/컴파일을 담당한다. 이 계층의 절대적인 진실의 원천(Source of Truth)은 구조화된 객체나 칩 상태가 아닌 **`raw prompt string`**이다. 이 계층은 NovelAI DOM selector나 Import Pipeline 구현을 절대 알면 안 된다.
- Tune 계층: 생성 조건(seed, size, steps 등)을 다루며, Advanced flags를 기본 조작면에서 엄격히 격리한다.
- Queue 계층: 보류된 기술 부채가 아닌 독립된 핵심 도메인이다. `QueueDraft`, `QueueSession`, `QueueTickPlan` 등 명확한 데이터 계약을 소유하며 작업 지시를 관장한다. Batched Queue의 실행 단위는 기존 Preset이며, 이미지 batch import는 Preset 생성 후 Queue에 추가되는 입력 경로로 취급한다. Automation 계층의 DOM 셀렉터를 알지 못하며 결과만 관찰한다. 특히 무한 재시도를 막기 위해 **실패 시 중단(Stop on failure)**을 기본 정책으로 강제한다.
- Review / Asset 계층: 결과물의 보관, 폐기, 보류 상태와 메타데이터의 연결을 담당한다. 런타임 환경에서 무거운 이미지 처리를 수행하는 대신, PC 편집 환경으로 안전하게 이관(Handoff)하기 위한 Manifest 생성 및 관리에 집중한다.
- Metadata 계층: `MetadataState` 및 Comment JSON 규격을 관리한다. 태그의 카테고리 기원이나 UI 렌더링 로직을 알면 안 된다.
- Automation 계층: NovelAI 웹 UI에 대한 paste/import/generate 위임만을 전담한다. prompt 편집 UX나 Queue의 내부 로직을 알면 안 된다.
- Offline Catalog 계층: 로컬 태그 스냅샷 분석 등 런타임 밖의 파이프라인. 전체 데이터셋이나 무거운 연산은 철저히 오프라인 빌드 타임으로 밀어낸다.

*(의존성 제약)* UI 컴포넌트는 도메인 서비스 내부 구조에 의존해선 안 되며, 반대로 도메인 모듈은 UI 레이아웃이나 DOM 조작을 소유해선 안 된다.

## 보안 및 한계선 (Security & Capacity Limits)

북마클릿이라는 태생적 한계와 런타임 보안을 유지하기 위해 다음 원칙을 강제한다:
- API 키, 인증 토큰 등 민감한 자격 증명을 평문으로 로컬 스토리지에 저장하거나 소스 코드에 하드코딩하는 것을 금지한다.
- 앱 내부에서 NovelAI 백엔드를 향해 직접적인 API 호출을 수행하는 것을 금지한다. (반드시 DOM 위임 경로를 따른다)
- 런타임 메모리와 초기 로딩 비용 방어를 위해, 수십 MB에 달하는 전체 Danbooru DB나 무거운 LLM 의존성을 런타임에 번들링하는 것을 금지한다. 앱은 오프라인에서 사전 검수된 가벼운 Core Catalog만 소비한다.
