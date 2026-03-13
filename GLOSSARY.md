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

## NovelAI 개념
tEXt chunks
: PNG 메타데이터 청크 6종 (Title, Description, Software, Source, Generation time, Comment). NovelAI가 붙여넣기/업로드 시 읽어 생성 파라미터를 복원. 6개 모두 있어야 Import 모달 작동.

Comment JSON
: `Comment` tEXt 청크에 담긴 JSON 페이로드. 44개 필드 (prompt, steps, scale, seed, sampler, v4_prompt 등). 최소 필수: prompt, steps, scale, width, height, v4_prompt.

v4_prompt
: NovelAI V4 프롬프트 구조. `{ caption: { base_caption, char_captions[] }, use_coords, use_order, legacy_uc }`. 캐릭터별 좌표 기반 regional 생성 지원.

v4_negative_prompt
: v4_prompt과 동일 구조의 네거티브 프롬프트. `use_coords`/`use_order`는 보통 false.

char_captions
: 캐릭터 프롬프트 배열. 각 항목은 `{ char_caption, centers[{ x, y }] }`. NovelAI 캐릭터-영역 타겟팅에 사용.

stealth_pngcomp
: PNG 알파 채널 LSB 인코딩 포맷. 시그니처 "stealth_pngcomp" (120 bits) + 길이 (32 bits big-endian) + gzip 페이로드. 픽셀 순서: column-major. 웹 프론트엔드는 Import에 사용하지 않음.

ProseMirror
: NovelAI 프롬프트 텍스트 영역의 DOM 요소 (`div.ProseMirror`). paste 리스너 1개 보유 (body에 3개).

Styled-Components theming
: NovelAI의 테마 시스템. CSS custom properties 미사용. 해시된 클래스명으로 색상 주입. 테마 변경 시 `<head>`의 `<style>` 태그 교체.

Source 해시
: `Source` tEXt 청크의 값 (예: "NovelAI Diffusion V4.5 48DE2A9D"). AI 모델 버전을 식별. 불일치 시 NAI가 다른 모델 버전으로 폴백.

Identical Parameters Block
: "Identical parameters to last generation" 에러. React state 수준에서 Generate 버튼을 disabled. 네트워크 인터셉트로 우회 불가, Seed 등 파라미터 변경만 해제 가능.

intensity color classes
: `low-intensity-color-*`, `mid-intensity-color-*`, `high-intensity-color-*` CSS 클래스. NovelAI가 가중치 태그에 적용. 프롬프트에 가중치 태그가 있을 때만 존재.

## 프로젝트 개념
MetadataState
: 앱 내부 상태 인터페이스. 26필드 — prompt 4개, params 8개, advanced 11개, v4 2개, meta 1개. NAI의 44필드 Comment JSON 중 30개를 매핑.

CommentJson
: MetadataState에서 변환된 NAI Comment JSON 형식. `buildCommentJson()`이 생성. pngEncoder가 이를 tEXt 청크에 삽입.

buildCommentJson
: MetadataState → CommentJson 변환 함수. v4_prompt 구조 재구성, seed=0 랜덤화, 30개 필드 직렬화. 14개 NAI 필드 미매핑 (데이터 유실 버그).

metadataTranslator
: `translateNovelAiMetadata()`. 임포트된 PNG의 Comment JSON → MetadataState 변환. `v4_prompt.use_coords`/`use_order` 파싱 누락 버그 있음.

paste pipeline
: 메타데이터 주입 경로. CommentJson 직렬화 → PNG 생성 (tEXt + LSB) → DataTransfer paste 이벤트 dispatch. React 19 fiber 특성상 DOM 직접 조작 불가이므로 유일한 파라미터 주입 방법.

round-trip test
: 검증 프로세스. 원본 PNG → parse → translate → buildCommentJson → 원본과 diff. 15개 필드 불일치 발견 (use_coords 파싱 + 14개 미매핑).

intensityParser
: AST 유사 토크나이저. `{}` = high (+depth), `[]` = low (-depth), `weight::tag::` = 숫자 가중치. Token[]에 type/level 부여하여 하이라이팅에 사용.

presetStorage
: IndexedDB (Dexie) 기반 프리셋 저장. `NaiTagBuilderDB.presets` 테이블에 PresetEntry 레코드. settings 필드에 MetadataState를 JSON 문자열로 직렬화. version 필드 없음 — 스키마 변경 시 로드 타임 정규화(`{ ...DEFAULT_STATE, ...parsed }`)로 대응 예정. 구 localStorage(`nai-tb-presets`)에서 자동 마이그레이션 지원.

preset queue
: 프리셋 ID의 `string[]`. React state로 저장, 인덱스는 useRef로 추적 (stale closure 회피). 매 tick마다 다음 프리셋 로드 → CommentJson 빌드 → paste dispatch.

## 기술 패턴
flushSync
: React 19 동기 렌더링 강제. NovelAI 페이지에서 MessageChannel 스케줄러가 작동하지 않아 `createRoot().render()`가 빈 DOM 생성 — `flushSync()`로 해결.

probe element technique
: intensity 색상 추출 방법. 임시 `<span class="{type}-intensity-color-40">`을 DOM에 삽입, `getComputedStyle().backgroundColor` 읽기, 즉시 제거. level 40 = 100% alpha = 순수 기본 RGB.

module-level static constants
: 컴포넌트 함수 바깥에서 선언된 CSS-in-JS 스타일 객체. 모듈 로드 시점에 한 번 평가. mutable `theme` global을 참조하는 3개 (`miniBtn`, `smallNumInput`, `checkboxRowStyle`)는 테마 변경 후 갱신 안 됨.

nativeInputValueSetter
: React controlled input에 직접 값을 설정하는 DOM 트릭. React 19에서는 fiber reconciler가 즉시 되돌림 — 원천적으로 불가. paste pipeline만 유효.

onBlur clamping
: 숫자 입력 패턴. onChange에서 빈 문자열 허용, onBlur에서만 min/max 클램핑. `Number("")` → 0 → min 강제 문제 방지. State 타입: `number | string`.

edge resize handle
: 보이지 않는 `<div>` (8px, position: absolute, right: 0). mousedown/touchstart로 드래그 시작, overlayWidth state 업데이트. 최소 320px, 최대 90vw.

MutationObserver theme detection
: `document.head`에 `MutationObserver({ childList: true, subtree: true })`. NAI 테마 변경 시 style 태그 다수 주입 감지. 300ms debounce 필요.
