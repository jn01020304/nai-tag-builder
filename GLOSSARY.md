---
language: korean
formatting:
  tables: false
  bold emphasis: false
  blockquotes: false
writing:
  preamble: false
  filler: false
  closing summary: false
  asides: false
---

# Glossary

## NovelAI 메타데이터

tEXt chunks
: PNG 텍스트 메타데이터 청크. NovelAI Import가 `Title`, `Description`, `Software`, `Source`, `Generation time`, `Comment` 등을 읽어 생성 정보를 복원한다.

iTXt
: 국제화 텍스트 PNG 청크. 현재 import parser는 표준 PNG text fallback으로 지원한다.

zTXt
: 압축 텍스트 PNG 청크. 현재 import parser는 `pako` inflate로 해제해 읽는다.

Comment JSON
: NovelAI 생성 파라미터가 들어 있는 JSON payload. `prompt`, `uc`, `steps`, `scale`, `seed`, `sampler`, `width`, `height`, `v4_prompt`, `v4_negative_prompt` 등을 포함한다.

v4_prompt
: NovelAI V4 prompt 구조. 기본 prompt와 character prompt 배열, 좌표 정보를 포함한다.

v4_negative_prompt
: V4 negative prompt 구조. 기본 negative prompt와 character negative prompt 배열을 포함한다.

char_captions
: 캐릭터별 prompt 배열. 각 항목은 캐릭터 caption과 중심 좌표를 가진다.

Source
: NovelAI 모델/생성 출처를 식별하는 metadata field. 예: `NovelAI Diffusion V4.5 ...`.

seed=0
: NovelAI에서 random seed가 아니라 literal fixed seed다. 랜덤화가 필요하면 앱이 직접 32-bit seed를 생성해야 한다.

Identical Parameters Block
: NovelAI가 직전 생성과 같은 파라미터라고 판단해 Generate button을 비활성화하는 상태. React state 수준의 block이라 네트워크 우회로 해결되지 않는다.

## Stealth Metadata

stealth_pngcomp
: NovelAI 이미지 픽셀 alpha channel LSB에 숨겨진 압축 메타데이터 포맷. 표준 EXIF/PNG text가 없어도 복원 가능할 수 있다.

LSB
: Least Significant Bit. 각 alpha 값의 마지막 1비트. `alpha & 1`로 추출한다.

column-major order
: 픽셀 순회 방식. 행 우선이 아니라 `x`를 바깥 루프로, `y`를 안쪽 루프로 돈다.

stealth signature
: UTF-8 문자열 `stealth_pngcomp`. 15 bytes, 120 bits.

payload length
: signature 뒤 32 bits. big-endian 정수로 compressed payload byte length를 나타낸다.

inflateRaw fallback
: stealth payload 복원 시 gzip header/footer를 제거한 raw deflate 해제를 먼저 시도하는 방식.

ungzip fallback
: raw inflate 실패 시 원본 compressed bytes 전체를 gzip으로 해제하는 fallback.

createImageBitmap
: 브라우저 네이티브 이미지 decode API. PNG/WebP 등 브라우저가 지원하는 image Blob을 pixel bitmap으로 변환한다.

OffscreenCanvas
: bitmap을 그린 뒤 `getImageData()`로 RGBA bytes를 읽기 위한 canvas. 지원되지 않으면 일반 canvas fallback을 쓴다.

## 프로젝트 상태

MetadataState
: 앱 내부 source of truth. prompt, params, advanced, coordinates, source 정보를 담는다.

PromptState
: base prompt, negative base, character prompts, negative character prompts를 담는 하위 상태.

CommentJson
: `MetadataState`에서 NovelAI Import가 이해하는 JSON으로 변환된 결과.

metadataTranslator
: NovelAI metadata JSON을 `MetadataState`로 변환하는 모듈.

pngParser
: PNG text chunks와 stealth LSB fallback을 읽어 NovelAI metadata를 추출하는 parser.

stealthLsbDecoder
: image Blob을 pixel data로 decode하고 alpha LSB에서 `stealth_pngcomp` payload를 복원하는 모듈.

ImageImportPatch
: 단일 image file에서 추출한 metadata와 변환된 state patch.

BatchImageImportResult
: 여러 image file import 결과. patches, failedFiles, mergedState를 가진다.

conservative merge
: batch import 병합 규칙. 첫 scalar settings를 우선 보존하고, character prompt 배열은 충돌 없이 이어붙인다.

buildCommentJson
: `MetadataState`를 NovelAI `Comment` JSON으로 변환하는 함수.

paste pipeline
: 앱 상태를 PNG metadata로 만들고 NovelAI page에 paste/import 이벤트로 전달하는 적용 경로.

presetStorage
: Dexie IndexedDB 기반 preset 저장소. 기존 localStorage preset migration과 load-time normalization을 포함한다.

preset queue
: preset ID 배열을 기반으로 순차 또는 future random/rotation 생성을 준비하는 queue 상태.

## UI 개념

PromptPairTabs
: Main/Undesired 또는 Character/Undesired Character 쌍을 탭과 split view로 보여주는 공통 컴포넌트.

split view
: Main과 Negative prompt를 위아래로 동시에 보여주는 모드.

field subtitles
: textarea 위에 반복 표시되던 `Main Prompt`, `Undesired Content`, `Character 1 Prompt` 같은 작은 라벨. 모바일 공간 절약을 위해 제거됨.

active prompt target subtitle
: `Insert target: Main Prompt`처럼 현재 삽입 대상 표시를 위해 있던 텍스트. 탭 상태와 중복되어 제거됨.

circular collapsed launcher
: overlay를 접었을 때 긴 bar 대신 표시되는 56px 원형 버튼. 클릭하면 overlay가 다시 펼쳐진다.

four-edge resize
: overlay 왼쪽, 오른쪽, 위, 아래 edge를 드래그해 크기를 조절하는 방식. viewport 8px padding 안에서 clamp된다.

overlay body
: Header와 Footer 사이의 scrollable 영역. Apply button은 footer에 남아 body scroll 아래로 묻히지 않는다.

## Theme Sync

Styled Components theming
: NovelAI 테마 방식. CSS custom properties가 아니라 hashed class와 injected style tag로 색을 적용한다.

DOM/CSS probe
: NovelAI DOM 요소의 `getComputedStyle()`을 읽어 앱 theme token을 맞추는 방식.

readable text sampling
: 첫 번째 text color를 쓰지 않고, 현재 sampled background와 contrast가 충분한 text color를 선택하는 방식.

interactive color pollution
: 버튼/태그의 흰 글자색이 일반 overlay text color로 잘못 들어오는 문제. sampler에서 interactive 요소를 필터링해 방지한다.

Generate accent
: NovelAI 원본 Generate button의 background color. 앱 Apply button accent로 동기화한다.

parameter input sync
: Width, Height, Steps 등 앱 number input의 배경/테두리를 NovelAI number/select input 표면과 맞추는 것.

intensity color classes
: NovelAI weighted prompt highlighting에 쓰이는 `low-intensity-color-*`, `mid-intensity-color-*`, `high-intensity-color-*` 계열 class.

probe element technique
: 임시 span에 intensity class를 붙여 computed color를 읽고 즉시 제거하는 방식.

MutationObserver theme detection
: NovelAI theme change가 style tag 교체로 나타나므로 `document.head`와 body subtree 변화를 감지해 theme sample을 다시 수행한다.

## 구현 패턴

flushSync
: React mount를 동기 강제하는 API. NovelAI page에서 async render가 flush되지 않는 문제를 피한다.

React-controlled input
: NovelAI input은 React state에 의해 제어된다. DOM value setter로 바꿔도 React가 되돌릴 수 있다.

nativeInputValueSetter
: React input 값 직접 조작 트릭. 이 프로젝트에서는 신뢰 가능한 주요 적용 경로가 아니다.

onBlur clamping
: 숫자 입력에서 typing 중 빈 문자열을 허용하고 blur 시점에만 min/max 보정하는 방식.

HighlightedTextarea
: 투명 textarea를 highlight backdrop 위에 겹쳐 syntax highlighting을 구현하는 컴포넌트.

textarea highlight protection
: textarea 자체 배경을 칠하면 weight syntax highlight가 묻힌다. 배경 색상은 textarea가 아니라 주변 라벨/탭/레이어에서 처리해야 한다.

GitHub Pages sentinel check
: push 후 remote `nai-tag-builder.js?t=<unique>`를 직접 받아 새 문자열이 있는지 확인하는 배포 검증 방식.
